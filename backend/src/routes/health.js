import { Router } from 'express';

export function crearRutasHealth() {
  const router = Router();
  router.get('/health', (_req, res) => res.json({ ok: true }));
  return router;
}
