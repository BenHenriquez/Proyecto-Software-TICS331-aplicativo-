import { Router } from 'express';
import { crearPedidosRepository } from '../repositories/pedidosRepository.js';
import { crearPedidosService } from '../services/pedidosService.js';

// US-15 Realizar compra/pedido (#3) y US-16 Carrito (#42): una misma ruta para un medicamento
// ({ codigo, cantidad }) o para varios ({ items: [{ codigo, cantidad }] }).
const ESTADO_HTTP = {
  cantidad_invalida: 400,
  carrito_vacio: 400,
  carrito_invalido: 400,
  demasiados_items: 400,
  no_existe: 404,
  sin_stock: 409,
};

export function crearRutasPedidos() {
  const router = Router();
  let servicio;

  router.post('/pedidos', (req, res) => {
    // Se arma en la primera petición sobre la db que crearApp dejó en app.locals.
    servicio ??= crearPedidosService(crearPedidosRepository(req.app.locals.db));

    const { codigo, cantidad, items, alias } = req.body ?? {};
    const r = servicio.confirmarPedido({ codigo, cantidad, items, alias });
    if (r.ok) return res.status(201).json({ pedido: r.pedido });

    const cuerpo = { motivo: r.motivo, mensaje: r.mensaje };
    if (r.faltantes) cuerpo.faltantes = r.faltantes;
    if (r.noDisponibles) cuerpo.noDisponibles = r.noDisponibles;
    res.status(ESTADO_HTTP[r.motivo]).json(cuerpo);
  });

  return router;
}
