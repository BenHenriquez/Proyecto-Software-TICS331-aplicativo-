import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';

// #13 Panel de mantención (US-13, #2): el listado que ve la funcionaria en el panel,
// GET /api/backoffice/medicamentos (MODELO_DE_DATOS.md §3). Trae la `version` de cada medicamento,
// que el panel devuelve al guardar (candado de #12).
const TOKEN = 'token-de-prueba';

describe('GET /api/backoffice/medicamentos', () => {
  let db;
  let app;
  const listar = (opciones = {}) => {
    const token = 'token' in opciones ? opciones.token : TOKEN;
    const peticion = request(app).get('/api/backoffice/medicamentos');
    if (token !== undefined) peticion.set('x-backoffice-token', token);
    return peticion;
  };
  const enLista = async (codigo) => (await listar()).body.medicamentos.find((m) => m.codigo === codigo);

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db, tokenBackoffice: TOKEN });
  });

  describe('token simulado del backoffice', () => {
    it.each([
      ['no se envía', undefined],
      ['es incorrecto', 'otro-token'],
      ['está vacío', ''],
    ])('responde 401 y no muestra el catálogo si el token %s', async (_caso, token) => {
      const res = await listar({ token });

      expect(res.status).toBe(401);
      expect(res.body.motivo).toBe('no_autorizado');
      expect(typeof res.body.mensaje).toBe('string');
      expect(res.body.medicamentos).toBeUndefined();
    });

    it('si el servidor no tiene token configurado, ningún encabezado autoriza', async () => {
      app = crearApp({ db, tokenBackoffice: '' });

      for (const token of ['', 'cualquiera', undefined]) {
        expect((await listar({ token })).status).toBe(401);
      }
    });
  });

  describe('con el token correcto', () => {
    it('responde 200 con todos los medicamentos activos de la semilla', async () => {
      const res = await listar();

      expect(res.status).toBe(200);
      expect(res.body.medicamentos).toHaveLength(34);
    });

    it('cada medicamento trae precio, stock y la version que el panel devolverá al guardar', async () => {
      const losartan = await enLista('MED-001');

      expect(losartan).toEqual({
        codigo: 'MED-001',
        nombre: 'Losartán 50 mg',
        principioActivo: 'Losartán potásico',
        presentacion: 'Caja 30 comprimidos',
        precioUnitario: 1990,
        stock: 120,
        disponible: true,
        version: 0,
      });
    });

    it('no expone campos internos (búsqueda normalizada, categoría, activo)', async () => {
      const { medicamentos } = (await listar()).body;

      for (const m of medicamentos) {
        expect(Object.keys(m).sort()).toEqual(
          ['codigo', 'disponible', 'nombre', 'precioUnitario', 'presentacion', 'principioActivo', 'stock', 'version'].sort()
        );
      }
    });

    it('incluye los medicamentos sin stock, marcados como no disponibles', async () => {
      expect(await enLista('MED-014')).toMatchObject({ stock: 0, disponible: false });
    });

    it('va ordenado por nombre, sin distinguir mayúsculas ni tildes, para que la funcionaria lo encuentre', async () => {
      const sinTildes = (texto) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      const nombres = (await listar()).body.medicamentos.map((m) => sinTildes(m.nombre));

      expect(nombres).toEqual([...nombres].sort());
    });

    it('no muestra los medicamentos inactivos', async () => {
      db.prepare("UPDATE medicamentos SET activo = 0 WHERE codigo = 'MED-001'").run();

      const res = await listar();

      expect(res.body.medicamentos).toHaveLength(33);
      expect(await enLista('MED-001')).toBeUndefined();
    });

    it('listar no cambia nada en la base', async () => {
      const catalogo = () => db.prepare('SELECT * FROM medicamentos ORDER BY codigo').all();
      const antes = catalogo();

      await listar();

      expect(catalogo()).toEqual(antes);
    });
  });

  describe('refleja al instante lo que pasa con cada medicamento', () => {
    it('un cambio hecho por el PUT aparece en el listado con la version nueva', async () => {
      await request(app)
        .put('/api/backoffice/medicamentos/MED-001')
        .set('x-backoffice-token', TOKEN)
        .send({ precioUnitario: 2500, stock: 35, version: 0 })
        .expect(200);

      expect(await enLista('MED-001')).toMatchObject({ precioUnitario: 2500, stock: 35, version: 1 });
    });

    it('una venta baja el stock y sube la version en el listado', async () => {
      await request(app).post('/api/pedidos').send({ codigo: 'MED-001', cantidad: 2 }).expect(201);

      expect(await enLista('MED-001')).toMatchObject({ stock: 118, version: 1 });
    });

    it('la version del listado sirve para guardar, y una version vieja da 409', async () => {
      const { version } = await enLista('MED-001');
      await request(app).post('/api/pedidos').send({ codigo: 'MED-001', cantidad: 1 }).expect(201);
      const guardar = (v) =>
        request(app).put('/api/backoffice/medicamentos/MED-001').set('x-backoffice-token', TOKEN).send({ stock: 50, version: v });

      expect((await guardar(version)).status).toBe(409);
      expect((await guardar((await enLista('MED-001')).version)).status).toBe(200);
    });
  });
});
