# Modelo de datos y API — FARMAC-IA · Sprint 1

> Fuente de verdad del esquema. Si cambia, este archivo se actualiza en el mismo PR.
> **Datos 100% sintéticos.** Sin RUT, recetas, nombres, direcciones ni datos reales de la farmacia.

## 1. Arquitectura

```
[ Navegador ]  React + Vite + TS (/frontend)
      │  HTTP /api (proxy de Vite en desarrollo)
      ▼
[ Backend ]  Node 20 + Express (/backend)
      routes  →  services  →  repositories
                                  │
                                  ▼
                           SQLite (better-sqlite3)
```

Solo los `repositories` acceden a SQLite. En el Sprint 2 se reemplazan por repositorios que hablen con Praxsuite, sin tocar rutas, servicios ni front.

## 2. Esquema SQLite

```sql
CREATE TABLE medicamentos (
  codigo           TEXT PRIMARY KEY,               -- MED-001… / PRB-001, PRB-002 (pruebas)
  nombre           TEXT NOT NULL,                  -- "Losartán 50 mg"
  principio_activo TEXT NOT NULL,                  -- "Losartán potásico"
  presentacion     TEXT NOT NULL,                  -- "Caja 30 comprimidos"
  categoria        TEXT NOT NULL,
  precio_unitario  INTEGER NOT NULL CHECK (precio_unitario > 0),  -- CLP, ficticio
  stock            INTEGER NOT NULL CHECK (stock >= 0),
  busqueda         TEXT NOT NULL,                  -- nombre + principio activo, minúsculas, sin tildes
  activo           INTEGER NOT NULL DEFAULT 1,
  version          INTEGER NOT NULL DEFAULT 0      -- sube en cada cambio de stock o precio
);

CREATE TABLE pedidos (
  numero_pedido      TEXT PRIMARY KEY,             -- "P-" + 6 caracteres alfanuméricos
  total              INTEGER NOT NULL,             -- suma de los subtotales de sus ítems, calculado en servidor
  estado             TEXT NOT NULL DEFAULT 'Solicitud creada' CHECK (estado IN (
    'Solicitud creada', 'En cotización', 'Validación de pago', 'En preparación',
    'Pedido en ruta', 'Entregado', 'No entregado', 'Listo para retirar',
    'Retirado en farmacia')),
  fecha_creacion     TEXT NOT NULL,                -- ISO 8601
  alias_vecino       TEXT                          -- solo alias ficticio, opcional
);

-- US-16: un pedido tiene uno o más ítems (un medicamento por ítem).
CREATE TABLE pedido_items (
  numero_pedido      TEXT NOT NULL REFERENCES pedidos(numero_pedido),
  codigo_medicamento TEXT NOT NULL REFERENCES medicamentos(codigo),
  nombre_medicamento TEXT NOT NULL,                -- copia al momento de la compra
  cantidad           INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 20),
  precio_unitario    INTEGER NOT NULL,             -- copia del precio al confirmar
  subtotal           INTEGER NOT NULL,             -- cantidad × precio, calculado en servidor
  PRIMARY KEY (numero_pedido, codigo_medicamento) -- un medicamento una sola vez por pedido
);
```

Los 9 estados son los que usa hoy la Farmacia Comunitaria (respuestas del sponsor). En el Sprint 1 solo se usa `Solicitud creada`.

Semilla: `backend/seed/medicamentos_semilla.csv`, 34 filas. Sin stock: MED-014, MED-019, MED-030. Para las pruebas de concurrencia: `PRB-001` (1 unidad) y `PRB-002` (2 unidades).

## 3. API REST

| Método y ruta | Historia | Entrada | Respuestas |
|---|---|---|---|
| `GET /api/health` | — | — | `200 { ok: true }` |
| `GET /api/medicamentos?q=` | US-02 | `q` con al menos 2 letras | `200 { resultados: [...] }` · si la lista está vacía agrega `mensaje: "No encontramos ese medicamento…"` · `400` si `q` es muy corto |
| `POST /api/pedidos` | US-15, US-16 | un medicamento: `{ codigo, cantidad, alias? }` · carrito: `{ items: [{ codigo, cantidad }], alias? }` | `201 { pedido }` · `404 no_existe` · `400 cantidad_invalida` · `400 carrito_vacio` · `400 carrito_invalido` · `400 demasiados_items` · `409 sin_stock` |
| `GET /api/backoffice/medicamentos` | US-13 | header `x-backoffice-token` | `200 { medicamentos: [...] }` · `401 { motivo, mensaje }` |
| `PUT /api/backoffice/medicamentos/:codigo` | US-13 | `{ precioUnitario?, stock?, version }` + header (`version` obligatoria, #12) | `200 { medicamento }` · `400 { motivo, mensaje, errores: { campo: motivo } }` · `401 { motivo, mensaje }` · `404 no_existe` · `409 { motivo: "version_cambiada", mensaje }` si la versión cambió |

Cada resultado de búsqueda devuelve: `codigo, nombre, principioActivo, presentacion, precioUnitario, stock, disponible`. El pedido devuelve: `numeroPedido, items, total, estado, fechaCreacion`, donde cada ítem trae `codigo, medicamento, cantidad, precioUnitario, subtotal`. Si el pedido tiene **un solo** ítem, también trae `medicamento, cantidad, precioUnitario` (los campos de US-15, para quien ya los lee); con varios medicamentos esos tres campos no vienen.

Los errores usan el cuerpo `{ motivo, mensaje }`, donde `mensaje` es texto para la vecina. Ejemplo: `"Este medicamento ya no tiene stock disponible."`

**Detalle del `GET /api/medicamentos?q=` (#7):**

- `q` se normaliza igual que la columna `busqueda` (minúsculas, sin tildes, espacios juntados). Debe quedar con al menos 2 caracteres; si no, `400 { motivo: "busqueda_muy_corta", mensaje }`. Si `q` viene repetido o tiene más de 100 caracteres: `400 { motivo: "busqueda_invalida", mensaje }`.
- Coincidencia parcial por palabra: cada palabra de `q` debe aparecer en `busqueda` (nombre + principio activo), en cualquier orden. `%` y `_` se buscan como letras, no como comodines.
- Solo aparecen medicamentos con `activo = 1`, ordenados por `busqueda`. Los que tienen stock 0 **sí** aparecen, con `disponible: false`.
- Sin coincidencias: `200 { resultados: [], mensaje: "No encontramos ese medicamento…" }`.

**Detalle del `GET /api/backoffice/medicamentos` (#13):**

- Requiere el header `x-backoffice-token` (token simulado), igual que el `PUT`: sin él, con uno incorrecto o si el servidor no tiene token configurado, `401 { motivo: "no_autorizado", mensaje }` y no se muestra el catálogo.
- Responde `200 { medicamentos: [...] }` con los medicamentos activos (`activo = 1`), incluidos los de stock 0, ordenados por la columna `busqueda` (sin mayúsculas ni tildes). Cada uno trae `codigo, nombre, principioActivo, presentacion, precioUnitario, stock, disponible, version`; no expone `busqueda`, `categoria` ni `activo`.
- La `version` es la que el panel devuelve en cada `PUT` (§5). Solo lee: no cambia nada en la base.

**Detalle del `PUT /api/backoffice/medicamentos/:codigo` (#11):**

- Requiere el header `x-backoffice-token` (token simulado). Si falta, es incorrecto, o el servidor no tiene token configurado: `401 { motivo: "no_autorizado", mensaje }`. La autorización se revisa antes que los datos (un JSON mal formado se rechaza antes, con `400`).
- Se editan solo `precioUnitario` y `stock`; cualquier otro campo se ignora. Debe venir al menos uno. Ambos deben ser números JSON **enteros** (no texto): `precioUnitario` mayor que cero y hasta 10.000.000, y `stock` desde cero y hasta 1.000.000 (valores mayores se rechazan para no guardar números que rompan los totales).
- `version` es **obligatoria** (#12): un entero desde cero, la que leyó el panel (§5). No se edita; solo sube con cada cambio. Si falta o no es un entero válido, `400` con `errores.version`.
- Si algún valor es inválido no se guarda nada y responde `400 { motivo: "datos_invalidos", mensaje, errores }`, con un motivo por campo (`errores.precioUnitario`, `errores.stock`, `errores.version`, o `errores.general` si no vino ni precio ni stock). La validación va antes que el candado de versión y que la búsqueda del código.
- Si el código no existe: `404 { motivo: "no_existe", mensaje }` (aunque la versión enviada sea cualquiera).
- Si la `version` enviada no es la vigente (una venta u otra edición cambió el medicamento después de que el panel lo leyó): `409 { motivo: "version_cambiada", mensaje: "El stock cambió mientras editabas. Recarga e intenta de nuevo." }` y no se guarda nada, tampoco el precio. Aplica a cualquier cambio, también al de solo precio.
- Un cambio válido sube `version` en 1 y responde `200 { medicamento }` con `codigo, nombre, principioActivo, presentacion, precioUnitario, stock, disponible, version`.
- En cualquier endpoint, un error del cliente que detecta el servidor responde `{ motivo: "solicitud_invalida", mensaje }` con su código: `400` (JSON mal formado o dirección mal codificada), `413` (cuerpo demasiado grande) o `415` (codificación de caracteres no soportada). Un fallo interno real responde `500 { motivo: "error_interno", mensaje }`.

**Detalle del carrito, `POST /api/pedidos` con `items` (US-16, #42):**

- Un solo pedido para todos los medicamentos del carrito. El precio, el subtotal de cada ítem y el total los calcula siempre el servidor: cualquier `precioUnitario`, `subtotal` o `total` que mande el cliente se ignora.
- Cada ítem tiene `cantidad` entera de 1 a 20 y un `codigo`. Si el mismo `codigo` viene repetido, se junta en un solo ítem (y la suma también debe ser de 1 a 20). Máximo 10 medicamentos distintos.
- `items` vacío: `400 carrito_vacio`. `items` que no es una lista, o un ítem que no es un objeto: `400 carrito_invalido`. Más de 10: `400 demasiados_items`. Cantidad inválida en cualquier ítem: `400 cantidad_invalida`. Algún código fuera del catálogo: `404 no_existe`. En todos esos casos no se descuenta nada.
- Todo o nada: si algún ítem no tiene stock suficiente responde `409 { motivo: "sin_stock", mensaje, faltantes: [{ codigo, medicamento, stockDisponible }] }`. El `mensaje` nombra cada medicamento que no alcanza y dice que no se creó ningún pedido. No se crea el pedido y el stock de todos los ítems queda sin cambios.
- La compra de un solo medicamento (`{ codigo, cantidad }`) mantiene sus mensajes de US-15 y no trae `faltantes`.

## 4. Concurrencia (compra)

La condición de stock va **dentro del mismo UPDATE**. SQLite ejecuta cada sentencia de forma atómica, así que dos compras de la última unidad nunca pueden confirmarse ambas:

```js
// items: [{ codigo, cantidad }], sin códigos repetidos
const confirmarPedido = db.transaction(({ items, alias }) => {
  const meds = [];
  for (const { codigo, cantidad } of items) {
    const med = db.prepare(
      'SELECT * FROM medicamentos WHERE codigo = ? AND activo = 1'
    ).get(codigo);
    if (!med) return { ok: false, motivo: 'no_existe' };   // todavía no se escribió nada
    meds.push({ med, cantidad });
  }

  const faltantes = [];
  for (const { med, cantidad } of meds) {
    const r = db.prepare(
      'UPDATE medicamentos SET stock = stock - ?, version = version + 1 ' +
      'WHERE codigo = ? AND stock >= ?'
    ).run(cantidad, med.codigo, cantidad);
    if (r.changes === 0) faltantes.push(med.codigo);
  }
  // Un solo ítem sin stock anula todo el carrito: al lanzar, SQLite revierte los descuentos anteriores.
  if (faltantes.length > 0) throw new CompraRechazada({ ok: false, motivo: 'sin_stock', faltantes });

  // INSERT del pedido (total = suma de cantidad × med.precio_unitario) y de cada ítem en pedido_items
  return { ok: true, pedido };
});
// Se ejecuta con confirmarPedido.immediate(...) (BEGIN IMMEDIATE) y se atrapa CompraRechazada afuera.
```

Si un `INSERT` falla, o algún ítem no alcanza, la transacción revierte **todos** los descuentos de stock: nunca queda un carrito descontado a medias.

## 5. Backoffice sin pisar ventas (issue #12)

El panel envía la `version` que leyó y el `UPDATE` exige esa misma versión:

```sql
UPDATE medicamentos
SET stock = ?, precio_unitario = ?, version = version + 1
WHERE codigo = ? AND version = ?;
```

Si `changes === 0`, alguien (por ejemplo una venta) modificó el producto mientras se editaba: se responde `409` con el mensaje "El stock cambió mientras editabas. Recarga e intenta de nuevo."

`changes === 0` también ocurre cuando el código no existe. Para no confundir ambos casos, el repository vuelve a leer el medicamento **dentro de la misma transacción**: si existe, es un conflicto de versión (`409`); si no, es `404`. Implementado en `medicamentosRepository.actualizarPrecioYStock` (#12).
