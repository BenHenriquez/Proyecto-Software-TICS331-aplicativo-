import { Router } from 'express';
import { requiereTokenBackoffice } from '../middleware/requiereTokenBackoffice.js';
import { crearMedicamentosRepository } from '../repositories/medicamentosRepository.js';
import { crearBackofficeService } from '../services/backofficeService.js';
import { noImplementado } from '../services/noImplementado.js';

// US-13 Mantener stock (#2). El token simulado (header x-backoffice-token) protege el PUT;
// el listado del panel (GET) lo implementa #13 y debe usar el mismo middleware.
const ESTADO_HTTP = { datos_invalidos: 400, no_existe: 404, version_cambiada: 409 };

export function crearRutasBackoffice() {
  const router = Router();
  let servicio;

  router.get('/backoffice/medicamentos', noImplementado);

  router.put('/backoffice/medicamentos/:codigo', requiereTokenBackoffice, (req, res) => {
    // Se arma en la primera petición sobre la db que crearApp dejó en app.locals.
    servicio ??= crearBackofficeService(crearMedicamentosRepository(req.app.locals.db));

    const r = servicio.actualizarMedicamento(req.params.codigo, req.body);
    if (r.ok) return res.status(200).json({ medicamento: r.medicamento });

    const cuerpo = { motivo: r.motivo, mensaje: r.mensaje };
    if (r.errores) cuerpo.errores = r.errores;
    res.status(ESTADO_HTTP[r.motivo]).json(cuerpo);
  });

  return router;
}
