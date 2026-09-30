import { describe, it, expect, vi } from 'vitest';
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

// Cualquier error del cliente que detecte Express (no solo el JSON roto) es 4xx, nunca "error interno".
describe('otras solicitudes que el servidor no puede leer', () => {
  const { db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla });
  const app = crearApp({ db, tokenBackoffice: 'token-de-prueba' });
  const conToken = (peticion) => peticion.set('x-backoffice-token', 'token-de-prueba');

  it('un cuerpo demasiado grande responde 413 con mensaje en español', async () => {
    const res = await conToken(request(app).put('/api/backoffice/medicamentos/MED-001')).send({
      stock: 1,
      relleno: 'x'.repeat(200_000),
    });

    expect(res.status).toBe(413);
    expect(res.body.motivo).toBe('solicitud_invalida');
    expect(res.body.mensaje).toMatch(/demasiado grande/i);
  });

  it('una dirección mal formada responde 400, no 500', async () => {
    const res = await conToken(request(app).put('/api/backoffice/medicamentos/%E0%A4%A')).send({ stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('solicitud_invalida');
  });

  it('una codificación de caracteres no soportada responde 415, no 500', async () => {
    const res = await conToken(request(app).put('/api/backoffice/medicamentos/MED-001'))
      .set('Content-Type', 'application/json; charset=latin9')
      .send('{"stock":1}');

    expect(res.status).toBe(415);
    expect(res.body.motivo).toBe('solicitud_invalida');
  });

  it('un error real del servidor sigue siendo 500 con mensaje cálido', async () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {});
    const appSinDb = crearApp({ db: undefined, tokenBackoffice: 'token-de-prueba' });
    const res = await request(appSinDb).post('/api/pedidos').send({ codigo: 'MED-001', cantidad: 1 });
    silencio.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.motivo).toBe('error_interno');
  });
});
