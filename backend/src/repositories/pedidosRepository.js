import { randomInt } from 'node:crypto';

// Acceso a la tabla pedidos. Compra atómica de US-15 según MODELO_DE_DATOS.md §4:
// UPDATE ... WHERE stock >= ? + INSERT del pedido en la misma transacción.
export const ESTADO_INICIAL = 'Solicitud creada';

// Sin 0/O ni 1/I para que la vecina pueda dictar el número sin confusiones.
const ALFABETO_NUMERO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarNumeroPedido() {
  let numero = 'P-';
  for (let i = 0; i < 6; i++) numero += ALFABETO_NUMERO[randomInt(ALFABETO_NUMERO.length)];
  return numero;
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
    INSERT INTO pedidos
      (numero_pedido, codigo_medicamento, nombre_medicamento, cantidad,
       precio_unitario, total, estado, fecha_creacion, alias_vecino, vecino_id)
    VALUES
      (@numero_pedido, @codigo_medicamento, @nombre_medicamento, @cantidad,
       @precio_unitario, @total, @estado, @fecha_creacion, @alias_vecino, @vecino_id)
  `);
  // US-17 (#48): "Mis pedidos", del más reciente al más antiguo.
  const pedidosDeVecino = db.prepare(
    'SELECT * FROM pedidos WHERE vecino_id = ? ORDER BY fecha_creacion DESC, numero_pedido'
  );

  const confirmar = db.transaction(({ codigo, cantidad, alias = null, vecinoId = null }) => {
    const med = buscarMedicamento.get(codigo);
    if (!med) return { ok: false, motivo: 'no_existe' };

    const r = descontarStock.run({ codigo, cantidad });
    if (r.changes === 0) return { ok: false, motivo: 'sin_stock', stockDisponible: med.stock };

    let numero;
    do numero = generarNumeroPedido();
    while (existeNumero.get(numero));

    const pedido = {
      numero_pedido: numero,
      codigo_medicamento: med.codigo,
      nombre_medicamento: med.nombre,
      cantidad,
      precio_unitario: med.precio_unitario,
      total: cantidad * med.precio_unitario,
      estado: ESTADO_INICIAL,
      fecha_creacion: new Date().toISOString(),
      alias_vecino: alias,
      vecino_id: vecinoId,
    };
    // Si el INSERT falla, la transacción revierte también el descuento de stock.
    insertarPedido.run(pedido);
    return { ok: true, pedido };
  });

  return {
    // BEGIN IMMEDIATE: toma el candado de escritura desde el inicio, así dos conexiones
    // en paralelo nunca leen el mismo stock y chocan después al escribir.
    confirmarPedido(datos) {
      return confirmar.immediate(datos);
    },

    buscarPorNumero(numeroPedido) {
      return db.prepare('SELECT * FROM pedidos WHERE numero_pedido = ?').get(numeroPedido);
    },

    listarPorVecino(vecinoId) {
      return pedidosDeVecino.all(vecinoId);
    },
  };
}
