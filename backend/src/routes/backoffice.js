import { Router } from 'express';
import { noImplementado } from '../services/noImplementado.js';

// US-13 Mantener stock (#2). El token simulado (header x-backoffice-token) se valida en esa historia.
export function crearRutasBackoffice() {
  const router = Router();
  router.get('/backoffice/medicamentos', noImplementado);
  router.put('/backoffice/medicamentos/:codigo', noImplementado);
  return router;
}
