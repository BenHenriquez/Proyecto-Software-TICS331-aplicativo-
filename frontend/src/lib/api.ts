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

// --- Backoffice (US-13, #13) -------------------------------------------------------------------
// La clave es un token SIMULADO (README): viaja en el header x-backoffice-token y se guarda solo en memoria.

// Elemento de GET /api/backoffice/medicamentos: lo mismo que la búsqueda más la `version` que el
// panel devuelve al guardar (candado de #12).
export interface MedicamentoBackoffice extends Medicamento {
  version: number;
}

// Motivo por campo de un 400 `datos_invalidos` (MODELO_DE_DATOS.md §3).
export interface ErroresCampo {
  precioUnitario?: string;
  stock?: string;
  version?: string;
  general?: string;
}

// Lo que se envía al guardar. Un valor inválido se envía tal cual: el backend decide y explica el motivo.
export interface CambiosMedicamento {
  precioUnitario?: number | string;
  stock?: number | string;
}

export class ErrorNoAutorizado extends ErrorApi {}
export class ErrorConflicto extends ErrorApi {}
export class ErrorValidacion extends ErrorApi {
  readonly errores: ErroresCampo;
  constructor(mensaje: string, errores: ErroresCampo) {
    super(mensaje);
    this.errores = errores;
  }
}

const MENSAJE_PANEL_GENERICO = 'Tuvimos un problema con el panel. Por favor, inténtalo de nuevo en un momento.';
const MENSAJE_GUARDAR_GENERICO = 'Tuvimos un problema al guardar el cambio. Por favor, inténtalo de nuevo en un momento.';

function soloTextos(valor: unknown): ErroresCampo {
  const errores: ErroresCampo = {};
  if (valor === null || typeof valor !== 'object') return errores;
  for (const campo of ['precioUnitario', 'stock', 'version', 'general'] as const) {
    const texto = (valor as Record<string, unknown>)[campo];
    if (typeof texto === 'string') errores[campo] = texto;
  }
  return errores;
}

async function pedirBackoffice(
  metodo: 'GET' | 'PUT',
  ruta: string,
  clave: string,
  mensajeGenerico: string,
  cuerpo?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = { 'x-backoffice-token': clave };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';

  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(MENSAJE_SIN_CONEXION);
  }

  const datos = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos;

  // Los 4xx traen un `mensaje` en español pensado para la funcionaria; los 5xx nunca se muestran.
  const mensaje = respuesta.status < 500 && typeof datos?.mensaje === 'string' ? datos.mensaje : mensajeGenerico;
  if (respuesta.status === 401) throw new ErrorNoAutorizado(mensaje);
  if (respuesta.status === 409) throw new ErrorConflicto(mensaje);
  if (respuesta.status === 400) throw new ErrorValidacion(mensaje, soloTextos(datos?.errores));
  throw new ErrorApi(mensaje);
}

export async function listarBackoffice(clave: string): Promise<MedicamentoBackoffice[]> {
  const datos = (await pedirBackoffice('GET', '/api/backoffice/medicamentos', clave, MENSAJE_PANEL_GENERICO)) as {
    medicamentos?: unknown;
  } | null;
  if (!datos || !Array.isArray(datos.medicamentos)) throw new ErrorApi(MENSAJE_PANEL_GENERICO);
  return datos.medicamentos as MedicamentoBackoffice[];
}

export async function guardarMedicamento(
  clave: string,
  codigo: string,
  cambios: CambiosMedicamento,
  version: number,
): Promise<MedicamentoBackoffice> {
  const datos = (await pedirBackoffice(
    'PUT',
    `/api/backoffice/medicamentos/${encodeURIComponent(codigo)}`,
    clave,
    MENSAJE_GUARDAR_GENERICO,
    { ...cambios, version },
  )) as { medicamento?: MedicamentoBackoffice } | null;
  if (!datos?.medicamento) throw new ErrorApi(MENSAJE_GUARDAR_GENERICO);
  return datos.medicamento;
}

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
