import { createHash, randomBytes } from 'node:crypto';
import { IDENTIDAD_SIMULADA } from '../proveedores/identidadSimulada.js';

// US-17 Ingreso con Neuro-Access (#46). Reglas del ingreso con QR:
// - Cada intento tiene dos secretos de un solo uso: la "llave" (cookie httpOnly del navegador que
//   pidió el QR) y el "secreto" (sessionId que solo conocen este servidor y el Neuron).
// - El callback del Neuron solo se acepta con un secreto vigente: es la prueba de que viene del Neuron.
// - Privacidad (repositorio público): de la identidad solo se guarda su Id y el nombre de pila.
//   El cuerpo del callback nunca se escribe en logs.
export const MINUTOS_VIGENCIA_QR = 5;
export const HORAS_SESION = 8;
const LARGO_MAXIMO_NOMBRE = 40;
const LARGO_MAXIMO_IDENTIDAD = 200;
// Si la identidad no trae nombre de pila, el saludo queda "Hola, vecino".
export const NOMBRE_POR_DEFECTO = 'vecino';
const PROPOSITO =
  'Ingresar a FarmacIA, el sitio de la Farmacia Comunitaria de Peñalolén. Este código vale 5 minutos.';

export const MENSAJES = {
  proveedor_no_disponible: 'No pudimos crear tu código para ingresar. Inténtalo de nuevo en un momento.',
  sin_intento: 'Tu código para ingresar ya no sirve. Genera uno nuevo, por favor.',
  vencido: 'Tu código para ingresar venció. Genera uno nuevo y escanéalo con tu app Neuro-Access.',
  rechazado:
    'No pudimos confirmar tu identidad en Neuro-Access. Revisa que esté aprobada en la app y genera un código nuevo.',
  sin_sesion: 'Para ver tus pedidos, primero ingresa con tu app Neuro-Access.',
};

const hash = (texto) => createHash('sha256').update(texto).digest('hex');
const nuevoSecreto = () => randomBytes(32).toString('base64url');
const sumarMinutos = (fecha, minutos) => new Date(fecha.getTime() + minutos * 60_000);

function normalizarNombre(nombre) {
  if (typeof nombre !== 'string') return NOMBRE_POR_DEFECTO;
  return nombre.trim().split(/\s+/)[0].slice(0, LARGO_MAXIMO_NOMBRE) || NOMBRE_POR_DEFECTO;
}

// Extrae del JSON del Neuron solo lo que usamos. El resto (RUT/PNR, correo, firmas…) se descarta.
function leerCallback(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;
  const { SessionId, Id, State, Properties, To } = cuerpo;
  if (typeof SessionId !== 'string' || SessionId === '') return null;
  return {
    secreto: SessionId,
    identidadId: typeof Id === 'string' ? Id.trim() : '',
    aprobada: State === 'Approved',
    nombre: normalizarNombre(Properties && typeof Properties === 'object' ? Properties.FIRST : ''),
    // `To` viene en segundos desde 1970 (así lo usa QuickLogin.js del Neuron).
    validaHasta: typeof To === 'number' ? new Date(To * 1000) : null,
  };
}

export function crearSesionService(sesionesRepository, { proveedor, ahora = () => new Date() }) {
  const vencido = (venceEnIso) => venceEnIso <= ahora().toISOString();

  function aprobar(intento, { identidadId, nombre }) {
    const vecinoId = sesionesRepository.aprobarIntento({
      llaveHash: intento.llave_hash,
      identidadId,
      nombre,
      creadoEn: ahora().toISOString(),
    });
    return vecinoId ? { ok: true } : { ok: false, motivo: 'intento_invalido' };
  }

  return {
    modo: proveedor.modo,

    // Crea el intento y pide el QR al proveedor. La `llave` va solo a la cookie del navegador.
    async iniciarIngreso() {
      const llave = nuevoSecreto();
      const secreto = nuevoSecreto();
      const venceEn = sumarMinutos(ahora(), MINUTOS_VIGENCIA_QR).toISOString();
      sesionesRepository.crearIntento({ llaveHash: hash(llave), secretoHash: hash(secreto), venceEn });

      try {
        const { qr, enlace } = await proveedor.iniciar({ secreto, proposito: PROPOSITO });
        return { ok: true, llave, venceEn, modo: proveedor.modo, qr, enlace };
      } catch (err) {
        console.error(`US-17: el proveedor de identidad falló (${err.message})`);
        return { ok: false, motivo: 'proveedor_no_disponible', mensaje: MENSAJES.proveedor_no_disponible };
      }
    },

    // Callback del Neuron cuando el vecino aprueba en Neuro-Access.
    recibirAprobacion(cuerpo) {
      const datos = leerCallback(cuerpo);
      if (!datos) return { ok: false, motivo: 'datos_invalidos' };

      const intento = sesionesRepository.buscarIntentoPorSecreto(hash(datos.secreto));
      if (!intento || intento.estado !== 'pendiente' || vencido(intento.vence_en)) {
        return { ok: false, motivo: 'intento_invalido' };
      }

      const identidadValida =
        datos.aprobada &&
        datos.identidadId !== '' &&
        datos.identidadId.length <= LARGO_MAXIMO_IDENTIDAD &&
        (!datos.validaHasta || datos.validaHasta > ahora());
      if (!identidadValida) {
        sesionesRepository.rechazarIntento(intento.llave_hash);
        return { ok: false, motivo: 'identidad_no_aprobada' };
      }

      return aprobar(intento, datos);
    },

    // Solo con el proveedor simulado: aprueba el intento de este navegador con la vecina ficticia.
    simularAprobacion(llave) {
      if (proveedor.modo !== 'simulado') return { ok: false, motivo: 'no_disponible' };
      const intento = llave ? sesionesRepository.buscarIntentoPorLlave(hash(llave)) : null;
      if (!intento || intento.estado !== 'pendiente' || vencido(intento.vence_en)) {
        return { ok: false, motivo: 'intento_invalido' };
      }
      return aprobar(intento, IDENTIDAD_SIMULADA);
    },

    // Lo consulta el front cada pocos segundos. Al aprobarse, canjea el intento por una sesión.
    consultarIngreso(llave) {
      const llaveHash = llave ? hash(llave) : null;
      const intento = llaveHash ? sesionesRepository.buscarIntentoPorLlave(llaveHash) : null;
      if (!intento) return { estado: 'sin_intento', mensaje: MENSAJES.sin_intento };

      if (intento.estado === 'pendiente') {
        if (vencido(intento.vence_en)) return { estado: 'vencido', mensaje: MENSAJES.vencido };
        return { estado: 'pendiente', venceEn: intento.vence_en };
      }
      if (intento.estado === 'rechazado') return { estado: 'rechazado', mensaje: MENSAJES.rechazado };
      if (intento.estado !== 'aprobado') return { estado: 'sin_intento', mensaje: MENSAJES.sin_intento };

      const token = nuevoSecreto();
      const venceEn = sumarMinutos(ahora(), HORAS_SESION * 60).toISOString();
      const vecinoId = sesionesRepository.canjearIntento({ llaveHash, tokenHash: hash(token), venceEn });
      if (!vecinoId) return { estado: 'sin_intento', mensaje: MENSAJES.sin_intento };

      const vecino = sesionesRepository.buscarVecinoPorSesion(hash(token), ahora().toISOString());
      return { estado: 'aprobado', vecino: { nombre: vecino.nombre }, sesion: { token, venceEn } };
    },

    // { id, nombre } del vecino con sesión vigente, o null.
    vecinoDeSesion(token) {
      if (!token) return null;
      return sesionesRepository.buscarVecinoPorSesion(hash(token), ahora().toISOString()) ?? null;
    },

    cerrarSesion(token) {
      if (token) sesionesRepository.cerrarSesion(hash(token));
    },
  };
}
