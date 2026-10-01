import { describe, it, expect } from 'vitest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';

describe('semilla sintética', () => {
  const { db, cantidad } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla });
  const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;

  it('carga las 34 filas con version = 0', () => {
    expect(cantidad).toBe(34);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM medicamentos WHERE version = 0').get();
    expect(n).toBe(34);
  });

  it('MED-014, MED-019 y MED-030 quedan sin stock', () => {
    expect([stock('MED-014'), stock('MED-019'), stock('MED-030')]).toEqual([0, 0, 0]);
  });

  it('PRB-001 tiene 1 unidad y PRB-002 tiene 2 (pruebas de concurrencia)', () => {
    expect(stock('PRB-001')).toBe(1);
    expect(stock('PRB-002')).toBe(2);
  });

  // #6: el catálogo incluye los productos del top 5 del informe del sponsor (solo los nombres;
  // las cifras de venta son datos reales y no van al repositorio). Todos parten con stock.
  it.each([
    ['MED-009', 'Pregabalina 75 mg'],
    ['MED-010', 'Pregabalina 150 mg'],
    ['MED-015', 'Melatonina 3 mg'],
    ['MED-020', 'Multivitamínico adulto'],
    ['MED-016', 'Celecoxib 200 mg'],
    ['MED-001', 'Losartán 50 mg'],
    ['MED-011', 'Escitalopram 10 mg'],
    ['MED-012', 'Escitalopram 20 mg'],
  ])('incluye %s (%s) del top 5 del informe, activo y con stock', (codigo, nombre) => {
    const fila = db.prepare('SELECT nombre, stock, activo FROM medicamentos WHERE codigo = ?').get(codigo);
    expect(fila).toMatchObject({ nombre, activo: 1 });
    expect(fila.stock).toBeGreaterThan(0);
  });

  it('el esquema impide stock negativo', () => {
    expect(() => db.prepare("UPDATE medicamentos SET stock = -1 WHERE codigo = 'MED-001'").run()).toThrow();
  });
});
