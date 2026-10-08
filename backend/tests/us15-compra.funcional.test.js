import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';

// #19 Pruebas funcionales de US-15: un test por escenario Gherkin (docs/sprint-1/META_Y_BACKLOG.md §1.3).
describe('US-15 · Realizar compra/pedido', () => {
  let db;
  let app;
  const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
  const pedidosDe = (codigo) => db.prepare('SELECT * FROM pedido_items WHERE codigo_medicamento = ?').all(codigo);

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db });
  });

  it('Escenario feliz: con stock de Losartán, confirmar crea el pedido y descuenta el stock', async () => {
    // Dado que Losartán tiene stock disponible
    const stockInicial = stock('MED-001');
    expect(stockInicial).toBeGreaterThan(0);

    // Cuando la vecina selecciona una cantidad y confirma la compra
    const res = await request(app).post('/api/pedidos').send({ codigo: 'MED-001', cantidad: 2 });

    // Entonces el sistema crea un pedido con medicamento, cantidad, total y estado inicial
    expect(res.status).toBe(201);
    expect(res.body.pedido).toMatchObject({
      medicamento: 'Losartán 50 mg',
      cantidad: 2,
      precioUnitario: 1990,
      total: 3980,
      estado: 'Solicitud creada',
    });
    expect(res.body.pedido.numeroPedido).toMatch(/^P-[A-Z0-9]{6}$/);
    expect(pedidosDe('MED-001')).toHaveLength(1);

    // Y descuenta esa cantidad del stock
    expect(stock('MED-001')).toBe(stockInicial - 2);
  });

  it('Escenario de error: sin stock suficiente, no se crea el pedido y se informa claramente', async () => {
    // Dado que el medicamento no tiene stock suficiente para la cantidad solicitada
    expect(stock('PRB-002')).toBe(2);

    // Cuando la vecina intenta confirmar la compra
    const res = await request(app).post('/api/pedidos').send({ codigo: 'PRB-002', cantidad: 5 });

    // Entonces el sistema no crea el pedido
    expect(res.status).toBe(409);
    expect(pedidosDe('PRB-002')).toHaveLength(0);
    expect(stock('PRB-002')).toBe(2);

    // Y le informa claramente la indisponibilidad (texto para la vecina, no un código)
    expect(res.body.motivo).toBe('sin_stock');
    expect(res.body.mensaje).toMatch(/stock suficiente/);
  });

  it('Escenario de error: medicamento agotado (stock 0) responde "ya no tiene stock disponible"', async () => {
    const res = await request(app).post('/api/pedidos').send({ codigo: 'MED-019', cantidad: 1 });

    expect(res.status).toBe(409);
    expect(res.body.mensaje).toBe('Este medicamento ya no tiene stock disponible.');
    expect(pedidosDe('MED-019')).toHaveLength(0);
    expect(stock('MED-019')).toBe(0);
  });

  it('Compras sucesivas agotan el stock exacto y la siguiente se rechaza', async () => {
    const primera = await request(app).post('/api/pedidos').send({ codigo: 'PRB-002', cantidad: 2 });
    const segunda = await request(app).post('/api/pedidos').send({ codigo: 'PRB-002', cantidad: 1 });

    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(409);
    expect(segunda.body.mensaje).toBe('Este medicamento ya no tiene stock disponible.');
    expect(stock('PRB-002')).toBe(0);
  });
});
