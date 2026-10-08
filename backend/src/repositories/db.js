import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// Solo la capa repositories toca SQLite (ADR-01). En el Sprint 2 se reemplaza por Praxsuite.
const rutaEsquema = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/schema.sql');

export function abrirDb(rutaDb) {
  if (rutaDb !== ':memory:') fs.mkdirSync(path.dirname(rutaDb), { recursive: true });
  const db = new Database(rutaDb);
  db.pragma('foreign_keys = ON');
  return db;
}

export function crearEsquema(db) {
  db.exec(fs.readFileSync(rutaEsquema, 'utf8'));
}

// Tablas que el código necesita. Si la base viene de una versión anterior (por ejemplo, de antes de US-16,
// sin `pedido_items`, o de antes de US-17, sin `vecinos`), cada compra fallaría con un error interno
// mientras /api/health dice que todo está bien.
const TABLAS_REQUERIDAS = ['medicamentos', 'pedidos', 'pedido_items', 'vecinos', 'intentos_ingreso', 'sesiones'];

export function tablasFaltantes(db) {
  const existentes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all());
  return TABLAS_REQUERIDAS.filter((tabla) => !existentes.has(tabla));
}

export function borrarDb(rutaDb) {
  if (rutaDb === ':memory:') return;
  for (const sufijo of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(rutaDb + sufijo, { force: true });
  }
}
