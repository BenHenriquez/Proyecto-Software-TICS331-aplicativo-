import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';
import { crearNeuronFalso, identidadNeuron } from './helpers/neuronFalso.js';

// #49 Pruebas funcionales de US-17: un test por escenario Gherkin del issue #43.
describe('US-17 · Ingreso con Neuro-Access', () => {
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

  const adelantarMinutos = (minutos) => {
    reloj = new Date(reloj.getTime() + minutos * 60_000);
  };

  // Navegador que pide el QR y espera a que el vecino apruebe en la app.
  async function ingresar(cambiosIdentidad) {
    const navegador = request.agent(app);
    await navegador.post('/api/sesion/qr').expect(201);
    await request(app).post('/api/sesion/callback').send(identidadNeuron(neuron.ultimoSecreto, cambiosIdentidad));
    const res = await navegador.get('/api/sesion/qr');
    return { navegador, res };
  }

  it('Escenario feliz: al escanear y aprobar en la app, el sitio lo saluda sin usuario ni clave', async () => {
    // Dado que el vecino está en "Ingresar" y ve el QR
    const navegador = request.agent(app);
    const qr = await navegador.post('/api/sesion/qr');
    expect(qr.status).toBe(201);
    expect(qr.body.qr.base64).toBeTruthy();

    // Cuando lo escanea y aprueba la solicitud en Neuro-Access (el Neuron llama al callback)
    const callback = await request(app).post('/api/sesion/callback').send(identidadNeuron(neuron.ultimoSecreto));
    expect(callback.status).toBe(200);

    // Entonces el sitio lo saluda por su nombre, sin haber escrito usuario ni clave
    const estado = await navegador.get('/api/sesion/qr');
    expect(estado.body).toEqual({ estado: 'aprobado', vecino: { nombre: 'Rosa' } });
    const sesion = await navegador.get('/api/sesion');
    expect(sesion.body).toEqual({ vecino: { nombre: 'Rosa' } });

    // Y de su identidad solo se guardó el Id y el nombre de pila (nada de RUT/PNR)
    expect(db.prepare('SELECT identidad_id, nombre FROM vecinos').all()).toEqual([
      { identidad_id: '2c9f1e7a-prueba@legal.neuron.falso', nombre: 'Rosa' },
    ]);
    const todo = JSON.stringify(db.prepare('SELECT * FROM vecinos').all());
    expect(todo).not.toContain('11.111.111-1');
    expect(todo).not.toContain('Pérez');
  });

  it('Escenario de error: si pasan 5 minutos sin aprobar, no inicia sesión y ofrece un código nuevo', async () => {
    // Dado que el vecino pidió el QR
    const navegador = request.agent(app);
    await navegador.post('/api/sesion/qr').expect(201);

    // Cuando pasan 5 minutos sin aprobarlo
    adelantarMinutos(5);

    // Entonces el código está vencido y el mensaje explica cómo obtener otro
    const estado = await navegador.get('/api/sesion/qr');
    expect(estado.body.estado).toBe('vencido');
    expect(estado.body.mensaje).toMatch(/venció.*Genera uno nuevo/);

    // Y aunque la aprobación llegue tarde, no se inicia sesión
    const tarde = await request(app).post('/api/sesion/callback').send(identidadNeuron(neuron.ultimoSecreto));
    expect(tarde.status).toBe(409);
    expect((await navegador.get('/api/sesion')).body).toEqual({ vecino: null });

    // Y un código nuevo sí funciona
    await navegador.post('/api/sesion/qr').expect(201);
    expect((await navegador.get('/api/sesion/qr')).body.estado).toBe('pendiente');
  });

  it('Escenario pedido a su nombre: con sesión el pedido aparece en "Mis pedidos"; sin sesión se compra igual', async () => {
    // Dado que el vecino ingresó
    const { navegador } = await ingresar();

    // Cuando confirma un pedido
    const compra = await navegador.post('/api/pedidos').send({ codigo: 'MED-001', cantidad: 2 });
    expect(compra.status).toBe(201);

    // Entonces aparece en "Mis pedidos" con número, medicamento, total y estado
    const mis = await navegador.get('/api/mis-pedidos');
    expect(mis.status).toBe(200);
    expect(mis.body.pedidos).toHaveLength(1);
    expect(mis.body.pedidos[0]).toMatchObject({
      numeroPedido: compra.body.pedido.numeroPedido,
      medicamento: 'Losartán 50 mg',
      total: compra.body.pedido.total,
      estado: 'Solicitud creada',
    });

    // Y si otra persona compra sin ingresar, puede hacerlo igual que antes y no aparece en su lista
    const anonima = await request(app).post('/api/pedidos').send({ codigo: 'MED-003', cantidad: 1 });
    expect(anonima.status).toBe(201);
    expect((await navegador.get('/api/mis-pedidos')).body.pedidos).toHaveLength(1);
    expect((await request(app).get('/api/mis-pedidos')).status).toBe(401);
  });

  it('Escenario salir: al presionar "Salir" la sesión termina y "Mis pedidos" vuelve a pedir el ingreso', async () => {
    // Dado que el vecino ingresó
    const { navegador } = await ingresar();
    expect((await navegador.get('/api/mis-pedidos')).status).toBe(200);

    // Cuando presiona "Salir"
    const salir = await navegador.post('/api/sesion/cerrar');
    expect(salir.status).toBe(200);

    // Entonces la sesión termina y "Mis pedidos" pide ingresar
    expect((await navegador.get('/api/sesion')).body).toEqual({ vecino: null });
    const mis = await navegador.get('/api/mis-pedidos');
    expect(mis.status).toBe(401);
    expect(mis.body).toEqual({
      motivo: 'sin_sesion',
      mensaje: 'Para ver tus pedidos, primero ingresa con tu app Neuro-Access.',
    });
  });
});
