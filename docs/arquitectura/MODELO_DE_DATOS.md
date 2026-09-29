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
  alias_vecino       TEXT                          -- solo alias ficticio, opcional
);
```

Los 9 estados son los que usa hoy la Farmacia Comunitaria (respuestas del sponsor). En el Sprint 1 solo se usa `Solicitud creada`.

Semilla: `backend/seed/medicamentos_semilla.csv`, 34 filas. Sin stock: MED-014, MED-019, MED-030. Para las pruebas de concurrencia: `PRB-001` (1 unidad) y `PRB-002` (2 unidades).

## 3. API REST

| Método y ruta | Historia | Entrada | Respuestas |
|---|---|---|---|
| `GET /api/health` | — | — | `200 { ok: true }` |
| `GET /api/medicamentos?q=` | US-02 | `q` con al menos 2 letras | `200 { resultados: [...] }` · si la lista está vacía agrega `mensaje: "No encontramos ese medicamento…"` · `400` si `q` es muy corto |
| `POST /api/pedidos` | US-15 | `{ codigo, cantidad, alias? }` | `201 { pedido }` · `404 no_existe` · `400 cantidad_invalida` · `409 sin_stock` |
| `GET /api/backoffice/medicamentos` | US-13 | header `x-backoffice-token` | `200 { medicamentos: [...] }` · `401` |
| `PUT /api/backoffice/medicamentos/:codigo` | US-13 | `{ precioUnitario?, stock?, version }` + header | `200 { medicamento }` · `400 { errores: { campo: motivo } }` · `401` · `409` si la versión cambió |

Cada resultado de búsqueda devuelve: `codigo, nombre, principioActivo, presentacion, precioUnitario, stock, disponible`. El pedido devuelve: `numeroPedido, medicamento, cantidad, precioUnitario, total, estado, fechaCreacion`.

Los errores usan el cuerpo `{ motivo, mensaje }`, donde `mensaje` es texto para la vecina. Ejemplo: `"Este medicamento ya no tiene stock disponible."`

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
