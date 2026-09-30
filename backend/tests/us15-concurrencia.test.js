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

// #20 Pruebas de concurrencia de US-15 sobre PRB-001 (1 unidad) y PRB-002 (2 unidades).
const ejecutar = promisify(execFile);
const comprador = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers', 'compradorParalelo.js');
const TIEMPO_MAXIMO = 30_000;

let dir;
let rutaDb;
let db;

const stock = (codigo) => db.prepare('SELECT stock FROM medicamentos WHERE codigo = ?').get(codigo).stock;
const pedidosDe = (codigo) => db.prepare('SELECT cantidad FROM pedidos WHERE codigo_medicamento = ?').all(codigo);

// Base en archivo (no :memory:) para que varios procesos compartan los mismos datos.
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'farmacia-concurrencia-'));
  rutaDb = path.join(dir, 'farmacia.db');
  sembrar({ rutaDb, rutaCsv: config.rutaSemilla }).db.close();
  db = abrirDb(rutaDb);
});

afterEach(() => {
  db.close();
  borrarDb(rutaDb);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('US-15 · Concurrencia con peticiones HTTP en paralelo sobre un servidor real', () => {
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

  const comprar = async (codigo, cantidad) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codigo, cantidad }),
    });
    return { status: res.status, cuerpo: await res.json(), cantidad };
  };

  it('Última unidad: de 20 compras simultáneas solo 1 se confirma y el stock queda en 0', async () => {
    const respuestas = await Promise.all(Array.from({ length: 20 }, () => comprar('PRB-001', 1)));

    const confirmadas = respuestas.filter((r) => r.status === 201);
    const rechazadas = respuestas.filter((r) => r.status === 409);
    expect(confirmadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(19);
    for (const r of rechazadas) {
      expect(r.cuerpo.mensaje).toBe('Este medicamento ya no tiene stock disponible.');
    }
    expect(stock('PRB-001')).toBe(0);
    expect(pedidosDe('PRB-001')).toHaveLength(1);
  });

  it('Cantidades parciales: 2 y 1 a la vez sobre 2 unidades confirman una sola combinación válida', async () => {
    const respuestas = await Promise.all([comprar('PRB-002', 2), comprar('PRB-002', 1)]);

    const confirmadas = respuestas.filter((r) => r.status === 201);
    expect(confirmadas).toHaveLength(1);
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(1);
    expect(stock('PRB-002')).toBe(2 - confirmadas[0].cantidad);
    expect(pedidosDe('PRB-002')).toEqual([{ cantidad: confirmadas[0].cantidad }]);
  });

  it('Cantidades parciales con 20 compras mezcladas: nunca se vende más de lo que hay', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 20 }, (_, i) => comprar('PRB-002', i % 2 === 0 ? 2 : 1))
    );

    const vendidas = respuestas.filter((r) => r.status === 201).reduce((suma, r) => suma + r.cantidad, 0);
    expect(vendidas).toBeLessThanOrEqual(2);
    expect(stock('PRB-002')).toBe(2 - vendidas);
    expect(stock('PRB-002')).toBeGreaterThanOrEqual(0);
    expect(pedidosDe('PRB-002').reduce((suma, p) => suma + p.cantidad, 0)).toBe(vendidas);
  });
});

describe('US-15 · Concurrencia real entre procesos con conexiones SQLite independientes', () => {
  // Cada comprador es un proceso de Node distinto; todos confirman en el mismo instante.
  const comprarEnParalelo = async (compras) => {
    const inicio = Date.now() + 2000;
    const resultados = await Promise.all(
      compras.map(({ codigo, cantidad }) =>
        ejecutar(process.execPath, [comprador, rutaDb, codigo, String(cantidad), String(inicio)])
      )
    );
    return resultados.map(({ stdout }) => JSON.parse(stdout));
  };

  it(
    'Última unidad: 8 procesos compran a la vez y solo 1 se confirma, sin stock -1',
    async () => {
      const resultados = await comprarEnParalelo(Array.from({ length: 8 }, () => ({ codigo: 'PRB-001', cantidad: 1 })));

      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      expect(resultados.filter((r) => !r.ok).every((r) => r.motivo === 'sin_stock')).toBe(true);
      expect(stock('PRB-001')).toBe(0);
      expect(pedidosDe('PRB-001')).toHaveLength(1);
    },
    TIEMPO_MAXIMO
  );

  it(
    'Cantidades parciales: procesos que piden 2 y 1 a la vez nunca dejan el stock negativo',
    async () => {
      const compras = Array.from({ length: 6 }, (_, i) => ({ codigo: 'PRB-002', cantidad: i % 2 === 0 ? 2 : 1 }));
      const resultados = await comprarEnParalelo(compras);

      const vendidas = resultados.filter((r) => r.ok).reduce((suma, r) => suma + r.cantidad, 0);
      expect(vendidas).toBeGreaterThan(0);
      expect(vendidas).toBeLessThanOrEqual(2);
      expect(stock('PRB-002')).toBe(2 - vendidas);
      expect(pedidosDe('PRB-002').reduce((suma, p) => suma + p.cantidad, 0)).toBe(vendidas);
    },
    TIEMPO_MAXIMO
  );
});
