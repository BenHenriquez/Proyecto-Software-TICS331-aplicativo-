// US-15 Realizar compra/pedido (#3). Valida la entrada y traduce el resultado a mensajes para la vecina.
// Precio y total NUNCA vienen del cliente: se toman de la base dentro del repository.
export const CANTIDAD_MAXIMA = 20;
const LARGO_MAXIMO_ALIAS = 40;

const MENSAJES = {
  cantidad_invalida: `Elige una cantidad entre 1 y ${CANTIDAD_MAXIMA} unidades.`,
  no_existe: 'No encontramos ese medicamento. Vuelve a buscarlo, por favor.',
  sin_stock: 'Este medicamento ya no tiene stock disponible.',
};

function mensajeSinStock(stockDisponible) {
  if (stockDisponible > 0) {
    const unidades = stockDisponible === 1 ? 'queda 1 unidad' : `quedan ${stockDisponible} unidades`;
    return `No tenemos stock suficiente para esa cantidad: ${unidades}. Prueba con una cantidad menor.`;
  }
  return MENSAJES.sin_stock;
}

function normalizarAlias(alias) {
  if (typeof alias !== 'string') return null;
  return alias.trim().slice(0, LARGO_MAXIMO_ALIAS) || null;
}

function aVista(pedido) {
  return {
    numeroPedido: pedido.numero_pedido,
    medicamento: pedido.nombre_medicamento,
    cantidad: pedido.cantidad,
    precioUnitario: pedido.precio_unitario,
    total: pedido.total,
    estado: pedido.estado,
    fechaCreacion: pedido.fecha_creacion,
  };
}

export function crearPedidosService(pedidosRepository) {
  return {
    confirmarPedido({ codigo, cantidad, alias } = {}) {
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAXIMA) {
        return { ok: false, motivo: 'cantidad_invalida', mensaje: MENSAJES.cantidad_invalida };
      }
      if (typeof codigo !== 'string' || codigo.trim() === '') {
        return { ok: false, motivo: 'no_existe', mensaje: MENSAJES.no_existe };
      }

      const r = pedidosRepository.confirmarPedido({ codigo: codigo.trim(), cantidad, alias: normalizarAlias(alias) });
      if (r.ok) return { ok: true, pedido: aVista(r.pedido) };
      if (r.motivo === 'sin_stock') return { ok: false, motivo: 'sin_stock', mensaje: mensajeSinStock(r.stockDisponible) };
      return { ok: false, motivo: r.motivo, mensaje: MENSAJES[r.motivo] };
    },
  };
}
