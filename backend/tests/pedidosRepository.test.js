import { describe, it, expect, beforeEach } from 'vitest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearPedidosRepository, ESTADO_INICIAL } from '../src/repositories/pedidosRepository.js';

// #15 Modelo de pedido: la tabla pedidos y la compra atómica del repository.
describe('pedidosRepository', () => {
  let db;
  let repo;
  const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
  const contarPedidos = () => db.prepare('SELECT COUNT(*) AS n FROM pedidos').get().n;

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    repo = crearPedidosRepository(db);
  });

  it('crea el pedido con medicamento, cantidad, total, estado "Solicitud creada" y fecha', () => {
    const r = repo.confirmarPedido({ codigo: 'MED-001', cantidad: 3 });

    expect(r.ok).toBe(true);
    const guardado = repo.buscarPorNumero(r.pedido.numero_pedido);
    expect(guardado).toMatchObject({
      codigo_medicamento: 'MED-001',
      nombre_medicamento: 'Losartán 50 mg',
      cantidad: 3,
      precio_unitario: 1990,
      total: 5970,
      estado: ESTADO_INICIAL,
      alias_vecino: null,
    });
    expect(ESTADO_INICIAL).toBe('Solicitud creada');
    expect(new Date(guardado.fecha_creacion).toISOString()).toBe(guardado.fecha_creacion);
  });

  it('genera números de pedido "P-" + 6 caracteres alfanuméricos', () => {
    const r = repo.confirmarPedido({ codigo: 'MED-001', cantidad: 1 });
    expect(r.pedido.numero_pedido).toMatch(/^P-[A-Z0-9]{6}$/);
  });

  it('descuenta el stock y sube la versión del medicamento', () => {
    const { version } = db.prepare("SELECT version FROM medicamentos WHERE codigo = 'MED-001'").get();
    repo.confirmarPedido({ codigo: 'MED-001', cantidad: 5 });
    expect(stock('MED-001')).toBe(115);
    const despues = db.prepare("SELECT version FROM medicamentos WHERE codigo = 'MED-001'").get();
    expect(despues.version).toBe(version + 1);
  });

  it('guarda el alias ficticio si viene', () => {
    const r = repo.confirmarPedido({ codigo: 'MED-001', cantidad: 1, alias: 'Vecina de prueba' });
    expect(repo.buscarPorNumero(r.pedido.numero_pedido).alias_vecino).toBe('Vecina de prueba');
  });

  it('rechaza con no_existe si el código no está en el catálogo', () => {
    expect(repo.confirmarPedido({ codigo: 'MED-999', cantidad: 1 })).toEqual({ ok: false, motivo: 'no_existe' });
    expect(contarPedidos()).toBe(0);
  });

  it('rechaza con sin_stock sin tocar el stock ni crear pedido si no alcanza', () => {
    const r = repo.confirmarPedido({ codigo: 'PRB-002', cantidad: 3 });
    expect(r).toEqual({ ok: false, motivo: 'sin_stock', stockDisponible: 2 });
    expect(stock('PRB-002')).toBe(2);
    expect(contarPedidos()).toBe(0);
  });

  it('si el INSERT falla, revierte también el descuento de stock', () => {
    // cantidad 25 pasa el UPDATE (hay 120) pero viola el CHECK de pedidos (1 a 20).
    expect(() => repo.confirmarPedido({ codigo: 'MED-001', cantidad: 25 })).toThrow();
    expect(stock('MED-001')).toBe(120);
    expect(contarPedidos()).toBe(0);
  });

  it('el esquema no permite estados fuera de los 9 de la farmacia', () => {
    const r = repo.confirmarPedido({ codigo: 'MED-001', cantidad: 1 });
    expect(() =>
      db.prepare("UPDATE pedidos SET estado = 'Pendiente de pago' WHERE numero_pedido = ?").run(r.pedido.numero_pedido)
    ).toThrow();
  });
});
