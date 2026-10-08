import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Rutas ancladas a este archivo: funcionan igual si el script corre desde la raíz o desde backend/.
// DB_PATH relativo se interpreta desde la raíz del repositorio.
const dirBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirRaiz = path.resolve(dirBackend, '..');

dotenv.config({ path: path.join(dirRaiz, '.env'), quiet: true });

function resolverRutaDb(valor) {
  if (!valor) return path.join(dirBackend, 'data', 'farmacia.db');
  if (valor === ':memory:' || path.isAbsolute(valor)) return valor;
  return path.join(dirRaiz, valor);
}

export const config = {
  puerto: Number(process.env.PORT) || 3001,
  rutaDb: resolverRutaDb(process.env.DB_PATH),
  // Token SIMULADO del backoffice (ver README). No es un mecanismo de seguridad real.
  tokenBackoffice: process.env.BACKOFFICE_TOKEN ?? '',
  rutaSemilla: path.join(dirBackend, 'seed', 'medicamentos_semilla.csv'),
  // US-17: "neuron" usa Quick Login de Neuro-Access; cualquier otro valor, el proveedor simulado.
  identidad: {
    proveedor: process.env.IDENTIDAD_PROVEEDOR === 'neuron' ? 'neuron' : 'simulado',
    neuronDominio: process.env.NEURON_DOMINIO || 'lab.tagroot.io',
    // URL HTTPS pública que llega a este backend (túnel cloudflared en desarrollo).
    urlPublicaApi: (process.env.URL_PUBLICA_API ?? '').replace(/\/+$/, ''),
  },
};
