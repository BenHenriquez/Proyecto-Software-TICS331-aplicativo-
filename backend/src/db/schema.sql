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
