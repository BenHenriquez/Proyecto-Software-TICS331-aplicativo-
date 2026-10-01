import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { abrirDb, borrarDb } from '../src/repositories/db.js';
import { crearApp } from '../src/app.js';

// #14 Pruebas de US-13 · Mantener stock: un test por escenario Gherkin del issue #2
// (docs/sprint-1/META_Y_BACKLOG.md §1.3), vistos de punta a punta: lo que cambia la funcionaria
// por el backoffice es lo que ve la vecina en la búsqueda de US-02.
const TOKEN = 'token-de-prueba';
const ejecutar = promisify(execFile);
const comprador = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers', 'compradorParalelo.js');
const TIEMPO_MAXIMO = 30_000;

describe('US-13 · Mantener stock (de punta a punta con la búsqueda de US-02)', () => {
  let db;
  let app;
  const buscar = (q) => request(app).get('/api/medicamentos').query({ q });
  const enBusqueda = async (q, codigo) => (await buscar(q)).body.resultados.find((m) => m.codigo === codigo);
  const actualizar = (codigo, cuerpo) =>
    request(app).put(`/api/backoffice/medicamentos/${codigo}`).set('x-backoffice-token', TOKEN).send(cuerpo);
  const fila = (codigo) => db.prepare('SELECT * FROM medicamentos WHERE codigo = ?').get(codigo);

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db, tokenBackoffice: TOKEN });
  });

  describe('Escenario feliz: el nuevo valor queda persistido y aparece de inmediato en la búsqueda', () => {
    it('precio: la funcionaria lo cambia y la vecina ve el precio nuevo, por nombre y por principio activo', async () => {
      // Dado que Losartán se ve en la búsqueda con su precio actual
      expect((await enBusqueda('Losartán', 'MED-001')).precioUnitario).toBe(1990);

      // Cuando la funcionaria actualiza el precio y confirma el cambio
      const res = await actualizar('MED-001', { precioUnitario: 2500 });

      // Entonces el nuevo valor queda persistido
      expect(res.status).toBe(200);
      expect(fila('MED-001').precio_unitario).toBe(2500);
      // Y aparece de inmediato en la búsqueda, sin reiniciar nada
      expect((await enBusqueda('Losartán', 'MED-001')).precioUnitario).toBe(2500);
      expect((await enBusqueda('losartan potasico', 'MED-001')).precioUnitario).toBe(2500);
    });

    it('stock: la funcionaria lo cambia y la vecina ve el stock nuevo', async () => {
      expect((await enBusqueda('Losartán', 'MED-001')).stock).toBe(120);

      const res = await actualizar('MED-001', { stock: 35 });

      expect(res.status).toBe(200);
      expect(fila('MED-001').stock).toBe(35);
      expect(await enBusqueda('Losartán', 'MED-001')).toMatchObject({ stock: 35, disponible: true });
    });

    it('stock en 0: el medicamento pasa a «no disponible» en la búsqueda', async () => {
      expect((await enBusqueda('Losartán', 'MED-001')).disponible).toBe(true);

      await actualizar('MED-001', { stock: 0 });

      expect(await enBusqueda('Losartán', 'MED-001')).toMatchObject({ stock: 0, disponible: false });
    });

    it('reponer stock: un medicamento sin stock vuelve a estar disponible en la búsqueda', async () => {
      const { nombre } = fila('MED-014');
      expect(fila('MED-014').stock).toBe(0);
      expect(await enBusqueda(nombre, 'MED-014')).toMatchObject({ stock: 0, disponible: false });

      const res = await actualizar('MED-014', { stock: 8 });

      expect(res.status).toBe(200);
      expect(await enBusqueda(nombre, 'MED-014')).toMatchObject({ stock: 8, disponible: true });
    });

    it('precio y stock a la vez se ven juntos en la búsqueda', async () => {
      await actualizar('MED-001', { precioUnitario: 2100, stock: 10 });

      expect(await enBusqueda('Losartán', 'MED-001')).toMatchObject({ precioUnitario: 2100, stock: 10 });
    });

    it('solo cambia el medicamento editado: el resto del catálogo se ve igual', async () => {
      const antes = (await enBusqueda('Losartán', 'MED-002')).precioUnitario;

      await actualizar('MED-001', { precioUnitario: 2500 });

      expect((await enBusqueda('Losartán', 'MED-002')).precioUnitario).toBe(antes);
    });
  });

  describe('Escenario de error: valor inválido, el sistema rechaza, informa el motivo y mantiene el anterior', () => {
    it.each([
      ['stock negativo', { stock: -1 }, 'stock'],
      ['stock decimal', { stock: 2.5 }, 'stock'],
      ['stock no numérico', { stock: 'abc' }, 'stock'],
      ['precio vacío', { precioUnitario: '' }, 'precioUnitario'],
      ['precio no numérico', { precioUnitario: 'abc' }, 'precioUnitario'],
      ['precio cero', { precioUnitario: 0 }, 'precioUnitario'],
      ['precio enorme', { precioUnitario: 1e308 }, 'precioUnitario'],
    ])('con %s: responde con el motivo y la búsqueda sigue mostrando el valor anterior', async (_caso, cuerpo, campo) => {
      // Dado que Losartán se ve con precio 1990 y stock 120
      const antes = await enBusqueda('Losartán', 'MED-001');
      expect(antes).toMatchObject({ precioUnitario: 1990, stock: 120 });

      // Cuando la funcionaria ingresa un valor inválido e intenta guardar
      const res = await actualizar('MED-001', cuerpo);

      // Entonces el sistema rechaza el cambio e informa el motivo
      expect(res.status).toBe(400);
      expect(res.body.mensaje).toBeTypeOf('string');
      expect(res.body.errores[campo]).toBeTypeOf('string');
      // Y mantiene el valor anterior sin modificar, en la base y en lo que ve la vecina
      expect(fila('MED-001')).toMatchObject({ precio_unitario: 1990, stock: 120, version: 0 });
      expect(await enBusqueda('Losartán', 'MED-001')).toEqual(antes);
    });
  });

  describe('Cambios mientras ocurren ventas', () => {
    const comprar = (codigo, cantidad) => request(app).post('/api/pedidos').send({ codigo, cantidad });

    it('un pedido conserva el precio con que se compró aunque después cambie el precio', async () => {
      const antes = await comprar('MED-001', 1);
      expect(antes.body.pedido).toMatchObject({ precioUnitario: 1990, total: 1990 });

      await actualizar('MED-001', { precioUnitario: 2500 });
      const despues = await comprar('MED-001', 2);

      expect(despues.body.pedido).toMatchObject({ precioUnitario: 2500, total: 5000 });
      const anterior = db.prepare('SELECT precio_unitario, total FROM pedidos WHERE numero_pedido = ?').get(antes.body.pedido.numeroPedido);
      expect(anterior).toEqual({ precio_unitario: 1990, total: 1990 });
    });

    it('la venta descuenta del stock que dejó la actualización, y la búsqueda muestra el resultado final', async () => {
      await actualizar('MED-001', { stock: 10 });

      await comprar('MED-001', 4);

      expect(await enBusqueda('Losartán', 'MED-001')).toMatchObject({ stock: 6, disponible: true });
    });

    // Contrato de #12 (Vicenlol09), según MODELO_DE_DATOS.md §5. Hoy el PUT fija el stock sin mirar
    // `version`, así que una actualización hecha con datos viejos PISA la venta (se pierden 2 unidades).
    // Se activa con #12: quitar `.skip`. Si #12 elige el ajuste relativo ("sumar 5"), se cambia
    // §5 y este test en el mismo PR.
    it.skip('una actualización con una versión vieja se rechaza con 409 y no pisa la venta (se activa con #12)', async () => {
      // Dado que la funcionaria abrió el panel con MED-001 en stock 120, version 0
      const { version } = fila('MED-001');
      expect(version).toBe(0);

      // Y que mientras edita se confirma una venta de 2 unidades (stock 118, version 1)
      expect((await comprar('MED-001', 2)).status).toBe(201);
      expect(fila('MED-001')).toMatchObject({ stock: 118, version: 1 });

      // Cuando guarda su cambio con la versión que leyó
      const res = await actualizar('MED-001', { stock: 150, version });

      // Entonces se rechaza con el mensaje de §5 y el descuento de la venta no se pierde
      expect(res.status).toBe(409);
      expect(res.body.mensaje).toBe('El stock cambió mientras editabas. Recarga e intenta de nuevo.');
      expect(fila('MED-001')).toMatchObject({ stock: 118, version: 1 });
    });
  });
});

// Procesos de Node distintos con su propia conexión a SQLite, como en las pruebas de US-15:
// la actualización del backoffice y las compras chocan de verdad por el candado de escritura.
describe('US-13 · Actualización a la vez que varias vecinas compran (conexiones independientes)', () => {
  let dir;
  let rutaDb;
  let db;
  let servidor;
  let url;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'farmacia-mantencion-'));
    rutaDb = path.join(dir, 'farmacia.db');
    sembrar({ rutaDb, rutaCsv: config.rutaSemilla }).db.close();
    db = abrirDb(rutaDb);
    servidor = crearApp({ db, tokenBackoffice: TOKEN }).listen(0);
    await new Promise((resolve) => servidor.once('listening', resolve));
    url = `http://127.0.0.1:${servidor.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => servidor.close(resolve));
    db.close();
    borrarDb(rutaDb);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it(
    'cambiar el precio justo cuando 6 vecinas compran no pisa el stock y no produce errores',
    async () => {
      const inicio = Date.now() + 2000;

      // 6 procesos compran 1 unidad de MED-001 en el instante `inicio`...
      const compras = Array.from({ length: 6 }, () =>
        ejecutar(process.execPath, [comprador, rutaDb, 'MED-001', '1', String(inicio)])
      );
      // ...y en ese mismo instante la funcionaria cambia el precio por el backoffice.
      const cambioDePrecio = (async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, inicio - Date.now())));
        const res = await fetch(`${url}/api/backoffice/medicamentos/MED-001`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-backoffice-token': TOKEN },
          body: JSON.stringify({ precioUnitario: 2500 }),
        });
        return res.status;
      })();

      const [estadoDelCambio, ...resultados] = await Promise.all([
        cambioDePrecio,
        ...compras.map((c) => c.then(({ stdout }) => JSON.parse(stdout))),
      ]);

      // Nada falla: ni el cambio ni ninguna compra (hay stock de sobra)
      expect(estadoDelCambio).toBe(200);
      expect(resultados.every((r) => r.ok)).toBe(true);
      // El cambio de precio no tocó el stock: se descontaron exactamente las 6 unidades vendidas
      const final = db.prepare('SELECT precio_unitario, stock, version FROM medicamentos WHERE codigo = ?').get('MED-001');
      expect(final).toEqual({ precio_unitario: 2500, stock: 114, version: 7 }); // 1 cambio + 6 ventas
      // Cada pedido quedó con el precio vigente cuando se compró, y su total cuadra
      const pedidos = db.prepare('SELECT cantidad, precio_unitario, total FROM pedidos').all();
      expect(pedidos).toHaveLength(6);
      for (const p of pedidos) {
        expect([1990, 2500]).toContain(p.precio_unitario);
        expect(p.total).toBe(p.cantidad * p.precio_unitario);
      }
    },
    TIEMPO_MAXIMO
  );

  it(
    'cambiar el stock a la vez que se vende el mismo medicamento nunca deja stock negativo ni errores',
    async () => {
      const inicio = Date.now() + 2000;
      const compras = Array.from({ length: 6 }, () =>
        ejecutar(process.execPath, [comprador, rutaDb, 'PRB-002', '1', String(inicio)])
      );
      const cambioDeStock = (async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, inicio - Date.now())));
        const res = await fetch(`${url}/api/backoffice/medicamentos/PRB-002`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-backoffice-token': TOKEN },
          body: JSON.stringify({ stock: 3 }),
        });
        return res.status;
      })();

      const [estadoDelCambio, ...resultados] = await Promise.all([
        cambioDeStock,
        ...compras.map((c) => c.then(({ stdout }) => JSON.parse(stdout))),
      ]);

      expect(estadoDelCambio).toBe(200);
      // Cada compra se confirma o se rechaza por falta de stock; ninguna falla de otra forma
      expect(resultados.every((r) => r.ok || r.motivo === 'sin_stock')).toBe(true);
      const { stock } = db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get('PRB-002');
      expect(stock).toBeGreaterThanOrEqual(0);
      // Los pedidos confirmados nunca superan lo que había disponible en total
      const vendidas = resultados.filter((r) => r.ok).length;
      expect(vendidas).toBeLessThanOrEqual(2 + 3); // stock inicial 2 + el que repuso la funcionaria (3)
    },
    TIEMPO_MAXIMO
  );
});
