import { randomInt } from 'node:crypto';

// Acceso a las tablas pedidos y pedido_items. Compra atómica de US-15 y US-16 según
// MODELO_DE_DATOS.md §4: por cada ítem, UPDATE ... WHERE stock >= ?, y el pedido con sus ítems,
// todo en la misma transacción. Si algún ítem no alcanza, se revierte todo y el stock queda igual.
export const ESTADO_INICIAL = 'Solicitud creada';

// Sin 0/O ni 1/I para que la vecina pueda dictar el número sin confusiones.
const ALFABETO_NUMERO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarNumeroPedido() {
  let numero = 'P-';
  for (let i = 0; i < 6; i++) numero += ALFABETO_NUMERO[randomInt(ALFABETO_NUMERO.length)];
  return numero;
}

// Se lanza dentro de la transacción para que better-sqlite3 la revierta; confirmarPedido la atrapa.
class CompraRechazada extends Error {
  constructor(resultado) {
    super(resultado.motivo);
    this.resultado = resultado;
  }
}

export function crearPedidosRepository(db) {
  const buscarMedicamento = db.prepare(
    'SELECT codigo, nombre, precio_unitario, stock FROM medicamentos WHERE codigo = ? AND activo = 1'
  );
  // La condición de stock va dentro del mismo UPDATE: nunca "leer, restar en JS y guardar".
  const descontarStock = db.prepare(`
    UPDATE medicamentos SET stock = stock - @cantidad, version = version + 1
    WHERE codigo = @codigo AND stock >= @cantidad
  `);
  const existeNumero = db.prepare('SELECT 1 FROM pedidos WHERE numero_pedido = ?').pluck();
  const insertarPedido = db.prepare(`
    INSERT INTO pedidos (numero_pedido, total, estado, fecha_creacion, alias_vecino, vecino_id)
    VALUES (@numero_pedido, @total, @estado, @fecha_creacion, @alias_vecino, @vecino_id)
  `);
  const insertarItem = db.prepare(`
    INSERT INTO pedido_items
      (numero_pedido, codigo_medicamento, nombre_medicamento, cantidad, precio_unitario, subtotal)
    VALUES
      (@numero_pedido, @codigo_medicamento, @nombre_medicamento, @cantidad, @precio_unitario, @subtotal)
  `);
  const itemsDe = db.prepare(
    'SELECT * FROM pedido_items WHERE numero_pedido = ? ORDER BY codigo_medicamento'
  );

  // US-17 (#48): "Mis pedidos", del más reciente al más antiguo.
  const pedidosDeVecino = db.prepare(
    'SELECT * FROM pedidos WHERE vecino_id = ? ORDER BY fecha_creacion DESC, numero_pedido'
  );

  // `items` ya viene validado y sin códigos repetidos: [{ codigo, cantidad }].
  // `vecinoId` (US-17) viene de la sesión; sin sesión, el pedido queda anónimo.
  const confirmar = db.transaction(({ items, alias = null, vecinoId = null }) => {
    const medicamentos = [];
    const inexistentes = [];
    for (const { codigo, cantidad } of items) {
      const med = buscarMedicamento.get(codigo);
      if (med) medicamentos.push({ med, cantidad });
      else inexistentes.push(codigo);
    }
    if (inexistentes.length > 0) return { ok: false, motivo: 'no_existe', codigos: inexistentes };

    const faltantes = [];
    for (const { med, cantidad } of medicamentos) {
      const r = descontarStock.run({ codigo: med.codigo, cantidad });
      if (r.changes === 0) faltantes.push({ codigo: med.codigo, nombre: med.nombre, stockDisponible: med.stock });
    }
    // Un solo ítem sin stock anula todo el carrito: se lanza para revertir los descuentos ya hechos.
    if (faltantes.length > 0) throw new CompraRechazada({ ok: false, motivo: 'sin_stock', faltantes });

    let numero;
    do numero = generarNumeroPedido();
    while (existeNumero.get(numero));

    const lineas = medicamentos.map(({ med, cantidad }) => ({
      numero_pedido: numero,
      codigo_medicamento: med.codigo,
      nombre_medicamento: med.nombre,
      cantidad,
      precio_unitario: med.precio_unitario,
      subtotal: cantidad * med.precio_unitario,
    }));
    const pedido = {
      numero_pedido: numero,
      total: lineas.reduce((suma, linea) => suma + linea.subtotal, 0),
      estado: ESTADO_INICIAL,
      fecha_creacion: new Date().toISOString(),
      alias_vecino: alias,
      vecino_id: vecinoId,
    };
    // Si algún INSERT falla, la transacción revierte también todos los descuentos de stock.
    insertarPedido.run(pedido);
    for (const linea of lineas) insertarItem.run(linea);
    return { ok: true, pedido: { ...pedido, items: lineas } };
  });

  return {
    // BEGIN IMMEDIATE: toma el candado de escritura desde el inicio, así dos conexiones
    // en paralelo nunca leen el mismo stock y chocan después al escribir.
    confirmarPedido(datos) {
      try {
        return confirmar.immediate(datos);
      } catch (error) {
        if (error instanceof CompraRechazada) return error.resultado;
        throw error;
      }
    },

    buscarPorNumero(numeroPedido) {
      const pedido = db.prepare('SELECT * FROM pedidos WHERE numero_pedido = ?').get(numeroPedido);
      return pedido && { ...pedido, items: itemsDe.all(numeroPedido) };
    },

    listarPorVecino(vecinoId) {
      return pedidosDeVecino.all(vecinoId).map((pedido) => ({ ...pedido, items: itemsDe.all(pedido.numero_pedido) }));
    },
  };
}
