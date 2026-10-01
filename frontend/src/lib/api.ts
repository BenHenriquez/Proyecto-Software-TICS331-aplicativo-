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

// --- Pedido (US-15, #18) -----------------------------------------------------------------------
// Respuesta de POST /api/pedidos (MODELO_DE_DATOS.md §3). El precio y el total los calcula el backend.
export interface Pedido {
  numeroPedido: string;
  medicamento: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  estado: string;
  fechaCreacion: string;
}

// El backend rechazó el pedido (400, 404 o 409): NO se creó ningún pedido y no sirve reintentar tal cual.
export class ErrorPedidoRechazado extends ErrorApi {}
// El backend respondió bien pero no se pudo leer el pedido: pudo haberse creado y descontado stock,
// así que reintentar crearía un segundo pedido.
export class ErrorPedidoIncierto extends ErrorApi {}

const MENSAJE_SIN_CONEXION_PEDIDO =
  'No pudimos conectarnos con la farmacia, así que no sabemos si tu pedido se creó. Revisa tu conexión a internet e inténtalo de nuevo; si ya lo habías intentado antes, consulta primero en la farmacia.';
const MENSAJE_PEDIDO_GENERICO = 'Tuvimos un problema al crear tu pedido. Por favor, inténtalo de nuevo en un momento.';
const MENSAJE_PEDIDO_INCIERTO =
  'No pudimos mostrarte tu pedido, pero es posible que se haya creado. Antes de intentar de nuevo, consúltalo en la farmacia.';

function esPedido(valor: unknown): valor is Pedido {
  if (valor === null || typeof valor !== 'object') return false;
  const p = valor as Record<string, unknown>;
  return (
    typeof p.numeroPedido === 'string' &&
    p.numeroPedido !== '' &&
    typeof p.medicamento === 'string' &&
    Number.isFinite(p.cantidad) &&
    Number.isFinite(p.precioUnitario) &&
    Number.isFinite(p.total) &&
    typeof p.estado === 'string'
  );
}

// Solo se envían el código y la cantidad: nunca el precio ni el total (regla 1).
export async function confirmarPedido(codigo: string, cantidad: number): Promise<Pedido> {
  let respuesta: Response;
  try {
    respuesta = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, cantidad }),
    });
  } catch {
    throw new ErrorApi(MENSAJE_SIN_CONEXION_PEDIDO);
  }

  const cuerpo = await respuesta.json().catch(() => null);
  if (respuesta.ok) {
    if (esPedido(cuerpo?.pedido)) return cuerpo.pedido;
    throw new ErrorPedidoIncierto(MENSAJE_PEDIDO_INCIERTO);
  }
  // Los 4xx traen un `mensaje` en español pensado para la vecina (por ejemplo, «Este medicamento ya no tiene stock disponible.»).
  if (respuesta.status < 500 && typeof cuerpo?.mensaje === 'string') throw new ErrorPedidoRechazado(cuerpo.mensaje);
  throw new ErrorApi(MENSAJE_PEDIDO_GENERICO);
}