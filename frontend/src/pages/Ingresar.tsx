import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  consultarIngreso,
  ErrorApi,
  pedirCodigoIngreso,
  simularEscaneo,
  type CodigoIngreso,
} from '../lib/api';
import { useSesion } from '../lib/sesion';
import './Ingresar.css';

// #47 Pantalla de ingreso con QR (US-17, #43). El backend pide el QR al Neuron de TAG; aquí solo se
// muestra y se consulta cada pocos segundos si el vecino ya aprobó en su app Neuro-Access.
export const INTERVALO_CONSULTA_MS = 2000;
const ENLACE_ANDROID = 'https://play.google.com/store/apps/details?id=com.tag.NeuroAccess';
const ENLACE_IOS = 'https://apps.apple.com/us/app/neuro-access/id6446863270';
const MENSAJE_ERROR = 'Tuvimos un problema. Por favor, inténtalo de nuevo en un momento.';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'esperando'; codigo: CodigoIngreso }
  // Código vencido, rechazado o perdido: se ofrece uno nuevo.
  | { tipo: 'nuevo-codigo'; mensaje: string }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; nombre: string };

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function Ingresar() {
  const { vecino, recargar } = useSesion();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const zona = useRef<HTMLElement>(null);
  // Modo simulado: el botón se usa una sola vez por código (un segundo clic sería rechazado).
  const [simulando, setSimulando] = useState(false);

  const generar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    setSimulando(false);
    try {
      setEstado({ tipo: 'esperando', codigo: await pedirCodigoIngreso() });
    } catch (error) {
      setEstado({ tipo: 'error', mensaje: error instanceof ErrorApi ? error.message : MENSAJE_ERROR });
    }
  }, []);

  // Un solo código al abrir la pantalla: StrictMode monta dos veces en desarrollo y dos códigos dejarían
  // la cookie del navegador apuntando a uno distinto del QR que se ve.
  const pedido = useRef(false);
  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    void generar();
  }, [generar]);

  // Mientras se espera, se pregunta al backend si el vecino ya aprobó en la app.
  const esperando = estado.tipo === 'esperando';
  useEffect(() => {
    if (!esperando) return;
    let activo = true;
    const consultar = async () => {
      try {
        const r = await consultarIngreso();
        if (!activo || r.estado === 'pendiente') return;
        if (r.estado === 'aprobado') {
          setEstado({ tipo: 'listo', nombre: r.vecino.nombre });
          await recargar(); // la cabecera pasa a "Hola, …"
        } else {
          setEstado({ tipo: 'nuevo-codigo', mensaje: r.mensaje });
        }
      } catch {
        // Un corte breve de conexión no interrumpe la espera: se vuelve a preguntar en la próxima vuelta.
      }
    };
    const temporizador = window.setInterval(() => void consultar(), INTERVALO_CONSULTA_MS);
    return () => {
      activo = false;
      window.clearInterval(temporizador);
    };
  }, [esperando, recargar]);

  // El foco sigue al vecino cuando cambia lo que tiene que hacer.
  useEffect(() => {
    if (estado.tipo !== 'cargando') zona.current?.focus();
  }, [estado.tipo]);

  async function simular() {
    if (simulando) return;
    setSimulando(true);
    try {
      await simularEscaneo();
    } catch {
      // No se muestra error aquí: la consulta periódica dirá si el código venció o si ya quedó aprobado.
    }
  }

  if (vecino && estado.tipo !== 'listo') {
    return (
      <section className="ingresar" aria-labelledby="titulo-ingresar">
        <h1 id="titulo-ingresar">Ya ingresaste, {vecino.nombre}</h1>
        <p>
          <Link to="/">Buscar un medicamento</Link> · <Link to="/mis-pedidos">Ver mis pedidos</Link>
        </p>
      </section>
    );
  }

  return (
    <section ref={zona} className="ingresar" tabIndex={-1} aria-labelledby="titulo-ingresar">
      <h1 id="titulo-ingresar">Ingresar con Neuro-Access</h1>
      <p className="ingresar__estado" role="status">
        {estado.tipo === 'cargando' ? 'Preparando tu código para ingresar…' : ''}
        {estado.tipo === 'listo' ? `¡Hola, ${estado.nombre}! Ya ingresaste.` : ''}
      </p>

      {estado.tipo === 'esperando' && (
        <>
          <ol className="ingresar__pasos">
            <li>Abre la app Neuro-Access en tu teléfono.</li>
            <li>Elige la opción para escanear un código QR y apunta a este código.</li>
            <li>Revisa que la solicitud diga «FarmacIA» y apruébala.</li>
          </ol>

          {estado.codigo.qr ? (
            <div className="ingresar__qr">
              {/* En el mismo teléfono de la app, tocar el código la abre directamente. */}
              <a href={estado.codigo.enlace ?? undefined}>
                <img
                  src={`data:${estado.codigo.qr.contentType};base64,${estado.codigo.qr.base64}`}
                  alt="Código QR para ingresar con Neuro-Access"
                  width={280}
                  height={280}
                />
              </a>
              <p className="ingresar__nota">Si estás en el teléfono que tiene la app, toca el código.</p>
            </div>
          ) : (
            <div className="aviso">
              <p className="aviso__titulo">Modo de prueba</p>
              <p>No hay código real: el botón aprueba el ingreso como lo haría la app.</p>
              {/* aria-disabled (no disabled) para no perder el foco del teclado. */}
              <button
                type="button"
                className="ingresar__boton"
                aria-disabled={simulando}
                onClick={() => void simular()}
              >
                {simulando ? 'Aprobando…' : 'Simular escaneo'}
              </button>
            </div>
          )}

          <p>
            Este código vale hasta las <strong>{hora(estado.codigo.venceEn)}</strong>. Esperando tu aprobación…
          </p>
          {/* Si el vecino rechaza en la app, el Neuron no avisa nada (prueba en vivo): se ofrece otro código. */}
          <p className="ingresar__nota">Si rechazaste la solicitud o el código no funcionó, pide uno nuevo.</p>
          <button type="button" className="boton-secundario" onClick={() => void generar()}>
            Generar otro código
          </button>
          <p className="ingresar__nota">
            ¿No tienes la app? Descárgala gratis para <a href={ENLACE_ANDROID}>Android</a> o{' '}
            <a href={ENLACE_IOS}>iPhone</a>. No necesitas ingresar para buscar medicamentos ni para comprar.
          </p>
        </>
      )}

      {(estado.tipo === 'nuevo-codigo' || estado.tipo === 'error') && (
        <div className={estado.tipo === 'error' ? 'aviso aviso--error' : 'aviso'} role="alert">
          <p>{estado.mensaje}</p>
          <button type="button" className="ingresar__boton" onClick={() => void generar()}>
            {estado.tipo === 'error' ? 'Intentar de nuevo' : 'Generar un código nuevo'}
          </button>
        </div>
      )}

      {estado.tipo === 'listo' && (
        <div className="ingresar__acciones">
          <Link className="ingresar__enlace-boton" to="/">
            Buscar un medicamento
          </Link>
          <Link className="ingresar__enlace-boton ingresar__enlace-boton--secundario" to="/mis-pedidos">
            Ver mis pedidos
          </Link>
        </div>
      )}
    </section>
  );
}
