import { useEffect, useRef, useState } from 'react';
import SelectorCantidad from '../components/SelectorCantidad';
import TarjetaMedicamento from '../components/TarjetaMedicamento';
import { buscarMedicamentos, ErrorApi, type Medicamento } from '../lib/api';

// US-02 Consultar medicamento (#1). #8: buscador y tarjetas de resultado. #9: mensaje claro sin
// coincidencias y medicamentos sin stock sin opción de compra. Estados: inicial, cargando,
// resultados, vacío y error. «Elegir cantidad» abre el selector de US-15 (#17).
type Estado =
  | { tipo: 'inicial' }
  | { tipo: 'cargando' }
  | { tipo: 'resultados'; resultados: Medicamento[] }
  | { tipo: 'vacio'; mensaje: string }
  | { tipo: 'error'; mensaje: string };

const MENSAJE_VACIO = 'No encontramos ese medicamento. Revisa cómo está escrito o prueba buscando por su principio activo.';

function textoCantidad(n: number) {
  return n === 1 ? 'Encontramos 1 medicamento.' : `Encontramos ${n} medicamentos.`;
}

export default function Buscador() {
  const [consulta, setConsulta] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' });
  const [elegido, setElegido] = useState<Medicamento | null>(null);
  const [aviso, setAviso] = useState('');

  const peticion = useRef<AbortController | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const zonaSelector = useRef<HTMLDivElement>(null);
  const botonesElegir = useRef(new Map<string, HTMLButtonElement>());
  const codigoAlVolver = useRef<string | null>(null);

  useEffect(() => () => peticion.current?.abort(), []);

  // El foco sigue a la vecina: al abrir el selector va a él; al volver, al botón de la tarjeta que eligió.
  useEffect(() => {
    if (elegido) {
      zonaSelector.current?.focus();
    } else if (codigoAlVolver.current) {
      botonesElegir.current.get(codigoAlVolver.current)?.focus();
      codigoAlVolver.current = null;
    }
  }, [elegido]);

  async function buscar() {
    peticion.current?.abort();
    const controlador = new AbortController();
    peticion.current = controlador;

    setElegido(null);
    setAviso('');
    setEstado({ tipo: 'cargando' });
    try {
      const { resultados, mensaje } = await buscarMedicamentos(consulta.trim(), controlador.signal);
      if (controlador.signal.aborted) return;
      setEstado(
        resultados.length === 0
          ? { tipo: 'vacio', mensaje: mensaje ?? MENSAJE_VACIO }
          : { tipo: 'resultados', resultados },
      );
    } catch (error) {
      if (controlador.signal.aborted) return;
      const mensaje =
        error instanceof ErrorApi ? error.message : 'Tuvimos un problema al buscar. Por favor, inténtalo de nuevo.';
      setEstado({ tipo: 'error', mensaje });
      campo.current?.focus();
    }
  }

  function volver() {
    codigoAlVolver.current = elegido?.codigo ?? null;
    setAviso('');
    setElegido(null);
  }

  // La confirmación del pedido es #18 (US-15); por ahora solo se informa la cantidad elegida.
  function continuar(cantidad: number) {
    const unidades = cantidad === 1 ? '1 unidad' : `${cantidad} unidades`;
    setAviso(`Elegiste ${unidades}. La confirmación del pedido estará disponible muy pronto.`);
  }

  return (
    <section aria-labelledby="titulo-buscador">
      <h1 id="titulo-buscador">Buscar medicamento</h1>
      <p>Escribe el nombre del medicamento o su principio activo.</p>
      <form
        className="formulario"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <label htmlFor="consulta">Nombre o principio activo</label>
        <input
          ref={campo}
          id="consulta"
          name="q"
          type="search"
          autoComplete="off"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          aria-describedby={estado.tipo === 'error' ? 'error-busqueda' : undefined}
        />
        <button type="submit">Buscar</button>
      </form>

      {/* Región viva: anuncia en voz alta el resultado de cada búsqueda. */}
      <p className="estado-busqueda" role="status">
        {estado.tipo === 'cargando' && 'Buscando…'}
        {estado.tipo === 'resultados' && !elegido && textoCantidad(estado.resultados.length)}
      </p>

      {estado.tipo === 'vacio' && (
        <div className="aviso" role="alert">
          <p className="aviso__titulo">{estado.mensaje}</p>
        </div>
      )}

      {estado.tipo === 'error' && (
        <div id="error-busqueda" className="aviso aviso--error" role="alert">
          <p className="aviso__titulo">{estado.mensaje}</p>
        </div>
      )}

      {estado.tipo === 'resultados' && elegido && (
        <div ref={zonaSelector} className="zona-selector" tabIndex={-1} aria-label={`Elegir cantidad de ${elegido.nombre}`}>
          <button type="button" className="boton-secundario" onClick={volver}>
            <span aria-hidden="true">← </span>Volver a los resultados
          </button>
          <SelectorCantidad medicamento={elegido} onContinuar={continuar} />
          {/* Siempre presente (aunque vacía) para que el lector de pantalla anuncie el aviso al aparecer. */}
          <p className={aviso ? 'aviso' : undefined} role="status">
            {aviso}
          </p>
        </div>
      )}

      {estado.tipo === 'resultados' && !elegido && (
        <ul className="resultados" aria-label="Resultados de la búsqueda">
          {estado.resultados.map((m) => (
            <li key={m.codigo}>
              <TarjetaMedicamento
                ref={(boton) => {
                  if (boton) botonesElegir.current.set(m.codigo, boton);
                  else botonesElegir.current.delete(m.codigo);
                }}
                medicamento={m}
                onElegir={setElegido}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
