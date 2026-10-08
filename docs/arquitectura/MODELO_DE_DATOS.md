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
  codigo_medicamento TEXT NOT NULL REFERENCES medicamentos(codigo),
  nombre_medicamento TEXT NOT NULL,                -- copia al momento de la compra
  cantidad           INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 20),
  precio_unitario    INTEGER NOT NULL,             -- copia del precio al confirmar
  total              INTEGER NOT NULL,             -- cantidad × precio, calculado en servidor
  estado             TEXT NOT NULL DEFAULT 'Solicitud creada' CHECK (estado IN (
    'Solicitud creada', 'En cotización', 'Validación de pago', 'En preparación',
    'Pedido en ruta', 'Entregado', 'No entregado', 'Listo para retirar',
    'Retirado en farmacia')),
  fecha_creacion     TEXT NOT NULL,                -- ISO 8601
  alias_vecino       TEXT,                         -- solo alias ficticio, opcional
  vecino_id          INTEGER REFERENCES vecinos(id) -- US-17: solo si compró con sesión iniciada
);

-- US-17 Ingreso con Neuro-Access (#45). Sin RUT ni datos personales: solo el Id de la identidad
-- y el nombre de pila para saludar. Los secretos y tokens se guardan como hash SHA-256.
CREATE TABLE vecinos (
  id            INTEGER PRIMARY KEY,
  identidad_id  TEXT NOT NULL UNIQUE,              -- Id de la identidad legal (Neuro-Access) o "…@simulado"
  nombre        TEXT NOT NULL,                     -- nombre de pila, para el saludo
  creado_en     TEXT NOT NULL                      -- ISO 8601
);

CREATE TABLE intentos_ingreso (
  llave_hash    TEXT PRIMARY KEY,                  -- llave del navegador (cookie httpOnly)
  secreto_hash  TEXT NOT NULL UNIQUE,              -- sessionId enviado al Neuron; nunca va al navegador
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
    'pendiente', 'aprobado', 'rechazado', 'usado')),
  vecino_id     INTEGER REFERENCES vecinos(id),    -- se llena al aprobarse
  vence_en      TEXT NOT NULL                      -- ISO 8601, 5 minutos después de crearse
);

CREATE TABLE sesiones (
  token_hash    TEXT PRIMARY KEY,                  -- token de la cookie httpOnly
  vecino_id     INTEGER NOT NULL REFERENCES vecinos(id),
  vence_en      TEXT NOT NULL                      -- ISO 8601
);
```

Los 9 estados son los que usa hoy la Farmacia Comunitaria (respuestas del sponsor). En el Sprint 1 solo se usa `Solicitud creada`.

Semilla: `backend/seed/medicamentos_semilla.csv`, 34 filas. Sin stock: MED-014, MED-019, MED-030. Para las pruebas de concurrencia: `PRB-001` (1 unidad) y `PRB-002` (2 unidades).

## 3. API REST

| Método y ruta | Historia | Entrada | Respuestas |
|---|---|---|---|
| `GET /api/health` | — | — | `200 { ok: true }` |
| `GET /api/medicamentos?q=` | US-02 | `q` con al menos 2 letras | `200 { resultados: [...] }` · si la lista está vacía agrega `mensaje: "No encontramos ese medicamento…"` · `400` si `q` es muy corto |
| `POST /api/pedidos` | US-15 | `{ codigo, cantidad, alias? }` (+ cookie de sesión opcional, US-17) | `201 { pedido }` · `404 no_existe` · `400 cantidad_invalida` · `409 sin_stock` |
| `GET /api/mis-pedidos` | US-17 | cookie `farmacia_sesion` | `200 { pedidos: [...] }` (más reciente primero) · `401 { motivo: "sin_sesion", mensaje }` |
| `POST /api/sesion/qr` | US-17 | — | `201 { modo, qr, enlace, venceEn }` + cookie `farmacia_ingreso` · `502 { motivo: "proveedor_no_disponible", mensaje }` |
| `GET /api/sesion/qr` | US-17 | cookie `farmacia_ingreso` | `200 { estado }`: `pendiente` (+ `venceEn`), `vencido`, `rechazado` o `sin_intento` (+ `mensaje`), o `aprobado` (+ `vecino: { nombre }` y cookie `farmacia_sesion`) |
| `POST /api/sesion/qr/simular` | US-17 | cookie `farmacia_ingreso` | Solo con el proveedor simulado: `200 { ok: true }` · `409 { motivo: "intento_invalido", mensaje }` · `404` con el proveedor real |
| `POST /api/sesion/callback` | US-17 | JSON de identidad del Neuron | `200 null` · `400 { motivo: "datos_invalidos" }` · `409 { motivo: "intento_invalido" \| "identidad_no_aprobada" }` |
| `GET /api/sesion` | US-17 | cookie `farmacia_sesion` | `200 { vecino: { nombre } \| null }` |
| `POST /api/sesion/cerrar` | US-17 | cookie `farmacia_sesion` | `200 { ok: true }` y borra la cookie |
| `GET /api/backoffice/medicamentos` | US-13 | header `x-backoffice-token` | `200 { medicamentos: [...] }` · `401 { motivo, mensaje }` |
| `PUT /api/backoffice/medicamentos/:codigo` | US-13 | `{ precioUnitario?, stock?, version }` + header (`version` obligatoria, #12) | `200 { medicamento }` · `400 { motivo, mensaje, errores: { campo: motivo } }` · `401 { motivo, mensaje }` · `404 no_existe` · `409 { motivo: "version_cambiada", mensaje }` si la versión cambió |

Cada resultado de búsqueda devuelve: `codigo, nombre, principioActivo, presentacion, precioUnitario, stock, disponible`. El pedido devuelve: `numeroPedido, medicamento, cantidad, precioUnitario, total, estado, fechaCreacion`.

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

**Detalle del ingreso con Neuro-Access (US-17, #46):**

- Se usa el Quick Login de TAG en **modo back-end** (<https://lab.tagroot.io/QuickLogin.md>). `POST /api/sesion/qr` crea un intento con dos valores aleatorios de un solo uso: la **llave**, que va solo a la cookie httpOnly `farmacia_ingreso` del navegador, y el **secreto**, que se envía al Neuron como `sessionId` y nunca llega al navegador. Luego el backend registra el callback en el Neuron (`POST https://<neuron>/QuickLogin { service, sessionId }`) y le pide el QR en base64. El front no carga scripts del Neuron.
- El vecino escanea el QR con Neuro-Access y aprueba. El Neuron hace `POST /api/sesion/callback` (servidor a servidor, por HTTPS) con la identidad. Se acepta solo si el `SessionId` corresponde a un intento pendiente y no vencido, `State` es `Approved`, trae `Id` y su validez (`To`) no ha vencido. Si la identidad no sirve, el intento queda `rechazado`. Si el secreto no existe, ya se usó o venció: `409` sin cambios.
- De la identidad solo se guardan `Id` y el nombre de pila (`Properties.FIRST`). El resto (RUT/PNR, correo, firmas, adjuntos) se descarta, y el cuerpo del callback nunca se escribe en logs.
- El front consulta `GET /api/sesion/qr` cada pocos segundos. Al encontrar el intento aprobado, lo canjea (una sola vez) por una sesión de 8 horas en la cookie httpOnly `farmacia_sesion`; el token nunca va en el cuerpo. El código vence a los 5 minutos.
- Comprar **no** exige sesión: sin sesión, `POST /api/pedidos` funciona igual que en US-15. Con sesión, el pedido guarda `vecino_id` tomado de la cookie, nunca del cuerpo.
- Proveedor: `IDENTIDAD_PROVEEDOR=neuron` usa el Neuron `NEURON_DOMINIO` (por defecto `lab.tagroot.io`) y necesita `URL_PUBLICA_API` con `https://` (túnel). Con cualquier otro valor se usa el proveedor **simulado**: no hay QR y `POST /api/sesion/qr/simular` aprueba con la vecina ficticia «Rosa».

## 4. Concurrencia (compra)

La condición de stock va **dentro del mismo UPDATE**. SQLite ejecuta cada sentencia de forma atómica, así que dos compras de la última unidad nunca pueden confirmarse ambas:

```js
const confirmarPedido = db.transaction(({ codigo, cantidad, alias }) => {
  const med = db.prepare(
    'SELECT * FROM medicamentos WHERE codigo = ? AND activo = 1'
  ).get(codigo);
  if (!med) return { ok: false, motivo: 'no_existe' };

  const r = db.prepare(
    'UPDATE medicamentos SET stock = stock - ?, version = version + 1 ' +
    'WHERE codigo = ? AND stock >= ?'
  ).run(cantidad, codigo, cantidad);
  if (r.changes === 0) return { ok: false, motivo: 'sin_stock' };

  const pedido = { /* numero, total = cantidad * med.precio_unitario, estado inicial */ };
  db.prepare('INSERT INTO pedidos (...) VALUES (...)').run(/* ... */);
  return { ok: true, pedido };
});
```

Si el `INSERT` falla, la transacción revierte también el descuento de stock.

## 5. Backoffice sin pisar ventas (issue #12)

El panel envía la `version` que leyó y el `UPDATE` exige esa misma versión:

```sql
UPDATE medicamentos
SET stock = ?, precio_unitario = ?, version = version + 1
WHERE codigo = ? AND version = ?;
```

Si `changes === 0`, alguien (por ejemplo una venta) modificó el producto mientras se editaba: se responde `409` con el mensaje "El stock cambió mientras editabas. Recarga e intenta de nuevo."

`changes === 0` también ocurre cuando el código no existe. Para no confundir ambos casos, el repository vuelve a leer el medicamento **dentro de la misma transacción**: si existe, es un conflicto de versión (`409`); si no, es `404`. Implementado en `medicamentosRepository.actualizarPrecioYStock` (#12).
