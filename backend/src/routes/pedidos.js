import { Router } from 'express';
import { crearPedidosRepository } from '../repositories/pedidosRepository.js';
import { crearPedidosService } from '../services/pedidosService.js';

// US-15 Realizar compra/pedido (#3).
const ESTADO_HTTP = { cantidad_invalida: 400, no_existe: 404, sin_stock: 409 };

export function crearRutasPedidos() {
  const router = Router();
  let servicio;

  router.post('/pedidos', (req, res) => {
    // Se arma en la primera petición sobre la db que crearApp dejó en app.locals.
    servicio ??= crearPedidosService(crearPedidosRepository(req.app.locals.db));

    const { codigo, cantidad, alias } = req.body ?? {};
    const r = servicio.confirmarPedido({ codigo, cantidad, alias });
    if (r.ok) return res.status(201).json({ pedido: r.pedido });
    res.status(ESTADO_HTTP[r.motivo]).json({ motivo: r.motivo, mensaje: r.mensaje });
  });

  return router;
}
