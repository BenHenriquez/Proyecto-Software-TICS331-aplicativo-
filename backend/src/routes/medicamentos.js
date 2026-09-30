import { Router } from 'express';
import { crearMedicamentosRepository } from '../repositories/medicamentosRepository.js';
import { crearMedicamentosService } from '../services/medicamentosService.js';

// US-02 Consultar medicamento (#1).
export function crearRutasMedicamentos() {
  const router = Router();
  let servicio;

  router.get('/medicamentos', (req, res) => {
    // Se arma en la primera petición sobre la db que crearApp dejó en app.locals.
    servicio ??= crearMedicamentosService(crearMedicamentosRepository(req.app.locals.db));

    const r = servicio.buscar(req.query.q);
    if (!r.ok) return res.status(400).json({ motivo: r.motivo, mensaje: r.mensaje });

    const cuerpo = { resultados: r.resultados };
    if (r.mensaje) cuerpo.mensaje = r.mensaje;
    res.status(200).json(cuerpo);
  });

  return router;
}
