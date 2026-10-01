import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';
import { normalizarBusqueda } from '../src/services/medicamentosService.js';

// #7 Endpoint de búsqueda (US-02, #1): GET /api/medicamentos?q= (MODELO_DE_DATOS.md §3).
// Por nombre o principio activo, sin distinguir mayúsculas ni tildes y con coincidencia parcial.
describe('GET /api/medicamentos?q=', () => {
  let db;
  let app;
  const buscar = (q) => request(app).get('/api/medicamentos').query(q === undefined ? {} : { q });
  const codigos = (res) => res.body.resultados.map((m) => m.codigo);

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db });
  });

  it('devuelve los campos de cada resultado con los nombres del contrato', async () => {
    const res = await buscar('losartan 50');

    expect(res.status).toBe(200);
    expect(res.body.resultados).toEqual([
      {
        codigo: 'MED-001',
        nombre: 'Losartán 50 mg',
        principioActivo: 'Losartán potásico',
        presentacion: 'Caja 30 comprimidos',
        precioUnitario: 1990,
        stock: 120,
        disponible: true,
      },
    ]);
    expect(res.body.mensaje).toBeUndefined();
  });

  it.each(['LOSARTAN', 'Losartán', 'losartán', '  losartan  ', 'LoSaRtÁn'])(
    'no distingue mayúsculas, tildes ni espacios sobrantes: "%s"',
    async (q) => {
      const res = await buscar(q);

      expect(res.status).toBe(200);
      expect(codigos(res)).toEqual(['MED-002', 'MED-001']);
    },
  );

  it('encuentra por coincidencia parcial del nombre', async () => {
    const res = await buscar('losar');
    expect(codigos(res)).toEqual(['MED-002', 'MED-001']);
  });

  it('encuentra por principio activo aunque no esté en el nombre comercial', async () => {
    const res = await buscar('potasico');
    expect(codigos(res)).toEqual(['MED-002', 'MED-001']);
  });

  it('con varias palabras exige todas, en cualquier orden', async () => {
    const res = await buscar('potásico 100');
    expect(codigos(res)).toEqual(['MED-002']);
  });

  it('muestra los medicamentos sin stock marcados como no disponibles', async () => {
    const res = await buscar('fluoxetina');

    expect(res.status).toBe(200);
    expect(res.body.resultados).toHaveLength(1);
    expect(res.body.resultados[0]).toMatchObject({ codigo: 'MED-014', stock: 0, disponible: false });
  });

  it('sin coincidencias responde 200 con lista vacía y un mensaje en español', async () => {
    const res = await buscar('paracetamolxyz');

    expect(res.status).toBe(200);
    expect(res.body.resultados).toEqual([]);
    expect(res.body.mensaje).toMatch(/No encontramos ese medicamento/);
  });

  it('trata % y _ como letras, no como comodines', async () => {
    expect((await buscar('%%')).body.resultados).toEqual([]);
    expect((await buscar('__')).body.resultados).toEqual([]);
  });

  it('no muestra medicamentos inactivos', async () => {
    db.prepare("UPDATE medicamentos SET activo = 0 WHERE codigo = 'MED-001'").run();
    const res = await buscar('losartan');
    expect(codigos(res)).toEqual(['MED-002']);
  });

  it('refleja al instante un cambio de precio y stock hecho en el backoffice', async () => {
    app = crearApp({ db, tokenBackoffice: 'token-de-prueba' });
    await request(app)
      .put('/api/backoffice/medicamentos/MED-001')
      .set('x-backoffice-token', 'token-de-prueba')
      .send({
        precioUnitario: 2100,
        stock: 0,
        version: db.prepare("SELECT version FROM medicamentos WHERE codigo = 'MED-001'").get().version,
      })
      .expect(200);

    const res = await buscar('losartan 50');
    expect(res.body.resultados[0]).toMatchObject({ precioUnitario: 2100, stock: 0, disponible: false });
  });

  describe('búsqueda demasiado corta o mal formada', () => {
    it.each([
      ['no viene q', undefined],
      ['q está vacío', ''],
      ['q tiene solo espacios', '   '],
      ['q tiene una sola letra', 'l'],
      ['q tiene una letra con tilde y espacios', ' á '],
    ])('responde 400 en español si %s', async (_caso, q) => {
      const res = await buscar(q);

      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('busqueda_muy_corta');
      expect(res.body.mensaje).toMatch(/al menos 2 letras/);
    });

    it('responde 400 si q viene repetido', async () => {
      const res = await request(app).get('/api/medicamentos?q=losartan&q=amlodipino');

      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('busqueda_invalida');
    });

    it('responde 400 si q es demasiado largo', async () => {
      const res = await buscar('a'.repeat(101));

      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('busqueda_invalida');
    });
  });
});

describe('normalizarBusqueda', () => {
  it('pasa a minúsculas, quita tildes y junta espacios', () => {
    expect(normalizarBusqueda('  Losartán   POTÁSICO ')).toBe('losartan potasico');
    expect(normalizarBusqueda('Ñandú Ü')).toBe('nandu u');
  });

  it('coincide con la columna busqueda de toda la semilla (nombre + principio activo)', () => {
    const { db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla });
    const filas = db.prepare('SELECT nombre, principio_activo, busqueda FROM medicamentos').all();

    for (const fila of filas) {
      expect(normalizarBusqueda(`${fila.nombre} ${fila.principio_activo}`)).toBe(fila.busqueda);
    }
  });
});
