// Esqueleto del Sprint 1: cada historia reemplaza este handler por su servicio real.
export function noImplementado(_req, res) {
  res.status(501).json({
    motivo: 'no_implementado',
    mensaje: 'Esta parte todavía la estamos construyendo. Vuelve a intentarlo pronto.',
  });
}
