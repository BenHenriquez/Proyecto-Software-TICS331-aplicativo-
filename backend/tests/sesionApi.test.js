import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';
import { crearProveedorSimulado } from '../src/proveedores/identidadSimulada.js';
import { crearNeuronFalso, identidadNeuron } from './helpers/neuronFalso.js';

// #46 Backend de Quick Login: contrato y seguridad de /api/sesion (MODELO_DE_DATOS.md §3).
describe('/api/sesion', () => {
  let db;
  let app;
  let neuron;
  let reloj;

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    neuron = crearNeuronFalso();
    reloj = new Date('2026-10-08T12:00:00Z');
    app = crearApp({ db, proveedorIdentidad: neuron, ahora: () => reloj });
  });

  afterEach(() => vi.restoreAllMocks());

  const callback = (cuerpo) => request(app).post('/api/sesion/callback').send(cuerpo);
  const cookiesDe = (res) => res.headers['set-cookie'] ?? [];
  const valorCookie = (res, nombre) =>
    cookiesDe(res)
      .find((c) => c.startsWith(`${nombre}=`))
      ?.split(';')[0]
      .slice(nombre.length + 1);

  async function pedirQr() {
    const navegador = request.agent(app);
    const res = await navegador.post('/api/sesion/qr');
    return { navegador, res, secreto: neuron.ultimoSecreto };
  }

  describe('POST /api/sesion/qr', () => {
    it('responde 201 con el QR y deja la llave del intento solo en una cookie httpOnly', async () => {
      const { res, secreto } = await pedirQr();

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        modo: 'neuron',
        qr: { contentType: 'image/png', base64: 'iVBORw0KGgo=' },
        enlace: 'tagsign:neuron.falso,abc',
        venceEn: '2026-10-08T12:05:00.000Z',
      });
      const cookie = cookiesDe(res).find((c) => c.startsWith('farmacia_ingreso='));
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      // Dura más que el código (5 min) para que, al vencer, el backend responda "vencido" y no "sin_intento".
      expect(cookie).toMatch(/Max-Age=900/);
      // El secreto para el Neuron nunca viaja al navegador.
      expect(JSON.stringify(res.body)).not.toContain(secreto);
      expect(cookie).not.toContain(secreto);
    });

    it('guarda solo hashes de la llave y del secreto', async () => {
      const { res, secreto } = await pedirQr();
      const fila = db.prepare('SELECT * FROM intentos_ingreso').get();
      expect(fila.estado).toBe('pendiente');
      expect(JSON.stringify(fila)).not.toContain(secreto);
      expect(JSON.stringify(fila)).not.toContain(valorCookie(res, 'farmacia_ingreso'));
    });

    it('responde 502 con un mensaje simple si el Neuron no responde', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      neuron.falla = true;
      const res = await request(app).post('/api/sesion/qr');
      expect(res.status).toBe(502);
      expect(res.body).toEqual({
        motivo: 'proveedor_no_disponible',
        mensaje: 'No pudimos crear tu código para ingresar. Inténtalo de nuevo en un momento.',
      });
      expect(cookiesDe(res)).toEqual([]);
    });
  });

  describe('GET /api/sesion/qr', () => {
    it('sin cookie de intento responde sin_intento', async () => {
      const res = await request(app).get('/api/sesion/qr');
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('sin_intento');
    });

    it('mientras nadie aprueba responde pendiente con la hora de vencimiento', async () => {
      const { navegador } = await pedirQr();
      const res = await navegador.get('/api/sesion/qr');
      expect(res.body).toEqual({ estado: 'pendiente', venceEn: '2026-10-08T12:05:00.000Z' });
    });

    it('al aprobarse entrega la sesión solo en cookie httpOnly y canjea el intento una sola vez', async () => {
      const { navegador, res: qr, secreto } = await pedirQr();
      await callback(identidadNeuron(secreto)).expect(200);

      const res = await navegador.get('/api/sesion/qr');
      expect(res.body).toEqual({ estado: 'aprobado', vecino: { nombre: 'Rosa' } });
      const cookieSesion = cookiesDe(res).find((c) => c.startsWith('farmacia_sesion='));
      expect(cookieSesion).toMatch(/HttpOnly/);
      expect(JSON.stringify(res.body)).not.toContain(valorCookie(res, 'farmacia_sesion'));

      // Repetir la consulta con la misma llave no crea otra sesión.
      const llave = valorCookie(qr, 'farmacia_ingreso');
      const otra = await request(app).get('/api/sesion/qr').set('Cookie', `farmacia_ingreso=${llave}`);
      expect(otra.body.estado).toBe('sin_intento');
      expect(db.prepare('SELECT COUNT(*) AS n FROM sesiones').get().n).toBe(1);
    });
  });

  describe('POST /api/sesion/callback (lo llama el Neuron)', () => {
    it('rechaza con 400 un cuerpo sin SessionId', async () => {
      const res = await callback({ Id: 'x', State: 'Approved' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ motivo: 'datos_invalidos' });
    });

    it('rechaza con 409 un secreto inventado y no crea vecinos', async () => {
      await pedirQr();
      const res = await callback(identidadNeuron('secreto-inventado'));
      expect(res.status).toBe(409);
      expect(db.prepare('SELECT COUNT(*) AS n FROM vecinos').get().n).toBe(0);
    });

    it('rechaza con 409 una aprobación repetida (el secreto es de un solo uso)', async () => {
      const { secreto } = await pedirQr();
      await callback(identidadNeuron(secreto)).expect(200);
      const res = await callback(identidadNeuron(secreto, { Id: 'otra-persona@legal.neuron.falso' }));
      expect(res.status).toBe(409);
      expect(db.prepare('SELECT identidad_id FROM vecinos').pluck().all()).toEqual([
        '2c9f1e7a-prueba@legal.neuron.falso',
      ]);
    });

    it.each([
      ['no aprobada', { State: 'Created' }],
      ['vencida', { To: 1767225600 }],
      ['sin Id', { Id: '' }],
    ])('si la identidad está %s no inicia sesión y el navegador ve "rechazado"', async (_caso, cambios) => {
      const { navegador, secreto } = await pedirQr();
      const res = await callback(identidadNeuron(secreto, cambios));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ motivo: 'identidad_no_aprobada' });

      const estado = await navegador.get('/api/sesion/qr');
      expect(estado.body.estado).toBe('rechazado');
      expect(estado.body.mensaje).toMatch(/Neuro-Access/);
      expect((await navegador.get('/api/sesion')).body).toEqual({ vecino: null });
    });

    it('acepta el JSON aunque el Neuron no envíe Content-Type application/json', async () => {
      const { secreto } = await pedirQr();
      const res = await request(app)
        .post('/api/sesion/callback')
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify(identidadNeuron(secreto)));
      expect(res.status).toBe(200);
    });

    it('si la identidad no trae nombre de pila, saluda como "vecino"', async () => {
      const { navegador, secreto } = await pedirQr();
      await callback(identidadNeuron(secreto, { Properties: { COUNTRY: 'CL' } })).expect(200);
      expect((await navegador.get('/api/sesion/qr')).body).toEqual({ estado: 'aprobado', vecino: { nombre: 'vecino' } });
    });

    it('si el mismo vecino vuelve a ingresar, reutiliza su registro', async () => {
      for (let i = 0; i < 2; i++) {
        const { secreto } = await pedirQr();
        await callback(identidadNeuron(secreto)).expect(200);
      }
      expect(db.prepare('SELECT COUNT(*) AS n FROM vecinos').get().n).toBe(1);
    });

    it('nunca escribe datos de la identidad en los logs', async () => {
      const espias = ['log', 'info', 'warn', 'error'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
      const { secreto } = await pedirQr();
      await callback(identidadNeuron(secreto));
      await callback(identidadNeuron('inventado'));
      await request(app).post('/api/sesion/callback').set('Content-Type', 'application/json').send('{"PNR":"11.111.111-1"');

      const escrito = JSON.stringify(espias.flatMap((e) => e.mock.calls));
      expect(escrito).not.toContain('11.111.111-1');
      expect(escrito).not.toContain('Rosa');
    });
  });

  describe('sesión', () => {
    async function conSesion() {
      const { navegador, secreto } = await pedirQr();
      await callback(identidadNeuron(secreto));
      const res = await navegador.get('/api/sesion/qr');
      return { navegador, token: valorCookie(res, 'farmacia_sesion') };
    }

    it('vence a las 8 horas', async () => {
      const { navegador } = await conSesion();
      reloj = new Date(reloj.getTime() + 8 * 3_600_000);
      expect((await navegador.get('/api/sesion')).body).toEqual({ vecino: null });
    });

    it('un token inventado no da sesión', async () => {
      const res = await request(app).get('/api/sesion').set('Cookie', 'farmacia_sesion=inventado');
      expect(res.body).toEqual({ vecino: null });
    });

    it('después de salir, el token anterior ya no sirve', async () => {
      const { navegador, token } = await conSesion();
      await navegador.post('/api/sesion/cerrar').expect(200);
      const res = await request(app).get('/api/mis-pedidos').set('Cookie', `farmacia_sesion=${token}`);
      expect(res.status).toBe(401);
    });

    it('un carrito (US-16) confirmado con sesión queda a su nombre con todos sus ítems', async () => {
      const { navegador } = await conSesion();
      const compra = await navegador.post('/api/pedidos').send({
        items: [
          { codigo: 'MED-001', cantidad: 1 },
          { codigo: 'MED-003', cantidad: 2 },
        ],
      });
      expect(compra.status).toBe(201);

      const mis = await navegador.get('/api/mis-pedidos');
      expect(mis.body.pedidos).toHaveLength(1);
      expect(mis.body.pedidos[0].numeroPedido).toBe(compra.body.pedido.numeroPedido);
      expect(mis.body.pedidos[0].items.map((i) => [i.codigo, i.cantidad])).toEqual([
        ['MED-001', 1],
        ['MED-003', 2],
      ]);
      expect(mis.body.pedidos[0].total).toBe(compra.body.pedido.total);
    });

    it('el vecino del pedido sale de la sesión, nunca del cuerpo enviado', async () => {
      const res = await request(app).post('/api/pedidos').send({ codigo: 'MED-001', cantidad: 1, vecinoId: 1 });
      expect(res.status).toBe(201);
      const fila = db.prepare('SELECT vecino_id FROM pedidos WHERE numero_pedido = ?').get(res.body.pedido.numeroPedido);
      expect(fila.vecino_id).toBeNull();
    });
  });

  describe('POST /api/sesion/qr/simular', () => {
    it('con el proveedor del Neuron no existe (404)', async () => {
      const { navegador } = await pedirQr();
      const res = await navegador.post('/api/sesion/qr/simular');
      expect(res.status).toBe(404);
    });

    it('con el proveedor simulado aprueba el intento de este navegador con la vecina ficticia', async () => {
      app = crearApp({ db, proveedorIdentidad: crearProveedorSimulado(), ahora: () => reloj });
      const navegador = request.agent(app);
      const qr = await navegador.post('/api/sesion/qr');
      expect(qr.body).toMatchObject({ modo: 'simulado', qr: null, enlace: null });

      await navegador.post('/api/sesion/qr/simular').expect(200);
      expect((await navegador.get('/api/sesion/qr')).body).toEqual({ estado: 'aprobado', vecino: { nombre: 'Rosa' } });
      // Sin la cookie del intento no se puede simular por otro navegador.
      expect((await request(app).post('/api/sesion/qr/simular')).status).toBe(409);
    });
  });
});
