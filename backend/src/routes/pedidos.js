import { Router } from 'express';
import { crearPedidosRepository } from '../repositories/pedidosRepository.js';
import { crearPedidosService } from '../services/pedidosService.js';
import { MENSAJES as MENSAJES_SESION } from '../services/sesionService.js';

// US-15 Realizar compra/pedido (#3) y US-16 Carrito (#42): una misma ruta para un medicamento
// ({ codigo, cantidad }) o para varios ({ items: [{ codigo, cantidad }] }). Con sesión de US-17 (#48),
// el pedido queda a nombre del vecino; req.vecino lo deja la ruta de sesión (routes/sesion.js).
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

  // Se arma en la primera petición sobre la db que crearApp dejó en app.locals.
  const servicioDe = (req) => (servicio ??= crearPedidosService(crearPedidosRepository(req.app.locals.db)));

  router.post('/pedidos', (req, res) => {
    const { codigo, cantidad, items, alias } = req.body ?? {};
    const r = servicioDe(req).confirmarPedido({
      codigo,
      cantidad,
      items,
      alias,
      vecinoId: req.vecino?.id ?? null,
    });
    if (r.ok) return res.status(201).json({ pedido: r.pedido });

    const cuerpo = { motivo: r.motivo, mensaje: r.mensaje };
    if (r.faltantes) cuerpo.faltantes = r.faltantes;
    if (r.noDisponibles) cuerpo.noDisponibles = r.noDisponibles;
    res.status(ESTADO_HTTP[r.motivo]).json(cuerpo);
  });

  router.get('/mis-pedidos', (req, res) => {
    if (!req.vecino) return res.status(401).json({ motivo: 'sin_sesion', mensaje: MENSAJES_SESION.sin_sesion });
    res.status(200).json({ pedidos: servicioDe(req).misPedidos(req.vecino.id) });
  });

  return router;
}
