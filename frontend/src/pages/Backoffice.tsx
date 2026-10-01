import { useEffect, useRef, useState, type FormEvent } from 'react';
import FilaMantencion, { type AvisoFila } from '../components/FilaMantencion';
import {
  ErrorApi,
  ErrorConflicto,
  ErrorNoAutorizado,
  ErrorValidacion,
  guardarMedicamento,
  listarBackoffice,
  type CambiosMedicamento,
  type MedicamentoBackoffice,
} from '../lib/api';
import './Backoffice.css';

// US-13 Mantener stock (#2). #13: ingreso con la clave simulada del equipo, listado con precio y
// stock editables, confirmación del cambio y errores junto al campo. Estados: acceso, cargando,
// error, vacío y listado. La clave (token SIMULADO, ver README) vive solo en memoria.
type Estado =
  // `enfocar` lleva el foco al campo de la clave cuando se vuelve al ingreso (no en la primera carga).
  | { tipo: 'acceso'; error?: string; enfocar?: boolean }
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listado' };

const MENSAJE_SIN_CLAVE = 'Escribe la clave del equipo para entrar.';
const MENSAJE_SIN_CAMBIOS = 'No hay cambios para guardar.';
const AYUDA_CONFLICTO = 'Ya recargamos lo guardado. Vuelve a escribir tu cambio y guarda de nuevo.';

const textoCantidad = (n: number) => (n === 1 ? 'Mostrando 1 medicamento.' : `Mostrando ${n} medicamentos.`);

export default function Backoffice() {
  const [clave, setClave] = useState('');
  const [sesion, setSesion] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: 'acceso' });
  const [medicamentos, setMedicamentos] = useState<MedicamentoBackoffice[]>([]);
  const [avisos, setAvisos] = useState<Record<string, AvisoFila | undefined>>({});
  const [reinicios, setReinicios] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState<Record<string, true>>({});

  // Guardados en curso (se puede guardar en filas distintas a la vez) y número de sesión: si se
  // sale mientras se guarda, la respuesta que llega después no debe dejar avisos en la sesión nueva.
  const enCurso = useRef(new Set<string>());
  const generacion = useRef(0);
  const campoClave = useRef<HTMLInputElement>(null);
  const zonaListado = useRef<HTMLElement>(null);
  const botonReintentar = useRef<HTMLButtonElement>(null);

  // El foco sigue a la funcionaria: al entrar va al listado; si la clave falla o se sale, vuelve al
  // campo; si el listado no carga, va a «Intentar de nuevo».
  useEffect(() => {
    if (estado.tipo === 'listado') zonaListado.current?.focus();
    else if (estado.tipo === 'error') botonReintentar.current?.focus();
    else if (estado.tipo === 'acceso' && (estado.error || estado.enfocar)) campoClave.current?.focus();
  }, [estado]);

  function cerrarSesion(error?: string) {
    generacion.current += 1;
    enCurso.current.clear();
    setGuardando({});
    setSesion(null);
    setClave('');
    setMedicamentos([]);
    setAvisos({});
    setReinicios({});
    setEstado({ tipo: 'acceso', error, enfocar: true });
  }

  async function cargar(claveUsada: string) {
    setSesion(claveUsada);
    setEstado({ tipo: 'cargando' });
    try {
      setMedicamentos(await listarBackoffice(claveUsada));
      setEstado({ tipo: 'listado' });
    } catch (error) {
      if (error instanceof ErrorNoAutorizado) return cerrarSesion(error.message);
      setEstado({ tipo: 'error', mensaje: error instanceof ErrorApi ? error.message : 'Tuvimos un problema con el panel.' });
    }
  }

  function entrar(evento: FormEvent) {
    evento.preventDefault();
    if (clave.trim() === '') {
      setEstado({ tipo: 'acceso', error: MENSAJE_SIN_CLAVE });
      return;
    }
    void cargar(clave);
  }

  const avisar = (codigo: string, aviso: AvisoFila | undefined) => setAvisos((a) => ({ ...a, [codigo]: aviso }));
  const reiniciar = (codigo: string) => setReinicios((r) => ({ ...r, [codigo]: (r[codigo] ?? 0) + 1 }));

  async function guardar(medicamento: MedicamentoBackoffice, cambios: CambiosMedicamento, version: number) {
    const { codigo } = medicamento;
    if (enCurso.current.has(codigo) || sesion === null) return;
    const sesionDeEsteGuardado = generacion.current;
    const sigueVigente = () => sesionDeEsteGuardado === generacion.current;

    enCurso.current.add(codigo);
    setGuardando((g) => ({ ...g, [codigo]: true }));
    avisar(codigo, undefined);
    try {
      const guardado = await guardarMedicamento(sesion, codigo, cambios, version);
      if (!sigueVigente()) return;
      // Lo que se ve guardado es lo que respondió el backend, no lo que se escribió.
      setMedicamentos((lista) => lista.map((m) => (m.codigo === guardado.codigo ? guardado : m)));
      reiniciar(codigo);
      avisar(codigo, { tipo: 'exito', texto: `Guardamos el cambio de ${medicamento.nombre}.` });
    } catch (error) {
      if (!sigueVigente()) return;
      if (error instanceof ErrorNoAutorizado) {
        cerrarSesion(error.message);
      } else if (error instanceof ErrorValidacion) {
        const conMotivo = Boolean(error.errores.precioUnitario || error.errores.stock || error.errores.general);
        avisar(codigo, { tipo: 'error', errores: error.errores, texto: conMotivo ? undefined : error.message });
      } else if (error instanceof ErrorConflicto) {
        avisar(codigo, { tipo: 'error', texto: error.message, ayuda: AYUDA_CONFLICTO });
        // Recarga en silencio: ella ve lo guardado de verdad (por ejemplo, la venta) y puede reintentar.
        try {
          const lista = await listarBackoffice(sesion);
          if (!sigueVigente()) return;
          setMedicamentos(lista);
          reiniciar(codigo);
        } catch (errorAlRecargar) {
          if (sigueVigente() && errorAlRecargar instanceof ErrorNoAutorizado) cerrarSesion(errorAlRecargar.message);
        }
      } else {
        const mensaje = error instanceof ErrorApi ? error.message : 'Tuvimos un problema al guardar el cambio.';
        avisar(codigo, { tipo: 'error', texto: mensaje });
      }
    } finally {
      // Si se salió mientras se guardaba, cerrarSesion ya limpió todo (y puede haber otra sesión).
      if (sigueVigente()) {
        enCurso.current.delete(codigo);
        setGuardando((g) => {
          const { [codigo]: _terminado, ...resto } = g;
          return resto;
        });
      }
    }
  }

  return (
    <section aria-labelledby="titulo-backoffice">
      <h1 id="titulo-backoffice">Backoffice de la farmacia</h1>
      <p>Espacio para el equipo de la farmacia: revisar y actualizar precios y stock.</p>

      {estado.tipo === 'acceso' && (
        <form className="formulario" onSubmit={entrar} noValidate>
          <label htmlFor="clave">Clave del equipo</label>
          <input
            ref={campoClave}
            id="clave"
            name="clave"
            type="password"
            autoComplete="off"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            aria-invalid={estado.error ? true : undefined}
            aria-describedby={estado.error ? 'error-clave' : 'ayuda-clave'}
          />
          {estado.error && (
            <p id="error-clave" className="aviso aviso--error" role="alert">
              {estado.error}
            </p>
          )}
          <p id="ayuda-clave">
            Esta clave es solo una prueba del prototipo: no es una autenticación real. La entrega el equipo del proyecto.
          </p>
          <button type="submit">Entrar</button>
        </form>
      )}

      {estado.tipo === 'cargando' && <p role="status">Cargando medicamentos…</p>}

      {estado.tipo === 'error' && (
        <div className="aviso aviso--error" role="alert">
          <p className="aviso__titulo">{estado.mensaje}</p>
          <button ref={botonReintentar} type="button" onClick={() => sesion !== null && void cargar(sesion)}>
            Intentar de nuevo
          </button>
        </div>
      )}

      {estado.tipo === 'listado' && (
        <section ref={zonaListado} className="panel" tabIndex={-1} aria-label="Medicamentos del backoffice">
          <button type="button" className="boton-secundario" onClick={() => cerrarSesion()}>
            Salir del backoffice
          </button>
          <p role="status">{medicamentos.length > 0 ? textoCantidad(medicamentos.length) : ''}</p>

          {medicamentos.length === 0 ? (
            <p className="aviso">No hay medicamentos para mostrar por ahora.</p>
          ) : (
            <ul className="panel__lista">
              {medicamentos.map((m) => (
                <li key={m.codigo}>
                  <FilaMantencion
                    medicamento={m}
                    reinicio={reinicios[m.codigo] ?? 0}
                    aviso={avisos[m.codigo]}
                    guardando={guardando[m.codigo] === true}
                    onGuardar={(cambios, version) => void guardar(m, cambios, version)}
                    onSinCambios={() => avisar(m.codigo, { tipo: 'info', texto: MENSAJE_SIN_CAMBIOS })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
