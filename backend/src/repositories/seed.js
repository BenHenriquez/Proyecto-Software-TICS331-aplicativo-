import { abrirDb, borrarDb, crearEsquema } from './db.js';
import { crearMedicamentosRepository } from './medicamentosRepository.js';
import { leerSemillaCsv } from './semillaCsv.js';

// Recrea la base desde cero y carga la semilla sintética con version = 0.
export function sembrar({ rutaDb, rutaCsv }) {
  borrarDb(rutaDb);
  const db = abrirDb(rutaDb);
  crearEsquema(db);
  const medicamentos = leerSemillaCsv(rutaCsv);
  crearMedicamentosRepository(db).insertarVarios(medicamentos);
  return { db, cantidad: medicamentos.length };
}
