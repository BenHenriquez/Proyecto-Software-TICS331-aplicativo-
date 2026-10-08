// US-17 (#46). Proveedor de identidad SIMULADO: mismo contrato que el del Neuron, sin red.
// Sirve para los tests (no pueden escanear un QR) y como respaldo de la demo. No entrega QR:
// el front muestra un botón "Simular escaneo" que aprueba con una vecina ficticia.
export const IDENTIDAD_SIMULADA = Object.freeze({
  identidadId: 'vecina-rosa@simulado',
  nombre: 'Rosa',
});

export function crearProveedorSimulado() {
  return {
    modo: 'simulado',
    dominio: null,

    async iniciar() {
      return { qr: null, enlace: null };
    },
  };
}
