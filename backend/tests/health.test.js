import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { abrirDb } from '../src/repositories/db.js';

describe('GET /api/health', () => {
  it('responde 200 con { ok: true }', async () => {
    const app = crearApp({ db: abrirDb(':memory:') });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('endpoints del Sprint 1 aún como esqueleto', () => {
  const app = crearApp({ db: abrirDb(':memory:') });

  it.each([
    ['get', '/api/medicamentos?q=losartan'],
    ['get', '/api/backoffice/medicamentos'],
  ])('%s %s responde 501 con mensaje en español', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta);
    expect(res.status).toBe(501);
    expect(res.body.motivo).toBe('no_implementado');
    expect(typeof res.body.mensaje).toBe('string');
  });
});
