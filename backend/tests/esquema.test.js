import { describe, it, expect } from 'vitest';
import { abrirDb, crearEsquema, tablasFaltantes } from '../src/repositories/db.js';

// Una base creada antes de US-16 no tiene `pedido_items`: cada compra respondería con un error interno
// mientras /api/health dice que todo está bien. El servidor revisa esto al arrancar (server.js).
describe('tablasFaltantes', () => {
  it('con el esquema actual no falta ninguna tabla', () => {
    const db = abrirDb(':memory:');
    crearEsquema(db);
    expect(tablasFaltantes(db)).toEqual([]);
  });

  it('una base de antes de US-16 (sin pedido_items) la detecta por nombre', () => {
    const db = abrirDb(':memory:');
    db.exec(`
      CREATE TABLE medicamentos (codigo TEXT PRIMARY KEY);
      CREATE TABLE pedidos (numero_pedido TEXT PRIMARY KEY, codigo_medicamento TEXT, cantidad INTEGER);
    `);
    expect(tablasFaltantes(db)).toEqual(['pedido_items']);
  });

  it('una base vacía las informa todas', () => {
    expect(tablasFaltantes(abrirDb(':memory:'))).toEqual(['medicamentos', 'pedidos', 'pedido_items']);
  });
});
