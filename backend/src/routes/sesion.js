import { Router } from 'express';
import { leerCookie } from '../middleware/cookies.js';
import { crearSesionesRepository } from '../repositories/sesionesRepository.js';
import { crearSesionService, HORAS_SESION, MINUTOS_VIGENCIA_QR } from '../services/sesionService.js';

// US-17 Ingreso con Neuro-Access (#43, #46). Contrato en MODELO_DE_DATOS.md §3.
export const COOKIE_SESION = 'farmacia_sesion';
export const COOKIE_INGRESO = 'farmacia_ingreso';
const OPCIONES_COOKIE = { httpOnly: true, sameSite: 'lax', path: '/api' };
// La cookie del intento dura más que el código: así, al vencer, el backend todavía reconoce el intento
// y puede decir "tu código venció" en vez de "ya no sirve" (prueba en vivo de US-17).
const MINUTOS_COOKIE_INGRESO = MINUTOS_VIGENCIA_QR + 10;

export function crearRutasSesion({ proveedor, ahora }) {
  const router = Router();
  let servicio;
  // Se arma en la primera petición sobre la db que crearApp dejó en app.locals.
  const servicioDe = (req) =>
    (servicio ??= crearSesionService(crearSesionesRepository(req.app.locals.db), { proveedor, ahora }));

  // Para todas las rutas /api: deja en req.vecino al vecino con sesión vigente (o null).
  // Sin cookie no se toca la base (el health no depende del esquema).
  router.use((req, _res, next) => {
    const token = leerCookie(req, COOKIE_SESION);
    req.vecino = token ? servicioDe(req).vecinoDeSesion(token) : null;
    next();
  });

  router.post('/sesion/qr', async (req, res) => {
    const r = await servicioDe(req).iniciarIngreso();
    if (!r.ok) return res.status(502).json({ motivo: r.motivo, mensaje: r.mensaje });

    res.cookie(COOKIE_INGRESO, r.llave, { ...OPCIONES_COOKIE, maxAge: MINUTOS_COOKIE_INGRESO * 60_000 });
    res.status(201).json({ modo: r.modo, qr: r.qr, enlace: r.enlace, venceEn: r.venceEn });
  });

  router.get('/sesion/qr', (req, res) => {
    const r = servicioDe(req).consultarIngreso(leerCookie(req, COOKIE_INGRESO));
    if (r.estado !== 'aprobado') return res.status(200).json(r);

    // El token de sesión viaja solo en la cookie httpOnly, nunca en el cuerpo.
    res.cookie(COOKIE_SESION, r.sesion.token, { ...OPCIONES_COOKIE, maxAge: HORAS_SESION * 3_600_000 });
    res.clearCookie(COOKIE_INGRESO, OPCIONES_COOKIE);
    res.status(200).json({ estado: r.estado, vecino: r.vecino });
  });

  // Solo existe con el proveedor simulado (tests y respaldo de la demo).
  router.post('/sesion/qr/simular', (req, res, next) => {
    const r = servicioDe(req).simularAprobacion(leerCookie(req, COOKIE_INGRESO));
    if (r.motivo === 'no_disponible') return next(); // sigue al 404 general
    if (!r.ok) return res.status(409).json({ motivo: r.motivo, mensaje: 'Genera un código nuevo, por favor.' });
    res.status(200).json({ ok: true });
  });

  // Lo llama el Neuron (servidor a servidor) cuando el vecino aprueba en Neuro-Access.
  // El Neuron espera JSON de vuelta; `null` es válido. Nunca se escribe el cuerpo en logs.
  router.post('/sesion/callback', (req, res) => {
    const r = servicioDe(req).recibirAprobacion(req.body);
    if (r.ok) return res.status(200).json(null);
    res.status(r.motivo === 'datos_invalidos' ? 400 : 409).json({ motivo: r.motivo });
  });

  router.get('/sesion', (req, res) => {
    res.status(200).json({ vecino: req.vecino ? { nombre: req.vecino.nombre } : null });
  });

  router.post('/sesion/cerrar', (req, res) => {
    servicioDe(req).cerrarSesion(leerCookie(req, COOKIE_SESION));
    res.clearCookie(COOKIE_SESION, OPCIONES_COOKIE);
    res.status(200).json({ ok: true });
  });

  return router;
}
