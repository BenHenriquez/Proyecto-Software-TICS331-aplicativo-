import express from 'express';
import { crearRutasHealth } from './routes/health.js';
import { crearRutasMedicamentos } from './routes/medicamentos.js';
import { crearRutasPedidos } from './routes/pedidos.js';
import { crearRutasBackoffice } from './routes/backoffice.js';
import { crearRutasSesion } from './routes/sesion.js';
import { crearProveedorSimulado } from './proveedores/identidadSimulada.js';

// Fábrica de la app, separada del listen para poder testearla con supertest.
// `db` se inyecta para que las historias armen sus repositories sobre ella, y
// `tokenBackoffice` (simulado, ver README) para que los tests no dependan del .env.
// `proveedorIdentidad` (US-17): Neuro-Access real o simulado (por defecto); `ahora` permite a los
// tests adelantar el reloj para probar códigos y sesiones vencidas.
export function crearApp({
  db,
  tokenBackoffice = '',
  proveedorIdentidad = crearProveedorSimulado(),
  ahora = () => new Date(),
} = {}) {
  const app = express();
  // El callback del Neuron trae la identidad firmada (y adjuntos): más espacio que el resto de la API.
  app.use('/api/sesion/callback', express.json({ limit: '1mb', type: () => true }));
  app.use(express.json());
  app.locals.db = db;
  app.locals.tokenBackoffice = tokenBackoffice;

  // Va primero: deja req.vecino listo para las demás rutas.
  app.use('/api', crearRutasSesion({ proveedor: proveedorIdentidad, ahora }));
  app.use('/api', crearRutasHealth());
  app.use('/api', crearRutasMedicamentos());
  app.use('/api', crearRutasPedidos());
  app.use('/api', crearRutasBackoffice());

  app.use('/api', (_req, res) => {
    res.status(404).json({ motivo: 'ruta_no_existe', mensaje: 'No encontramos lo que buscabas.' });
  });

  app.use((err, _req, res, _next) => {
    // Un JSON mal formado, un cuerpo demasiado grande o una dirección inválida son errores de
    // quien envía (4xx), no del servidor.
    if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({
        motivo: 'solicitud_invalida',
        mensaje:
          err.status === 413
            ? 'Lo que enviaste es demasiado grande. Envía menos datos e inténtalo de nuevo.'
            : 'No pudimos leer lo que enviaste. Revisa los datos e inténtalo de nuevo.',
      });
    }
    console.error(err);
    res.status(500).json({
      motivo: 'error_interno',
      mensaje: 'Tuvimos un problema. Por favor, inténtalo de nuevo en un momento.',
    });
  });

  return app;
}
