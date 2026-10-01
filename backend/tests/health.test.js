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
