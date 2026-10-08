// US-15 Realizar compra/pedido (#3) y US-16 Carrito (#42). Valida la entrada y traduce el resultado
// a mensajes para la vecina. Precio y total NUNCA vienen del cliente: se toman de la base dentro
// del repository.
//
// Dos formas de pedir, la misma transacción:
//   · compra simple (US-15):  { codigo, cantidad, alias? }
//   · carrito (US-16):        { items: [{ codigo, cantidad }], alias? }
export const CANTIDAD_MAXIMA = 20;
export const ITEMS_MAXIMOS = 10;
const LARGO_MAXIMO_ALIAS = 40;

const MENSAJES = {
  cantidad_invalida: `Elige una cantidad entre 1 y ${CANTIDAD_MAXIMA} unidades.`,
  no_existe: 'No encontramos ese medicamento. Vuelve a buscarlo, por favor.',
  sin_stock: 'Este medicamento ya no tiene stock disponible.',
  carrito_vacio: 'Tu carrito está vacío. Agrega al menos un medicamento para hacer tu pedido.',
  carrito_invalido: 'No pudimos leer tu carrito. Revisa tus medicamentos e inténtalo de nuevo.',
  demasiados_items: `Tu carrito puede tener hasta ${ITEMS_MAXIMOS} medicamentos distintos. Quita alguno para continuar.`,
  no_existe_en_carrito: 'Uno de los medicamentos de tu carrito ya no está en el catálogo. Revisa tu carrito, por favor.',
};

const rechazo = (motivo, mensaje = MENSAJES[motivo]) => ({ ok: false, motivo, mensaje });

const unidades = (n) => (n === 1 ? '1 unidad' : `${n} unidades`);

// Compra simple: se conservan los mensajes de US-15 tal cual.
function mensajeSinStockSimple(stockDisponible) {
  if (stockDisponible > 0) {
    const quedan = stockDisponible === 1 ? 'queda 1 unidad' : `quedan ${stockDisponible} unidades`;
    return `No tenemos stock suficiente para esa cantidad: ${quedan}. Prueba con una cantidad menor.`;
  }
  return MENSAJES.sin_stock;
}

// Carrito: se nombra cada medicamento que no alcanza. No se crea ningún pedido y el stock no cambia.
function mensajeSinStockCarrito(faltantes) {
  const detalle = (f) =>
    f.stockDisponible > 0
      ? `«${f.nombre}» (quedan ${unidades(f.stockDisponible)})`
      : `«${f.nombre}» (sin stock)`;
  if (faltantes.length === 1) {
    const [f] = faltantes;
    return f.stockDisponible > 0
      ? `No tenemos stock suficiente de «${f.nombre}»: quedan ${unidades(f.stockDisponible)}. No se creó ningún pedido; ajusta la cantidad e inténtalo de nuevo.`
      : `«${f.nombre}» ya no tiene stock disponible. No se creó ningún pedido; quítalo de tu carrito para continuar.`;
  }
  return `Estos medicamentos de tu carrito no tienen stock suficiente: ${faltantes.map(detalle).join(', ')}. No se creó ningún pedido; ajusta tu carrito e inténtalo de nuevo.`;
}

function normalizarAlias(alias) {
  if (typeof alias !== 'string') return null;
  return alias.trim().slice(0, LARGO_MAXIMO_ALIAS) || null;
}

function aVista(pedido) {
  const items = pedido.items.map((item) => ({
    codigo: item.codigo_medicamento,
    medicamento: item.nombre_medicamento,
    cantidad: item.cantidad,
    precioUnitario: item.precio_unitario,
    subtotal: item.subtotal,
  }));
  const vista = {
    numeroPedido: pedido.numero_pedido,
    items,
    total: pedido.total,
    estado: pedido.estado,
    fechaCreacion: pedido.fecha_creacion,
  };
  // Con un solo medicamento se mantienen los campos de US-15 para quien ya los lee.
  if (items.length === 1) {
    const [{ medicamento, cantidad, precioUnitario }] = items;
    Object.assign(vista, { medicamento, cantidad, precioUnitario });
  }
  return vista;
}

// Devuelve los ítems listos para el repository (cantidades válidas, códigos sin repetir) o un rechazo.
function prepararItems(items) {
  const porCodigo = new Map();
  for (const item of items) {
    if (item === null || typeof item !== 'object') return rechazo('carrito_invalido');
    const { codigo, cantidad } = item;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAXIMA) {
      return rechazo('cantidad_invalida');
    }
    if (typeof codigo !== 'string' || codigo.trim() === '') return rechazo('no_existe');
    // El mismo medicamento dos veces se junta en un solo ítem.
    const clave = codigo.trim();
    porCodigo.set(clave, (porCodigo.get(clave) ?? 0) + cantidad);
  }
  for (const cantidad of porCodigo.values()) {
    if (cantidad > CANTIDAD_MAXIMA) return rechazo('cantidad_invalida');
  }
  return { ok: true, items: [...porCodigo].map(([codigo, cantidad]) => ({ codigo, cantidad })) };
}

export function crearPedidosService(pedidosRepository) {
  return {
    confirmarPedido({ codigo, cantidad, items, alias } = {}) {
      const esCarrito = items !== undefined;
      if (esCarrito) {
        if (!Array.isArray(items)) return rechazo('carrito_invalido');
        if (items.length === 0) return rechazo('carrito_vacio');
        if (items.length > ITEMS_MAXIMOS) return rechazo('demasiados_items');
      }

      const preparado = prepararItems(esCarrito ? items : [{ codigo, cantidad }]);
      if (!preparado.ok) {
        return esCarrito && preparado.motivo === 'no_existe' ? rechazo('no_existe', MENSAJES.no_existe_en_carrito) : preparado;
      }

      const r = pedidosRepository.confirmarPedido({ items: preparado.items, alias: normalizarAlias(alias) });
      if (r.ok) return { ok: true, pedido: aVista(r.pedido) };

      if (r.motivo === 'sin_stock') {
        if (!esCarrito) return rechazo('sin_stock', mensajeSinStockSimple(r.faltantes[0].stockDisponible));
        return {
          ...rechazo('sin_stock', mensajeSinStockCarrito(r.faltantes)),
          faltantes: r.faltantes.map((f) => ({
            codigo: f.codigo,
            medicamento: f.nombre,
            stockDisponible: f.stockDisponible,
          })),
        };
      }
      return esCarrito ? rechazo('no_existe', MENSAJES.no_existe_en_carrito) : rechazo(r.motivo);
    },
  };
}
