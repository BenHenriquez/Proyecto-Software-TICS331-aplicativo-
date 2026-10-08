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

// --- Carrito (US-16, #42) ----------------------------------------------------------------------
// Un solo pedido con todos los medicamentos del carrito: POST /api/pedidos con { items }.
export interface ItemPedido {
  codigo: string;
  medicamento: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PedidoCarrito {
  numeroPedido: string;
  items: ItemPedido[];
  total: number;
  estado: string;
  fechaCreacion: string;
}

// Un medicamento del carrito que no alcanzó (409 `sin_stock`).
export interface FaltanteCarrito {
  codigo: string;
  medicamento: string;
  stockDisponible: number;
}

// El backend rechazó el carrito: NO se creó ningún pedido y el stock de todos quedó igual.
// Si fue por falta de stock trae qué medicamentos no alcanzaron.
export class ErrorCarritoRechazado extends ErrorPedidoRechazado {
  readonly faltantes: FaltanteCarrito[];
  constructor(mensaje: string, faltantes: FaltanteCarrito[]) {
    super(mensaje);
    this.faltantes = faltantes;
  }
}

function esItemPedido(valor: unknown): valor is ItemPedido {
  if (valor === null || typeof valor !== 'object') return false;
  const i = valor as Record<string, unknown>;
  return (
    typeof i.codigo === 'string' &&
    typeof i.medicamento === 'string' &&
    Number.isFinite(i.cantidad) &&
    Number.isFinite(i.precioUnitario) &&
    Number.isFinite(i.subtotal)
  );
}

function esPedidoCarrito(valor: unknown): valor is PedidoCarrito {
  if (valor === null || typeof valor !== 'object') return false;
  const p = valor as Record<string, unknown>;
  return (
    typeof p.numeroPedido === 'string' &&
    p.numeroPedido !== '' &&
    Array.isArray(p.items) &&
    p.items.length > 0 &&
    p.items.every(esItemPedido) &&
    Number.isFinite(p.total) &&
    typeof p.estado === 'string'
  );
}

function soloFaltantes(valor: unknown): FaltanteCarrito[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (f): f is FaltanteCarrito =>
      f !== null &&
      typeof f === 'object' &&
      typeof (f as FaltanteCarrito).codigo === 'string' &&
      typeof (f as FaltanteCarrito).medicamento === 'string' &&
      Number.isFinite((f as FaltanteCarrito).stockDisponible),
  );
}

// Solo se envían códigos y cantidades: nunca precios ni totales (regla 1).
export async function confirmarCarrito(items: { codigo: string; cantidad: number }[]): Promise<PedidoCarrito> {
  let respuesta: Response;
  try {
    respuesta = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(({ codigo, cantidad }) => ({ codigo, cantidad })) }),
    });
  } catch {
    throw new ErrorApi(MENSAJE_SIN_CONEXION_PEDIDO);
  }

  const cuerpo = await respuesta.json().catch(() => null);
  if (respuesta.ok) {
    if (esPedidoCarrito(cuerpo?.pedido)) return cuerpo.pedido;
    throw new ErrorPedidoIncierto(MENSAJE_PEDIDO_INCIERTO);
  }
  if (respuesta.status < 500 && typeof cuerpo?.mensaje === 'string') {
    throw new ErrorCarritoRechazado(cuerpo.mensaje, soloFaltantes(cuerpo?.faltantes));
  }
  throw new ErrorApi(MENSAJE_PEDIDO_GENERICO);
}
