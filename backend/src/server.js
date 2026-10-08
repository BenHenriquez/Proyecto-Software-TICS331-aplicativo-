import fs from 'node:fs';
import { config } from './config.js';
import { abrirDb, tablasFaltantes } from './repositories/db.js';
import { crearApp } from './app.js';

if (config.rutaDb !== ':memory:' && !fs.existsSync(config.rutaDb)) {
  console.warn('Aviso: no existe la base de datos. Ejecuta "npm run seed" desde la raíz.');
}

if (!config.tokenBackoffice) {
  console.warn('Aviso: BACKOFFICE_TOKEN está vacío en el .env; el backoffice rechazará todas las peticiones.');
}

const db = abrirDb(config.rutaDb);

// Una base de una versión anterior haría fallar todas las compras: mejor decirlo claro y no arrancar.
const faltantes = tablasFaltantes(db);
if (faltantes.length > 0) {
  console.error(
    `La base de datos es de una versión anterior (faltan las tablas: ${faltantes.join(', ')}). ` +
      'Ejecuta "npm run seed" desde la raíz para recrearla y vuelve a iniciar.',
  );
  process.exit(1);
}

const app = crearApp({ db, tokenBackoffice: config.tokenBackoffice });

app.listen(config.puerto, () => {
  console.log(`API FARMAC-IA escuchando en http://localhost:${config.puerto}/api`);
});
