import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';

// Pruebas funcionales de US-16 Carrito (#42): un test por escenario Gherkin del issue.
describe('US-16 · Carrito de compras', () => {
  let db;
  let app;
  const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
  const pedidos = () => db.prepare('SELECT * FROM pedidos').all();
  const itemsDe = (numero) =>
    db.prepare('SELECT codigo_medicamento, cantidad, subtotal FROM pedido_items WHERE numero_pedido = ? ORDER BY 1').all(numero);
  const confirmar = (items) => request(app).post('/api/pedidos').send({ items });

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db });
  });

  it('Escenario feliz: con dos medicamentos con stock, confirmar crea UN pedido con los dos y descuenta cada stock', async () => {
    // Dado que la vecina agregó al carrito dos medicamentos con stock disponible
    const carrito = [
      { codigo: 'MED-001', cantidad: 2 }, // Losartán 50 mg · $1.990
      { codigo: 'MED-003', cantidad: 3 }, // Amlodipino 5 mg · $1.490
    ];
    const [stock1, stock3] = [stock('MED-001'), stock('MED-003')];
    expect(stock1).toBeGreaterThan(2);
    expect(stock3).toBeGreaterThan(3);

    // Cuando confirma el carrito
    const res = await confirmar(carrito);

    // Entonces el sistema crea un solo pedido con los dos medicamentos, el total calculado y el estado «Solicitud creada»
    expect(res.status).toBe(201);
    expect(pedidos()).toHaveLength(1);
    expect(res.body.pedido.estado).toBe('Solicitud creada');
    expect(res.body.pedido.total).toBe(2 * 1990 + 3 * 1490);
    expect(res.body.pedido.items.map((i) => i.medicamento)).toEqual(['Losartán 50 mg', 'Amlodipino 5 mg']);
    expect(itemsDe(res.body.pedido.numeroPedido)).toEqual([
      { codigo_medicamento: 'MED-001', cantidad: 2, subtotal: 3980 },
      { codigo_medicamento: 'MED-003', cantidad: 3, subtotal: 4470 },
    ]);

    // Y descuenta el stock de cada uno
    expect(stock('MED-001')).toBe(stock1 - 2);
    expect(stock('MED-003')).toBe(stock3 - 3);
  });

  it('Escenario de error — sin stock: si uno no alcanza, no hay pedido, se indica cuál y el stock de todos queda igual', async () => {
    // Dado que uno de los medicamentos del carrito ya no tiene stock suficiente
    expect(stock('PRB-002')).toBe(2);
    const antes = { 'MED-001': stock('MED-001'), 'MED-003': stock('MED-003'), 'PRB-002': stock('PRB-002') };

    // Cuando la vecina confirma
    const res = await confirmar([
      { codigo: 'MED-001', cantidad: 2 },
      { codigo: 'PRB-002', cantidad: 5 },
      { codigo: 'MED-003', cantidad: 1 },
    ]);

    // Entonces el sistema no crea el pedido
    expect(res.status).toBe(409);
    expect(pedidos()).toHaveLength(0);

    // Indica cuál medicamento no está disponible
    expect(res.body.faltantes).toEqual([
      { codigo: 'PRB-002', medicamento: 'PRUEBA Concurrencia dos unidades', stockDisponible: 2 },
    ]);
    expect(res.body.mensaje).toContain('«PRUEBA Concurrencia dos unidades»');
    expect(res.body.mensaje).toContain('No se creó ningún pedido');

    // Y mantiene el stock de todos sin cambios
    expect({ 'MED-001': stock('MED-001'), 'MED-003': stock('MED-003'), 'PRB-002': stock('PRB-002') }).toEqual(antes);
    const versiones = db.prepare("SELECT SUM(version) AS v FROM medicamentos WHERE codigo IN ('MED-001','MED-003','PRB-002')").get();
    expect(versiones.v).toBe(0);
  });

  it('Después de un rechazo, quitar el medicamento sin stock deja confirmar el resto del carrito', async () => {
    const rechazado = await confirmar([
      { codigo: 'MED-001', cantidad: 1 },
      { codigo: 'MED-014', cantidad: 1 }, // Fluoxetina, agotada
    ]);
    expect(rechazado.status).toBe(409);
    expect(rechazado.body.faltantes.map((f) => f.codigo)).toEqual(['MED-014']);

    const aceptado = await confirmar([{ codigo: 'MED-001', cantidad: 1 }]);
    expect(aceptado.status).toBe(201);
    expect(stock('MED-001')).toBe(119);
    expect(pedidos()).toHaveLength(1);
  });

  it('Un pedido de carrito agota el stock exacto: la búsqueda lo muestra sin stock y otra compra se rechaza', async () => {
    const compra = await confirmar([
      { codigo: 'PRB-001', cantidad: 1 },
      { codigo: 'PRB-002', cantidad: 2 },
    ]);
    expect(compra.status).toBe(201);

    const busqueda = await request(app).get('/api/medicamentos').query({ q: 'prueba concurrencia' });
    expect(busqueda.body.resultados.map((m) => [m.codigo, m.stock, m.disponible]).sort()).toEqual([
      ['PRB-001', 0, false],
      ['PRB-002', 0, false],
    ]);

    const otra = await confirmar([{ codigo: 'PRB-001', cantidad: 1 }]);
    expect(otra.status).toBe(409);
    expect(otra.body.mensaje).toMatch(/ya no tiene stock disponible/);
  });
});
