import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { abrirDb, borrarDb } from '../src/repositories/db.js';
import { crearApp } from '../src/app.js';

// US-16 Carrito (#42): la concurrencia de US-15 no se rompe cuando el pedido trae varios ítems.
// Lo delicado es que un carrito rechazado revierta TODOS sus descuentos aunque otro pedido compita.
const ejecutar = promisify(execFile);
const comprador = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers', 'compradorCarritoParalelo.js');
const TIEMPO_MAXIMO = 30_000;

let dir;
let rutaDb;
let db;
let stockInicial;

const CODIGOS = ['PRB-001', 'PRB-002', 'MED-001', 'MED-003'];
const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
const vendidas = (codigo) =>
  db.prepare('SELECT COALESCE(SUM(cantidad), 0) AS n FROM pedido_items WHERE codigo_medicamento = ?').get(codigo).n;
const contar = (tabla) => db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n;

// Lo que importa siempre: nunca negativo, y lo descontado es exactamente lo que quedó en pedidos.
function comprobarInvariantes() {
  for (const codigo of CODIGOS) {
    expect(stock(codigo)).toBeGreaterThanOrEqual(0);
    expect(stockInicial[codigo] - stock(codigo)).toBe(vendidas(codigo));
  }
  const totales = db
    .prepare('SELECT p.total AS total, SUM(i.subtotal) AS suma FROM pedidos p JOIN pedido_items i USING (numero_pedido) GROUP BY p.numero_pedido')
    .all();
  for (const t of totales) expect(t.total).toBe(t.suma);
}

// Base en archivo (no :memory:) para que varios procesos compartan los mismos datos.
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'farmacia-carrito-'));
  rutaDb = path.join(dir, 'farmacia.db');
  sembrar({ rutaDb, rutaCsv: config.rutaSemilla }).db.close();
  db = abrirDb(rutaDb);
  stockInicial = Object.fromEntries(CODIGOS.map((c) => [c, stock(c)]));
});

afterEach(() => {
  db.close();
  borrarDb(rutaDb);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('US-16 · Concurrencia con carritos, peticiones HTTP en paralelo sobre un servidor real', () => {
  let servidor;
  let url;

  beforeEach(async () => {
    servidor = crearApp({ db }).listen(0);
    await new Promise((resolve) => servidor.once('listening', resolve));
    url = `http://127.0.0.1:${servidor.address().port}/api/pedidos`;
  });

  afterEach(async () => {
    await new Promise((resolve) => servidor.close(resolve));
  });

  const confirmar = async (items) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return { status: res.status, cuerpo: await res.json() };
  };

  it('Última unidad: de 20 carritos con la misma unidad solo 1 se confirma y los rechazados no se llevan stock de los otros ítems', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 20 }, () =>
        confirmar([
          { codigo: 'MED-001', cantidad: 1 }, // se descuenta ANTES de llegar a la última unidad
          { codigo: 'PRB-001', cantidad: 1 },
        ])
      )
    );

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    const rechazadas = respuestas.filter((r) => r.status === 409);
    expect(rechazadas).toHaveLength(19);
    for (const r of rechazadas) {
      expect(r.cuerpo.faltantes.map((f) => f.codigo)).toEqual(['PRB-001']);
    }
    expect(stock('PRB-001')).toBe(0);
    // Solo el carrito confirmado descontó Losartán: los 19 revirtieron su descuento
    expect(stock('MED-001')).toBe(stockInicial['MED-001'] - 1);
    expect(contar('pedidos')).toBe(1);
    expect(contar('pedido_items')).toBe(2);
    comprobarInvariantes();
  });

  it('Cantidades parciales: carritos que piden 2 y 1 de las 2 unidades confirman una sola combinación válida', async () => {
    const respuestas = await Promise.all([
      confirmar([{ codigo: 'PRB-002', cantidad: 2 }, { codigo: 'MED-003', cantidad: 1 }]),
      confirmar([{ codigo: 'PRB-002', cantidad: 1 }, { codigo: 'MED-003', cantidad: 1 }]),
    ]);

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(1);
    expect(stock('MED-003')).toBe(stockInicial['MED-003'] - 1);
    comprobarInvariantes();
  });

  it('Carritos con los mismos medicamentos en orden contrario no se bloquean ni dejan stock negativo', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        confirmar(
          i % 2 === 0
            ? [{ codigo: 'PRB-001', cantidad: 1 }, { codigo: 'PRB-002', cantidad: 1 }]
            : [{ codigo: 'PRB-002', cantidad: 1 }, { codigo: 'PRB-001', cantidad: 1 }]
        )
      )
    );

    // PRB-001 tiene 1 unidad: alcanza para un solo carrito
    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    expect(respuestas.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(stock('PRB-001')).toBe(0);
    expect(stock('PRB-002')).toBe(1);
    comprobarInvariantes();
  });

  it('Mezcla de compras simples y carritos: lo descontado siempre coincide con lo que quedó en los pedidos', async () => {
    const simple = async (codigo, cantidad) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codigo, cantidad }),
      });
      return { status: res.status, cuerpo: await res.json() };
    };
    const respuestas = await Promise.all(
      Array.from({ length: 30 }, (_, i) => {
        if (i % 3 === 0) return simple('PRB-002', 1);
        if (i % 3 === 1) return confirmar([{ codigo: 'PRB-002', cantidad: 2 }, { codigo: 'MED-001', cantidad: 1 }]);
        return confirmar([{ codigo: 'PRB-001', cantidad: 1 }, { codigo: 'PRB-002', cantidad: 1 }]);
      })
    );

    expect(respuestas.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(vendidas('PRB-002')).toBeLessThanOrEqual(2);
    expect(vendidas('PRB-001')).toBeLessThanOrEqual(1);
    comprobarInvariantes();
  });
});

describe('US-16 · Concurrencia con carritos entre procesos con conexiones SQLite independientes', () => {
  // Cada comprador es un proceso de Node distinto; todos confirman en el mismo instante.
  const comprarEnParalelo = async (carritos) => {
    const inicio = Date.now() + 2000;
    const resultados = await Promise.all(
      carritos.map((items) => ejecutar(process.execPath, [comprador, rutaDb, JSON.stringify(items), String(inicio)]))
    );
    return resultados.map(({ stdout }) => JSON.parse(stdout));
  };

  it(
    'Última unidad: 8 procesos con carritos de 2 ítems, solo 1 se confirma y no se pierde stock del otro ítem',
    async () => {
      const carrito = [
        { codigo: 'MED-001', cantidad: 1 },
        { codigo: 'PRB-001', cantidad: 1 },
      ];
      const resultados = await comprarEnParalelo(Array.from({ length: 8 }, () => carrito));

      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      expect(resultados.filter((r) => !r.ok).every((r) => r.motivo === 'sin_stock')).toBe(true);
      expect(stock('PRB-001')).toBe(0);
      expect(stock('MED-001')).toBe(stockInicial['MED-001'] - 1);
      expect(contar('pedidos')).toBe(1);
      comprobarInvariantes();
    },
    TIEMPO_MAXIMO
  );

  it(
    'Cantidades parciales: carritos que piden 2 y 1 de las 2 unidades nunca dejan el stock negativo',
    async () => {
      const carritos = Array.from({ length: 6 }, (_, i) => [
        { codigo: 'PRB-002', cantidad: i % 2 === 0 ? 2 : 1 },
        { codigo: 'MED-003', cantidad: 1 },
      ]);
      const resultados = await comprarEnParalelo(carritos);

      const confirmados = resultados.filter((r) => r.ok).length;
      expect(confirmados).toBeGreaterThan(0);
      expect(vendidas('PRB-002')).toBeLessThanOrEqual(2);
      // Cada carrito confirmado se llevó exactamente 1 unidad de Amlodipino; los rechazados, ninguna
      expect(stock('MED-003')).toBe(stockInicial['MED-003'] - confirmados);
      expect(contar('pedidos')).toBe(confirmados);
      comprobarInvariantes();
    },
    TIEMPO_MAXIMO
  );
});
