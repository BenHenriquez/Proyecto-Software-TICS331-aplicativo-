// Token SIMULADO del backoffice (ver README): se compara el header x-backoffice-token con
// BACKOFFICE_TOKEN del .env. No es autenticación real, solo protege el prototipo.
// Si el servidor no tiene token configurado, nada entra: un token vacío nunca autoriza.
export function requiereTokenBackoffice(req, res, next) {
  const esperado = req.app.locals.tokenBackoffice;
  const recibido = req.get('x-backoffice-token');

  if (typeof esperado === 'string' && esperado !== '' && recibido === esperado) return next();

  res.status(401).json({
    motivo: 'no_autorizado',
    mensaje: 'Necesitas la clave del equipo de la farmacia para entrar aquí.',
  });
}
