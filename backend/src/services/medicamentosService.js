// US-02 Consultar medicamento (#1). Normaliza lo que escribe la vecina igual que la columna
// `busqueda` de la semilla (minúsculas, sin tildes) y arma la vista con los nombres del contrato.
export const LARGO_MINIMO = 2;
export const LARGO_MAXIMO = 100;

const MENSAJES = {
  busqueda_muy_corta: 'Escribe al menos 2 letras del nombre o del principio activo del medicamento.',
  busqueda_invalida: 'No pudimos entender tu búsqueda. Escribe el nombre del medicamento e inténtalo de nuevo.',
  sin_resultados:
    'No encontramos ese medicamento. Revisa cómo está escrito o prueba buscando por su principio activo.',
};

// "  Losartán  POTÁSICO " → "losartan potasico". NFD separa la tilde de la letra y luego se quita.
export function normalizarBusqueda(texto) {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function aVista(fila) {
  return {
    codigo: fila.codigo,
    nombre: fila.nombre,
    principioActivo: fila.principio_activo,
    presentacion: fila.presentacion,
    precioUnitario: fila.precio_unitario,
    stock: fila.stock,
    disponible: fila.stock > 0,
  };
}

export function crearMedicamentosService(medicamentosRepository) {
  return {
    // `q` llega tal cual desde la URL: puede faltar, venir repetido (arreglo) o ser muy largo.
    buscar(q) {
      if (q !== undefined && typeof q !== 'string') {
        return { ok: false, motivo: 'busqueda_invalida', mensaje: MENSAJES.busqueda_invalida };
      }
      if (q !== undefined && q.length > LARGO_MAXIMO) {
        return { ok: false, motivo: 'busqueda_invalida', mensaje: MENSAJES.busqueda_invalida };
      }
      const termino = normalizarBusqueda(q ?? '');
      if (termino.length < LARGO_MINIMO) {
        return { ok: false, motivo: 'busqueda_muy_corta', mensaje: MENSAJES.busqueda_muy_corta };
      }

      const resultados = medicamentosRepository.buscar(termino.split(' ')).map(aVista);
      if (resultados.length === 0) return { ok: true, resultados, mensaje: MENSAJES.sin_resultados };
      return { ok: true, resultados };
    },
  };
}
