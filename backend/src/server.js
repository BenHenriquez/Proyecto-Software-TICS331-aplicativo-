import fs from 'node:fs';
import { config } from './config.js';
import { abrirDb, tablasFaltantes } from './repositories/db.js';
import { crearApp } from './app.js';
import { crearProveedorNeuron } from './proveedores/identidadNeuron.js';
import { crearProveedorSimulado } from './proveedores/identidadSimulada.js';

if (config.rutaDb !== ':memory:' && !fs.existsSync(config.rutaDb)) {
  console.warn('Aviso: no existe la base de datos. Ejecuta "npm run seed" desde la raíz.');
}

if (!config.tokenBackoffice) {
  console.warn('Aviso: BACKOFFICE_TOKEN está vacío en el .env; el backoffice rechazará todas las peticiones.');
}

const { identidad } = config;
let proveedorIdentidad = crearProveedorSimulado();
if (identidad.proveedor === 'neuron') {
  if (!identidad.urlPublicaApi.startsWith('https://')) {
    console.warn('Aviso: IDENTIDAD_PROVEEDOR=neuron necesita URL_PUBLICA_API con https:// (túnel); el ingreso fallará.');
  }
  proveedorIdentidad = crearProveedorNeuron({
    dominio: identidad.neuronDominio,
    urlCallback: identidad.urlPublicaApi ? `${identidad.urlPublicaApi}/api/sesion/callback` : '',
  });
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

const app = crearApp({ db, tokenBackoffice: config.tokenBackoffice, proveedorIdentidad });

app.listen(config.puerto, () => {
  console.log(`API FARMAC-IA escuchando en http://localhost:${config.puerto}/api`);
  console.log(
    identidad.proveedor === 'neuron'
      ? `Ingreso con Neuro-Access usando el Neuron ${identidad.neuronDominio}.`
      : 'Ingreso con Neuro-Access en modo SIMULADO (IDENTIDAD_PROVEEDOR=neuron para usar el real).'
  );
});
