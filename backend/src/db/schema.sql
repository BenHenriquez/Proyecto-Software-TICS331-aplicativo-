-- Esquema oficial: docs/arquitectura/MODELO_DE_DATOS.md §2. Si cambia, actualizar ese archivo en el mismo PR.
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
  PRIMARY KEY (numero_pedido, codigo_medicamento)
);
