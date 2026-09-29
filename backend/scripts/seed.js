import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';

const { db, cantidad } = sembrar({ rutaDb: config.rutaDb, rutaCsv: config.rutaSemilla });
db.close();
console.log(`Base recreada en ${config.rutaDb} con ${cantidad} medicamentos sintéticos.`);
