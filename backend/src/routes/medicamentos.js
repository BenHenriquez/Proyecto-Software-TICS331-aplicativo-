import { Router } from 'express';
import { noImplementado } from '../services/noImplementado.js';

// US-02 Consultar medicamento (#1).
export function crearRutasMedicamentos() {
  const router = Router();
  router.get('/medicamentos', noImplementado);
  return router;
}
