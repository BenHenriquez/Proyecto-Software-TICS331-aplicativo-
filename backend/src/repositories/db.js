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

export function borrarDb(rutaDb) {
  if (rutaDb === ':memory:') return;
  for (const sufijo of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(rutaDb + sufijo, { force: true });
  }
}
