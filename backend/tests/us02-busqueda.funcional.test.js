import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';

// #10 Pruebas de US-02: un test por escenario Gherkin (docs/sprint-1/META_Y_BACKLOG.md §1.3),
// más búsquedas con y sin tilde ("Losartan" y "Losartán") y por principio activo.
describe('US-02 · Consultar medicamento', () => {
  let db;
  let app;
  const buscar = (q) => request(app).get('/api/medicamentos').query({ q });
  const fila = (codigo) => db.prepare('SELECT * FROM medicamentos WHERE codigo = ?').get(codigo);

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db });
  });

  it.each(['Losartán', 'Losartán potásico'])(
    'Escenario feliz: al buscar "%s" se ve nombre oficial, dosificación, precio y disponibilidad',
    async (q) => {
      // Dado que el catálogo sintético contiene Losartán con stock disponible
      expect(fila('MED-001').stock).toBeGreaterThan(0);

      // Cuando la vecina lo busca por nombre o principio activo
      const res = await buscar(q);

      // Entonces el sistema muestra su nombre oficial, dosificación, precio unitario y disponibilidad
      expect(res.status).toBe(200);
      const losartan = res.body.resultados.find((m) => m.codigo === 'MED-001');
      expect(losartan).toMatchObject({
        nombre: 'Losartán 50 mg', // nombre oficial con su dosificación
        principioActivo: 'Losartán potásico',
        presentacion: 'Caja 30 comprimidos',
        precioUnitario: 1990,
        disponible: true,
      });
    },
  );

  it('Escenario de error — sin coincidencias: se informa claramente que no se encontró', async () => {
    // Dado que la vecina escribe un nombre que no existe en el catálogo
    const q = 'Remedioquenoexiste';

    // Cuando ejecuta la búsqueda
    const res = await buscar(q);

    // Entonces el sistema informa claramente que no encontró el medicamento
    expect(res.status).toBe(200);
    expect(res.body.resultados).toEqual([]);
    expect(res.body.mensaje).toMatch(/No encontramos ese medicamento/);
  });

  it('Escenario de error — sin stock: se muestra como no disponible y no se puede comprar', async () => {
    // Dado que un medicamento existe en el catálogo pero su stock es 0
    expect(fila('MED-014')).toMatchObject({ nombre: 'Fluoxetina 20 mg', stock: 0 });

    // Cuando la vecina lo busca
    const res = await buscar('Fluoxetina');

    // Entonces el sistema lo muestra indicando explícitamente que no tiene stock
    expect(res.status).toBe(200);
    expect(res.body.resultados).toEqual([
      expect.objectContaining({ codigo: 'MED-014', nombre: 'Fluoxetina 20 mg', stock: 0, disponible: false }),
    ]);

    // Y no ofrece la opción de comprarlo: el backend rechaza la compra
    const compra = await request(app).post('/api/pedidos').send({ codigo: 'MED-014', cantidad: 1 });
    expect(compra.status).toBe(409);
    expect(compra.body.motivo).toBe('sin_stock');
    expect(fila('MED-014').stock).toBe(0);
  });

  it('"Losartan" sin tilde y "Losartán" con tilde devuelven los mismos resultados', async () => {
    const sinTilde = await buscar('Losartan');
    const conTilde = await buscar('Losartán');

    expect(sinTilde.body.resultados.length).toBeGreaterThan(0);
    expect(conTilde.body.resultados).toEqual(sinTilde.body.resultados);
  });

  it('por principio activo encuentra el medicamento aunque el nombre sea distinto', async () => {
    // Metformina 850 mg tiene como principio activo "Metformina clorhidrato"
    const res = await buscar('clorhidrato');

    expect(res.status).toBe(200);
    expect(res.body.resultados.map((m) => m.codigo)).toContain('MED-026');
    for (const m of res.body.resultados) {
      expect(m.principioActivo.toLowerCase()).toContain('clorhidrato');
    }
  });
});
