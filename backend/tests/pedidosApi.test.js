import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';

// #16 Backend de confirmación: contrato de POST /api/pedidos (MODELO_DE_DATOS.md §3).
describe('POST /api/pedidos', () => {
  let db;
  let app;
  const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
  const contarPedidos = () => db.prepare('SELECT COUNT(*) AS n FROM pedidos').get().n;
  const comprar = (cuerpo) => request(app).post('/api/pedidos').send(cuerpo);

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db });
  });

  it('responde 201 con el pedido en el formato de la API', async () => {
    const res = await comprar({ codigo: 'MED-003', cantidad: 2 });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.pedido).sort()).toEqual(
      ['cantidad', 'estado', 'fechaCreacion', 'items', 'medicamento', 'numeroPedido', 'precioUnitario', 'total'].sort()
    );
    expect(res.body.pedido).toMatchObject({
      medicamento: 'Amlodipino 5 mg',
      cantidad: 2,
      precioUnitario: 1490,
      total: 2980,
      estado: 'Solicitud creada',
    });
  });

  it('ignora precio y total enviados por el cliente: los calcula el servidor', async () => {
    const res = await comprar({ codigo: 'MED-003', cantidad: 2, precioUnitario: 1, total: 1 });
    expect(res.body.pedido.precioUnitario).toBe(1490);
    expect(res.body.pedido.total).toBe(2980);
  });

  it.each([
    ['cero', 0],
    ['negativa', -1],
    ['mayor a 20', 21],
    ['decimal', 1.5],
    ['texto', 'dos'],
    ['ausente', undefined],
  ])('responde 400 cantidad_invalida si la cantidad es %s', async (_caso, cantidad) => {
    const res = await comprar({ codigo: 'MED-003', cantidad });
    expect(res.status).toBe(400);
    expect(res.body.motivo).toBe('cantidad_invalida');
    expect(res.body.mensaje).toMatch(/entre 1 y 20/);
    expect(contarPedidos()).toBe(0);
  });

  it('responde 404 no_existe si el medicamento no está en el catálogo', async () => {
    const res = await comprar({ codigo: 'MED-999', cantidad: 1 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ motivo: 'no_existe', mensaje: 'No encontramos ese medicamento. Vuelve a buscarlo, por favor.' });
  });

  it('responde 404 no_existe si no se envía el código', async () => {
    const res = await comprar({ cantidad: 1 });
    expect(res.status).toBe(404);
    expect(res.body.motivo).toBe('no_existe');
  });

  it('responde 409 sin_stock con "ya no tiene stock" si el medicamento está en 0', async () => {
    const res = await comprar({ codigo: 'MED-014', cantidad: 1 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ motivo: 'sin_stock', mensaje: 'Este medicamento ya no tiene stock disponible.' });
  });

  it('responde 409 sin_stock indicando cuántas unidades quedan si no alcanza', async () => {
    const res = await comprar({ codigo: 'PRB-002', cantidad: 3 });
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toBe(
      'No tenemos stock suficiente para esa cantidad: quedan 2 unidades. Prueba con una cantidad menor.'
    );
    expect(stock('PRB-002')).toBe(2);
  });

  it('guarda el alias recortado y sin espacios de sobra', async () => {
    const res = await comprar({ codigo: 'MED-003', cantidad: 1, alias: '  Vecina del pasaje  ' });
    const fila = db.prepare('SELECT alias_vecino FROM pedidos WHERE numero_pedido = ?').get(res.body.pedido.numeroPedido);
    expect(fila.alias_vecino).toBe('Vecina del pasaje');
  });
});
