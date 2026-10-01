import { describe, it, expect, beforeEach } from 'vitest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearMedicamentosRepository } from '../src/repositories/medicamentosRepository.js';

// #12: el repository es quien aplica el candado de version (MODELO_DE_DATOS.md §5).
describe('medicamentosRepository.actualizarPrecioYStock', () => {
  let db;
  let repo;
  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    repo = crearMedicamentosRepository(db);
  });

  it('con la version vigente actualiza y devuelve la fila con la version nueva', () => {
    const r = repo.actualizarPrecioYStock({ codigo: 'MED-001', stock: 50, version: 0 });

    expect(r.ok).toBe(true);
    expect(r.fila).toMatchObject({ codigo: 'MED-001', stock: 50, precio_unitario: 1990, version: 1 });
  });

  it('distingue una version vieja (version_cambiada) de un código inexistente (no_existe)', () => {
    repo.actualizarPrecioYStock({ codigo: 'MED-001', stock: 50, version: 0 });

    expect(repo.actualizarPrecioYStock({ codigo: 'MED-001', stock: 80, version: 0 })).toEqual({
      ok: false,
      motivo: 'version_cambiada',
    });
    expect(repo.actualizarPrecioYStock({ codigo: 'MED-999', stock: 80, version: 0 })).toEqual({
      ok: false,
      motivo: 'no_existe',
    });
    expect(db.prepare("SELECT stock, version FROM medicamentos WHERE codigo = 'MED-001'").get()).toEqual({
      stock: 50,
      version: 1,
    });
  });

  it.each([undefined, null, '0', -1, 0.5])('lanza un error si la version es %s, en vez de simular un conflicto', (version) => {
    expect(() => repo.actualizarPrecioYStock({ codigo: 'MED-001', stock: 50, version })).toThrow(TypeError);
    expect(db.prepare("SELECT stock FROM medicamentos WHERE codigo = 'MED-001'").get().stock).toBe(120);
  });
});
