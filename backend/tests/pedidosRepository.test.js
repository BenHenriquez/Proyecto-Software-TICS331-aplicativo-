import { describe, it, expect, beforeEach } from 'vitest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearPedidosRepository, ESTADO_INICIAL } from '../src/repositories/pedidosRepository.js';

// #15 Modelo de pedido (US-15) y #42 pedido con varios ítems (US-16): las tablas pedidos y
// pedido_items, y la compra atómica del repository.
describe('pedidosRepository', () => {
  let db;
  let repo;
  const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
  const version = (codigo) => db.prepare('SELECT version FROM medicamentos WHERE codigo = ?').get(codigo).version;
  const contar = (tabla) => db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n;
  const comprar = (...items) => repo.confirmarPedido({ items });

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    repo = crearPedidosRepository(db);
  });

  describe('un medicamento (US-15)', () => {
    it('crea el pedido con medicamento, cantidad, total, estado "Solicitud creada" y fecha', () => {
      const r = comprar({ codigo: 'MED-001', cantidad: 3 });

      expect(r.ok).toBe(true);
      const guardado = repo.buscarPorNumero(r.pedido.numero_pedido);
      expect(guardado).toMatchObject({ total: 5970, estado: ESTADO_INICIAL, alias_vecino: null });
      expect(guardado.items).toEqual([
        {
          numero_pedido: r.pedido.numero_pedido,
          codigo_medicamento: 'MED-001',
          nombre_medicamento: 'Losartán 50 mg',
          cantidad: 3,
          precio_unitario: 1990,
          subtotal: 5970,
        },
      ]);
      expect(ESTADO_INICIAL).toBe('Solicitud creada');
      expect(new Date(guardado.fecha_creacion).toISOString()).toBe(guardado.fecha_creacion);
    });

    it('genera números de pedido "P-" + 6 caracteres alfanuméricos', () => {
      const r = comprar({ codigo: 'MED-001', cantidad: 1 });
      expect(r.pedido.numero_pedido).toMatch(/^P-[A-Z0-9]{6}$/);
    });

    it('descuenta el stock y sube la versión del medicamento', () => {
      const antes = version('MED-001');
      comprar({ codigo: 'MED-001', cantidad: 5 });
      expect(stock('MED-001')).toBe(115);
      expect(version('MED-001')).toBe(antes + 1);
    });

    it('guarda el alias ficticio si viene', () => {
      const r = repo.confirmarPedido({ items: [{ codigo: 'MED-001', cantidad: 1 }], alias: 'Vecina de prueba' });
      expect(repo.buscarPorNumero(r.pedido.numero_pedido).alias_vecino).toBe('Vecina de prueba');
    });

    it('rechaza con no_existe si el código no está en el catálogo', () => {
      expect(comprar({ codigo: 'MED-999', cantidad: 1 })).toEqual({
        ok: false,
        motivo: 'no_existe',
        codigos: ['MED-999'],
      });
      expect(contar('pedidos')).toBe(0);
    });

    it('rechaza con sin_stock sin tocar el stock ni crear pedido si no alcanza', () => {
      const r = comprar({ codigo: 'PRB-002', cantidad: 3 });
      expect(r).toEqual({
        ok: false,
        motivo: 'sin_stock',
        faltantes: [{ codigo: 'PRB-002', nombre: 'PRUEBA Concurrencia dos unidades', stockDisponible: 2 }],
      });
      expect(stock('PRB-002')).toBe(2);
      expect(contar('pedidos')).toBe(0);
      expect(contar('pedido_items')).toBe(0);
    });

    it('si el INSERT falla, revierte también el descuento de stock', () => {
      // cantidad 25 pasa el UPDATE (hay 120) pero viola el CHECK de pedido_items (1 a 20).
      expect(() => comprar({ codigo: 'MED-001', cantidad: 25 })).toThrow();
      expect(stock('MED-001')).toBe(120);
      expect(contar('pedidos')).toBe(0);
      expect(contar('pedido_items')).toBe(0);
    });

    it('el esquema no permite estados fuera de los 9 de la farmacia', () => {
      const r = comprar({ codigo: 'MED-001', cantidad: 1 });
      expect(() =>
        db.prepare("UPDATE pedidos SET estado = 'Pendiente de pago' WHERE numero_pedido = ?").run(r.pedido.numero_pedido)
      ).toThrow();
    });
  });

  describe('varios medicamentos en un solo pedido (US-16)', () => {
    it('crea UN pedido con todos sus ítems, el total sumado y el estado "Solicitud creada"', () => {
      const r = comprar({ codigo: 'MED-001', cantidad: 2 }, { codigo: 'MED-003', cantidad: 1 });

      expect(r.ok).toBe(true);
      expect(contar('pedidos')).toBe(1);
      const guardado = repo.buscarPorNumero(r.pedido.numero_pedido);
      // 2 × 1.990 + 1 × 1.490
      expect(guardado).toMatchObject({ total: 5470, estado: 'Solicitud creada' });
      expect(guardado.items.map((i) => [i.codigo_medicamento, i.cantidad, i.precio_unitario, i.subtotal])).toEqual([
        ['MED-001', 2, 1990, 3980],
        ['MED-003', 1, 1490, 1490],
      ]);
    });

    it('descuenta el stock de cada ítem y sube la versión de cada medicamento', () => {
      const v1 = version('MED-001');
      const v3 = version('MED-003');
      comprar({ codigo: 'MED-001', cantidad: 2 }, { codigo: 'MED-003', cantidad: 4 });

      expect(stock('MED-001')).toBe(118);
      expect(stock('MED-003')).toBe(76);
      expect(version('MED-001')).toBe(v1 + 1);
      expect(version('MED-003')).toBe(v3 + 1);
    });

    it('si un ítem no alcanza, no crea el pedido y deja el stock de TODOS sin cambios', () => {
      const r = comprar(
        { codigo: 'MED-001', cantidad: 2 },
        { codigo: 'PRB-002', cantidad: 3 },
        { codigo: 'MED-003', cantidad: 1 }
      );

      expect(r).toMatchObject({ ok: false, motivo: 'sin_stock' });
      expect(r.faltantes.map((f) => f.codigo)).toEqual(['PRB-002']);
      // MED-001 se procesó antes que PRB-002, pero su descuento se revirtió
      expect(stock('MED-001')).toBe(120);
      expect(stock('PRB-002')).toBe(2);
      expect(stock('MED-003')).toBe(80);
      expect(version('MED-001')).toBe(0);
      expect(contar('pedidos')).toBe(0);
      expect(contar('pedido_items')).toBe(0);
    });

    it('si varios ítems no alcanzan, los informa a todos', () => {
      const r = comprar({ codigo: 'PRB-002', cantidad: 3 }, { codigo: 'MED-014', cantidad: 1 }, { codigo: 'MED-001', cantidad: 1 });

      expect(r.faltantes).toEqual([
        { codigo: 'PRB-002', nombre: 'PRUEBA Concurrencia dos unidades', stockDisponible: 2 },
        { codigo: 'MED-014', nombre: expect.any(String), stockDisponible: 0 },
      ]);
      expect(stock('MED-001')).toBe(120);
    });

    it('si un ítem no existe, rechaza con no_existe sin descontar nada', () => {
      const r = comprar({ codigo: 'MED-001', cantidad: 1 }, { codigo: 'MED-999', cantidad: 1 });

      expect(r).toEqual({ ok: false, motivo: 'no_existe', codigos: ['MED-999'] });
      expect(stock('MED-001')).toBe(120);
      expect(contar('pedidos')).toBe(0);
    });

    it('si falla el INSERT de un ítem, se revierten los descuentos y el pedido', () => {
      // El segundo ítem pasa el UPDATE (hay 80) pero viola el CHECK de cantidad en pedido_items.
      expect(() => comprar({ codigo: 'MED-001', cantidad: 2 }, { codigo: 'MED-003', cantidad: 25 })).toThrow();

      expect(stock('MED-001')).toBe(120);
      expect(stock('MED-003')).toBe(80);
      expect(contar('pedidos')).toBe(0);
      expect(contar('pedido_items')).toBe(0);
    });

    it('un medicamento solo puede aparecer una vez en el mismo pedido (clave del ítem)', () => {
      const r = comprar({ codigo: 'MED-001', cantidad: 1 });
      expect(() =>
        db
          .prepare(
            `INSERT INTO pedido_items VALUES (?, 'MED-001', 'Losartán 50 mg', 1, 1990, 1990)`
          )
          .run(r.pedido.numero_pedido)
      ).toThrow();
    });

    it('un ítem no puede apuntar a un pedido que no existe', () => {
      expect(() =>
        db.prepare(`INSERT INTO pedido_items VALUES ('P-NOEXIS', 'MED-001', 'Losartán 50 mg', 1, 1990, 1990)`).run()
      ).toThrow();
    });
  });
});
