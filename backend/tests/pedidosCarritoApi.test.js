import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';
import { ITEMS_MAXIMOS } from '../src/services/pedidosService.js';

// US-16 Carrito (#42): contrato de POST /api/pedidos con { items: [{ codigo, cantidad }] }
// (MODELO_DE_DATOS.md §3). Un solo pedido, total calculado en el servidor y todo o nada.
describe('POST /api/pedidos con carrito', () => {
  let db;
  let app;
  const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
  const contar = (tabla) => db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n;
  const comprar = (cuerpo) => request(app).post('/api/pedidos').send(cuerpo);

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db });
  });

  describe('compra aceptada', () => {
    it('responde 201 con un solo pedido que trae todos sus ítems, el total y el estado', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 2 },
          { codigo: 'MED-003', cantidad: 1 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.pedido).toMatchObject({
        total: 5470, // 2 × 1.990 + 1 × 1.490
        estado: 'Solicitud creada',
        items: [
          { codigo: 'MED-001', medicamento: 'Losartán 50 mg', cantidad: 2, precioUnitario: 1990, subtotal: 3980 },
          { codigo: 'MED-003', medicamento: 'Amlodipino 5 mg', cantidad: 1, precioUnitario: 1490, subtotal: 1490 },
        ],
      });
      expect(res.body.pedido.numeroPedido).toMatch(/^P-[A-Z0-9]{6}$/);
      expect(new Date(res.body.pedido.fechaCreacion).toISOString()).toBe(res.body.pedido.fechaCreacion);
      expect(contar('pedidos')).toBe(1);
      expect(contar('pedido_items')).toBe(2);
    });

    it('descuenta el stock de cada medicamento del carrito', async () => {
      await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 2 },
          { codigo: 'MED-003', cantidad: 5 },
        ],
      });

      expect(stock('MED-001')).toBe(118);
      expect(stock('MED-003')).toBe(75);
    });

    it('con varios medicamentos no trae los campos de un solo medicamento de US-15', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 1 },
          { codigo: 'MED-003', cantidad: 1 },
        ],
      });
      expect(res.body.pedido).not.toHaveProperty('medicamento');
      expect(res.body.pedido).not.toHaveProperty('cantidad');
      expect(res.body.pedido).not.toHaveProperty('precioUnitario');
    });

    it('un carrito de un solo medicamento conserva también los campos de US-15', async () => {
      const res = await comprar({ items: [{ codigo: 'MED-003', cantidad: 2 }] });
      expect(res.status).toBe(201);
      expect(res.body.pedido).toMatchObject({
        medicamento: 'Amlodipino 5 mg',
        cantidad: 2,
        precioUnitario: 1490,
        total: 2980,
        items: [{ codigo: 'MED-003', cantidad: 2, subtotal: 2980 }],
      });
    });

    it('ignora precios, subtotales y totales enviados por el cliente: los calcula el servidor', async () => {
      const res = await comprar({
        total: 1,
        items: [
          { codigo: 'MED-001', cantidad: 2, precioUnitario: 1, subtotal: 1 },
          { codigo: 'MED-003', cantidad: 1, precioUnitario: 1, subtotal: 1 },
        ],
      });
      expect(res.body.pedido.total).toBe(5470);
      expect(res.body.pedido.items.map((i) => [i.precioUnitario, i.subtotal])).toEqual([
        [1990, 3980],
        [1490, 1490],
      ]);
    });

    it('junta en un solo ítem el mismo medicamento repetido', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 2 },
          { codigo: 'MED-001', cantidad: 3 },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.pedido.items).toHaveLength(1);
      expect(res.body.pedido.items[0]).toMatchObject({ codigo: 'MED-001', cantidad: 5, subtotal: 9950 });
      expect(stock('MED-001')).toBe(115);
    });

    it('guarda el alias recortado una sola vez, en el pedido', async () => {
      const res = await comprar({ alias: '  Vecina del pasaje  ', items: [{ codigo: 'MED-001', cantidad: 1 }] });
      const fila = db.prepare('SELECT alias_vecino FROM pedidos WHERE numero_pedido = ?').get(res.body.pedido.numeroPedido);
      expect(fila.alias_vecino).toBe('Vecina del pasaje');
    });

    it('acepta el máximo de medicamentos distintos', async () => {
      const codigos = ['MED-001', 'MED-002', 'MED-003', 'MED-004', 'MED-005', 'MED-006', 'MED-007', 'MED-008', 'MED-009', 'MED-010'];
      expect(codigos).toHaveLength(ITEMS_MAXIMOS);
      const res = await comprar({ items: codigos.map((codigo) => ({ codigo, cantidad: 1 })) });
      expect(res.status).toBe(201);
      expect(res.body.pedido.items).toHaveLength(ITEMS_MAXIMOS);
    });
  });

  describe('sin stock: todo o nada', () => {
    it('responde 409, indica CUÁL medicamento no está disponible y no cambia el stock de ninguno', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 2 },
          { codigo: 'MED-014', cantidad: 1 }, // Fluoxetina, agotada
          { codigo: 'MED-003', cantidad: 1 },
        ],
      });

      expect(res.status).toBe(409);
      expect(res.body.motivo).toBe('sin_stock');
      expect(res.body.mensaje).toBe(
        '«Fluoxetina 20 mg» ya no tiene stock disponible. No se creó ningún pedido; quítalo de tu carrito para continuar.'
      );
      expect(res.body.faltantes).toEqual([{ codigo: 'MED-014', medicamento: 'Fluoxetina 20 mg', stockDisponible: 0 }]);
      expect(stock('MED-001')).toBe(120);
      expect(stock('MED-003')).toBe(80);
      expect(stock('MED-014')).toBe(0);
      expect(contar('pedidos')).toBe(0);
      expect(contar('pedido_items')).toBe(0);
    });

    it('cuando no alcanza una cantidad, dice cuántas unidades quedan', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 1 },
          { codigo: 'PRB-002', cantidad: 3 },
        ],
      });

      expect(res.status).toBe(409);
      expect(res.body.mensaje).toBe(
        'No tenemos stock suficiente de «PRUEBA Concurrencia dos unidades»: quedan 2 unidades. No se creó ningún pedido; ajusta la cantidad e inténtalo de nuevo.'
      );
      expect(res.body.faltantes).toEqual([
        { codigo: 'PRB-002', medicamento: 'PRUEBA Concurrencia dos unidades', stockDisponible: 2 },
      ]);
      expect(stock('MED-001')).toBe(120);
    });

    it('si varios no alcanzan, los nombra a todos en el mismo mensaje', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-014', cantidad: 1 },
          { codigo: 'PRB-001', cantidad: 2 },
          { codigo: 'MED-001', cantidad: 1 },
        ],
      });

      expect(res.status).toBe(409);
      expect(res.body.faltantes.map((f) => f.codigo)).toEqual(['MED-014', 'PRB-001']);
      expect(res.body.mensaje).toBe(
        'Estos medicamentos de tu carrito no tienen stock suficiente: «Fluoxetina 20 mg» (sin stock), «PRUEBA Concurrencia última unidad» (quedan 1 unidad). No se creó ningún pedido; ajusta tu carrito e inténtalo de nuevo.'
      );
      expect(stock('MED-001')).toBe(120);
    });

    it('un carrito de un solo medicamento agotado también se rechaza nombrándolo', async () => {
      const res = await comprar({ items: [{ codigo: 'MED-019', cantidad: 1 }] });
      expect(res.status).toBe(409);
      expect(res.body.mensaje).toMatch(/^«Naproxeno 550 mg» ya no tiene stock disponible\./);
    });

    it('el mismo medicamento repetido cuenta junto: 1 + 1 sobre la última unidad no alcanza', async () => {
      const res = await comprar({
        items: [
          { codigo: 'PRB-001', cantidad: 1 },
          { codigo: 'PRB-001', cantidad: 1 },
        ],
      });
      expect(res.status).toBe(409);
      expect(stock('PRB-001')).toBe(1);
      expect(contar('pedidos')).toBe(0);
    });
  });

  describe('carrito inválido', () => {
    it('responde 400 carrito_vacio si no hay ningún medicamento', async () => {
      const res = await comprar({ items: [] });
      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('carrito_vacio');
      expect(res.body.mensaje).toBe('Tu carrito está vacío. Agrega al menos un medicamento para hacer tu pedido.');
      expect(contar('pedidos')).toBe(0);
    });

    it.each([
      ['un texto', 'MED-001'],
      ['un objeto', { codigo: 'MED-001', cantidad: 1 }],
      ['un número', 3],
    ])('responde 400 carrito_invalido si items es %s', async (_caso, items) => {
      const res = await comprar({ items });
      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('carrito_invalido');
    });

    it.each([
      ['null', null],
      ['un texto', 'MED-001'],
      ['un número', 7],
    ])('responde 400 carrito_invalido si un ítem es %s', async (_caso, item) => {
      const res = await comprar({ items: [{ codigo: 'MED-001', cantidad: 1 }, item] });
      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('carrito_invalido');
      expect(stock('MED-001')).toBe(120);
    });

    it(`responde 400 demasiados_items con más de ${ITEMS_MAXIMOS} medicamentos distintos`, async () => {
      const codigos = Array.from({ length: ITEMS_MAXIMOS + 1 }, (_, i) => `MED-${String(i + 1).padStart(3, '0')}`);
      const res = await comprar({ items: codigos.map((codigo) => ({ codigo, cantidad: 1 })) });
      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('demasiados_items');
      expect(contar('pedidos')).toBe(0);
    });

    it('el mismo medicamento repetido muchas veces cuenta como UNO solo, no como demasiados', async () => {
      const res = await comprar({ items: Array.from({ length: ITEMS_MAXIMOS + 1 }, () => ({ codigo: 'MED-001', cantidad: 1 })) });
      expect(res.status).toBe(201);
      expect(res.body.pedido.items).toEqual([expect.objectContaining({ codigo: 'MED-001', cantidad: ITEMS_MAXIMOS + 1 })]);
      expect(stock('MED-001')).toBe(120 - (ITEMS_MAXIMOS + 1));
    });

    it.each([
      ['cero', 0],
      ['negativa', -1],
      ['mayor a 20', 21],
      ['decimal', 1.5],
      ['texto', 'dos'],
      ['ausente', undefined],
    ])('responde 400 cantidad_invalida si la cantidad de un ítem es %s', async (_caso, cantidad) => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 1 },
          { codigo: 'MED-003', cantidad },
        ],
      });
      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('cantidad_invalida');
      expect(stock('MED-001')).toBe(120);
      expect(contar('pedidos')).toBe(0);
    });

    it('responde 400 cantidad_invalida si el mismo medicamento repetido suma más de 20', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 12 },
          { codigo: 'MED-001', cantidad: 12 },
        ],
      });
      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('cantidad_invalida');
      expect(stock('MED-001')).toBe(120);
    });

    it('responde 404 no_existe si un medicamento del carrito no está en el catálogo y no descuenta nada', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 2 },
          { codigo: 'MED-999', cantidad: 1 },
        ],
      });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        motivo: 'no_existe',
        mensaje: 'Hay medicamentos de tu carrito que ya no están en el catálogo. Quítalos para continuar.',
        noDisponibles: [{ codigo: 'MED-999' }],
      });
      expect(stock('MED-001')).toBe(120);
      expect(contar('pedidos')).toBe(0);
    });

    it('un medicamento desactivado también se informa por código, para que la pantalla diga cuál quitar', async () => {
      db.prepare("UPDATE medicamentos SET activo = 0 WHERE codigo = 'MED-003'").run();
      const res = await comprar({
        items: [
          { codigo: 'MED-001', cantidad: 1 },
          { codigo: 'MED-003', cantidad: 1 },
        ],
      });
      expect(res.status).toBe(404);
      expect(res.body.noDisponibles).toEqual([{ codigo: 'MED-003' }]);
      expect(stock('MED-001')).toBe(120);
      expect(stock('MED-003')).toBe(80);
    });

    it('si hay varios que ya no existen, los informa a todos', async () => {
      const res = await comprar({
        items: [
          { codigo: 'MED-998', cantidad: 1 },
          { codigo: 'MED-001', cantidad: 1 },
          { codigo: 'MED-999', cantidad: 1 },
        ],
      });
      expect(res.status).toBe(404);
      expect(res.body.noDisponibles).toEqual([{ codigo: 'MED-998' }, { codigo: 'MED-999' }]);
    });

    it('la compra simple sin stock o inexistente no trae listas extra', async () => {
      const inexistente = await comprar({ codigo: 'MED-999', cantidad: 1 });
      expect(inexistente.body).toEqual({ motivo: 'no_existe', mensaje: 'No encontramos ese medicamento. Vuelve a buscarlo, por favor.' });
    });

    it('responde 404 no_existe si un ítem no trae código', async () => {
      const res = await comprar({ items: [{ cantidad: 1 }] });
      expect(res.status).toBe(404);
      expect(res.body.motivo).toBe('no_existe');
    });

    it('los mensajes de error son texto simple en español, sin códigos', async () => {
      const respuestas = await Promise.all([
        comprar({ items: [] }),
        comprar({ items: 'x' }),
        comprar({ items: [{ codigo: 'MED-001', cantidad: 0 }] }),
        comprar({ items: [{ codigo: 'MED-999', cantidad: 1 }] }),
        comprar({ items: [{ codigo: 'MED-014', cantidad: 1 }] }),
      ]);
      for (const res of respuestas) {
        expect(res.body.mensaje).toMatch(/^[«A-ZÁÉÍÓÚ]/);
        expect(res.body.mensaje).not.toMatch(/sin_stock|no_existe|cantidad_invalida|carrito_|undefined|null/);
      }
    });
  });

  describe('compatibilidad con la compra de un solo medicamento (US-15)', () => {
    it('{ codigo, cantidad } sigue funcionando y devuelve el pedido de siempre más sus ítems', async () => {
      const res = await comprar({ codigo: 'MED-003', cantidad: 2 });
      expect(res.status).toBe(201);
      expect(res.body.pedido).toMatchObject({ medicamento: 'Amlodipino 5 mg', cantidad: 2, precioUnitario: 1490, total: 2980 });
      expect(res.body.pedido.items).toEqual([
        { codigo: 'MED-003', medicamento: 'Amlodipino 5 mg', cantidad: 2, precioUnitario: 1490, subtotal: 2980 },
      ]);
    });

    it.each([['null', null], ['ausente', undefined]])('con `items` %s sigue siendo la compra simple de US-15', async (_caso, items) => {
      const res = await comprar({ codigo: 'MED-003', cantidad: 1, items });
      expect(res.status).toBe(201);
      expect(res.body.pedido).toMatchObject({ medicamento: 'Amlodipino 5 mg', cantidad: 1, total: 1490 });
    });

    it('la compra simple sin stock mantiene su mensaje y no trae la lista de faltantes', async () => {
      const res = await comprar({ codigo: 'MED-014', cantidad: 1 });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ motivo: 'sin_stock', mensaje: 'Este medicamento ya no tiene stock disponible.' });
    });
  });
});
