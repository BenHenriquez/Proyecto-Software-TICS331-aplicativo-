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

  it('el esquema impide stock negativo', () => {
    expect(() => db.prepare("UPDATE medicamentos SET stock = -1 WHERE codigo = 'MED-001'").run()).toThrow();
  });
});
