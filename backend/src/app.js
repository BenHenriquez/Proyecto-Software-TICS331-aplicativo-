import express from 'express';
import { crearRutasHealth } from './routes/health.js';
import { crearRutasMedicamentos } from './routes/medicamentos.js';
import { crearRutasPedidos } from './routes/pedidos.js';
import { crearRutasBackoffice } from './routes/backoffice.js';

// Fábrica de la app, separada del listen para poder testearla con supertest.
// `db` se inyecta para que las historias armen sus repositories sobre ella, y
// `tokenBackoffice` (simulado, ver README) para que los tests no dependan del .env.
export function crearApp({ db, tokenBackoffice = '' } = {}) {
  const app = express();
  app.use(express.json());
  app.locals.db = db;
  app.locals.tokenBackoffice = tokenBackoffice;

  app.use('/api', crearRutasHealth());
  app.use('/api', crearRutasMedicamentos());
  app.use('/api', crearRutasPedidos());
  app.use('/api', crearRutasBackoffice());

  app.use('/api', (_req, res) => {
    res.status(404).json({ motivo: 'ruta_no_existe', mensaje: 'No encontramos lo que buscabas.' });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({
      motivo: 'error_interno',
      mensaje: 'Tuvimos un problema. Por favor, inténtalo de nuevo en un momento.',
    });
  });

  return app;
}
