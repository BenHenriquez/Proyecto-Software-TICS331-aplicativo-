// Cliente del backend (MODELO_DE_DATOS.md §3). En desarrollo, Vite hace proxy de /api al backend.

// Resultado de GET /api/medicamentos?q=
export interface Medicamento {
  codigo: string;
  nombre: string;
  principioActivo: string;
  presentacion: string;
  precioUnitario: number;
  stock: number;
  disponible: boolean;
}

export interface RespuestaBusqueda {
  resultados: Medicamento[];
  // Solo viene cuando no hubo coincidencias: texto en español para la vecina.
  mensaje?: string;
}

const MENSAJE_SIN_CONEXION =
  'No pudimos conectarnos con la farmacia. Revisa tu conexión a internet e inténtalo de nuevo.';
const MENSAJE_GENERICO = 'Tuvimos un problema al buscar. Por favor, inténtalo de nuevo en un momento.';

// Error con un mensaje ya listo para mostrar: nunca códigos ni textos técnicos (regla 6).
export class ErrorApi extends Error {}

export async function buscarMedicamentos(q: string, signal?: AbortSignal): Promise<RespuestaBusqueda> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/medicamentos?q=${encodeURIComponent(q)}`, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ErrorApi(MENSAJE_SIN_CONEXION);
  }

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // Los 4xx traen un `mensaje` pensado para la vecina (por ejemplo, "Escribe al menos 2 letras…").
    const mensaje = respuesta.status < 500 && typeof cuerpo?.mensaje === 'string' ? cuerpo.mensaje : null;
    throw new ErrorApi(mensaje ?? MENSAJE_GENERICO);
  }
  if (!cuerpo || !Array.isArray(cuerpo.resultados)) throw new ErrorApi(MENSAJE_GENERICO);
  return cuerpo as RespuestaBusqueda;
}
