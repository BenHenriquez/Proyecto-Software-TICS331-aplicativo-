// Acceso a la tabla pedidos. La compra atómica de US-15 (MODELO_DE_DATOS.md §4) se implementa aquí:
// UPDATE ... WHERE stock >= ? + INSERT del pedido en la misma transacción.
export function crearPedidosRepository(_db) {
  return {};
}
