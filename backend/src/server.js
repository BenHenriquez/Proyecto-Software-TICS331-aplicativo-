import fs from 'node:fs';
import { config } from './config.js';
import { abrirDb } from './repositories/db.js';
import { crearApp } from './app.js';

if (config.rutaDb !== ':memory:' && !fs.existsSync(config.rutaDb)) {
  console.warn('Aviso: no existe la base de datos. Ejecuta "npm run seed" desde la raíz.');
}

const db = abrirDb(config.rutaDb);
const app = crearApp({ db });

app.listen(config.puerto, () => {
  console.log(`API FARMAC-IA escuchando en http://localhost:${config.puerto}/api`);
});
