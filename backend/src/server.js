import fs from 'node:fs';
import { config } from './config.js';
import { abrirDb } from './repositories/db.js';
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
// US-17 agregó columnas y tablas: una base creada antes rompe la compra hasta volver a sembrarla.
const columnasPedidos = db.prepare('PRAGMA table_info(pedidos)').all().map((c) => c.name);
if (columnasPedidos.length > 0 && !columnasPedidos.includes('vecino_id')) {
  console.warn('Aviso: la base es de una versión anterior (falta pedidos.vecino_id). Ejecuta "npm run seed" desde la raíz.');
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
