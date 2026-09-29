import { Router } from 'express';
import { noImplementado } from '../services/noImplementado.js';

// US-15 Realizar compra/pedido (#3).
export function crearRutasPedidos() {
  const router = Router();
  router.post('/pedidos', noImplementado);
  return router;
}
