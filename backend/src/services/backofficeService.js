// US-13 Mantener stock (#2). Valida todo ANTES de guardar: si algún valor es inválido no se
// modifica nada y se informa el motivo de cada campo. Los mensajes son para la funcionaria.
// Topes razonables: sin ellos, un valor gigante (1e308) se guardaría como decimal y rompería los totales.
export const PRECIO_MAXIMO = 10_000_000;
export const STOCK_MAXIMO = 1_000_000;

const MENSAJES = {
  precioUnitario: 'El precio debe ser un número entero mayor que cero y de hasta diez millones.',
  stock: 'El stock debe ser un número entero, desde cero y de hasta un millón.',
  general: 'Indica el precio o el stock que quieres cambiar.',
  datos_invalidos: 'No guardamos ningún cambio. Revisa los datos marcados e inténtalo de nuevo.',
  no_existe: 'No encontramos ese medicamento. Vuelve a buscarlo, por favor.',
};

const tiene = (cuerpo, campo) => Object.hasOwn(cuerpo, campo);
const esPrecioValido = (valor) => Number.isSafeInteger(valor) && valor > 0 && valor <= PRECIO_MAXIMO;
const esStockValido = (valor) => Number.isSafeInteger(valor) && valor >= 0 && valor <= STOCK_MAXIMO;

function aVista(fila) {
  return {
    codigo: fila.codigo,
    nombre: fila.nombre,
    principioActivo: fila.principio_activo,
    presentacion: fila.presentacion,
    precioUnitario: fila.precio_unitario,
    stock: fila.stock,
    disponible: fila.stock > 0,
    version: fila.version,
  };
}

export function crearBackofficeService(medicamentosRepository) {
  return {
    // Solo se editan precio y stock; cualquier otro campo del cuerpo se ignora.
    // `version` (candado frente a ventas simultáneas) lo agrega #12 sobre este mismo método.
    actualizarMedicamento(codigo, cuerpo) {
      const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};
      const errores = {};

      if (!tiene(datos, 'precioUnitario') && !tiene(datos, 'stock')) {
        errores.general = MENSAJES.general;
      }
      if (tiene(datos, 'precioUnitario') && !esPrecioValido(datos.precioUnitario)) {
        errores.precioUnitario = MENSAJES.precioUnitario;
      }
      if (tiene(datos, 'stock') && !esStockValido(datos.stock)) {
        errores.stock = MENSAJES.stock;
      }
      if (Object.keys(errores).length > 0) {
        return { ok: false, motivo: 'datos_invalidos', mensaje: MENSAJES.datos_invalidos, errores };
      }

      const fila = medicamentosRepository.actualizarPrecioYStock({
        codigo,
        precioUnitario: tiene(datos, 'precioUnitario') ? datos.precioUnitario : null,
        stock: tiene(datos, 'stock') ? datos.stock : null,
      });
      if (!fila) return { ok: false, motivo: 'no_existe', mensaje: MENSAJES.no_existe };

      return { ok: true, medicamento: aVista(fila) };
    },
  };
}
