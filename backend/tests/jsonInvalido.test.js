import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';

// Un cuerpo JSON mal formado responde 400 en español, no un 500 "error interno".
describe('cuerpo JSON mal formado', () => {
  const { db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla });
  const app = crearApp({ db, tokenBackoffice: 'token-de-prueba' });
  const malFormado = '{"stock": ';

  it('PUT del backoffice responde 400 y no cambia nada', async () => {
    const antes = db.prepare("SELECT stock, version FROM medicamentos WHERE codigo = 'MED-001'").get();
    const res = await request(app)
      .put('/api/backoffice/medicamentos/MED-001')
      .set('x-backoffice-token', 'token-de-prueba')
      .set('Content-Type', 'application/json')
      .send(malFormado);

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('solicitud_invalida');
    expect(typeof res.body.mensaje).toBe('string');
    expect(db.prepare("SELECT stock, version FROM medicamentos WHERE codigo = 'MED-001'").get()).toEqual(antes);
  });

  it('POST de pedidos responde 400 y no crea pedido', async () => {
    const res = await request(app).post('/api/pedidos').set('Content-Type', 'application/json').send(malFormado);

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('solicitud_invalida');
    expect(db.prepare('SELECT COUNT(*) AS n FROM pedidos').get().n).toBe(0);
  });
});
