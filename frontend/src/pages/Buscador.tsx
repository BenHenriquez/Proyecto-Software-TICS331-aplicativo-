import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmarPedido from '../components/ConfirmarPedido';
import SelectorCantidad from '../components/SelectorCantidad';
import Icono from '../components/Icono';
import TarjetaMedicamento from '../components/TarjetaMedicamento';
import { buscarMedicamentos, ErrorApi, type Medicamento } from '../lib/api';
import { CANTIDAD_MAXIMA_POR_MEDICAMENTO, MEDICAMENTOS_MAXIMOS, useCarritoOpcional } from '../lib/carrito';

// US-02 Consultar medicamento (#1). #8: buscador y tarjetas de resultado. #9: mensaje claro sin
// coincidencias y medicamentos sin stock sin opción de compra. Estados: inicial, cargando,
// resultados, vacío y error. «Elegir cantidad» abre el selector de US-15 (#17) y «Continuar con el
// pedido» abre la confirmación (#18). US-16 (#42): si la app tiene carrito, el selector también ofrece
// «Agregar al carrito» y la búsqueda sigue donde estaba.
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
  // Cantidad elegida en el selector: con ella se abre la confirmación del pedido.
  const [cantidad, setCantidad] = useState<number | null>(null);
  // Hay un pedido confirmándose: no se acepta otra búsqueda hasta que termine, o se perdería el resultado.
  const [ocupado, setOcupado] = useState(false);
  // Tras refrescar la lista por un rechazo, el foco va a la lista de resultados.
  const [enfocarLista, setEnfocarLista] = useState(false);
  // Aviso de «Agregar al carrito»; solo existe si la app tiene carrito.
  const carrito = useCarritoOpcional();
  const [avisoCarrito, setAvisoCarrito] = useState<{ texto: string; error: boolean } | null>(null);

  const peticion = useRef<AbortController | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const zonaSelector = useRef<HTMLDivElement>(null);
  const listaResultados = useRef<HTMLUListElement>(null);
  // Lo último que se buscó: el campo sigue editable mientras se ve la confirmación.
  const ultimaConsulta = useRef('');
  const botonesElegir = useRef(new Map<string, HTMLButtonElement>());
  const codigoAlVolver = useRef<string | null>(null);

  useEffect(() => () => peticion.current?.abort(), []);

  // El foco sigue a la vecina: al abrir el selector va a él (la confirmación se enfoca sola); al
  // volver, al botón de la tarjeta que eligió.
  useEffect(() => {
    if (elegido && cantidad === null) {
      zonaSelector.current?.focus();
    } else if (!elegido && codigoAlVolver.current) {
      botonesElegir.current.get(codigoAlVolver.current)?.focus();
      codigoAlVolver.current = null;
    }
  }, [elegido, cantidad]);

  // El aviso de foco se consume cuando termina la búsqueda de refresco (con o sin resultados).
  useEffect(() => {
    if (!enfocarLista || estado.tipo === 'cargando') return;
    if (estado.tipo === 'resultados') listaResultados.current?.focus();
    setEnfocarLista(false);
  }, [enfocarLista, estado]);

  async function buscar(texto = consulta) {
    if (ocupado) return;
    ultimaConsulta.current = texto.trim();
    peticion.current?.abort();
    const controlador = new AbortController();
    peticion.current = controlador;

    setElegido(null);
    setCantidad(null);
    setAvisoCarrito(null);
    setEstado({ tipo: 'cargando' });
    try {
      const { resultados, mensaje } = await buscarMedicamentos(texto.trim(), controlador.signal);
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

  // «Agregar al carrito»: se suma al carrito y se vuelve a los resultados para seguir eligiendo.
  function agregarAlCarrito(cantidadElegida: number) {
    if (!carrito || !elegido) return;
    const { codigo, nombre, precioUnitario } = elegido;
    const r = carrito.agregar({ codigo, nombre, precioUnitario }, cantidadElegida);
    if (!r.ok) {
      setAvisoCarrito({
        texto: `Tu carrito ya tiene ${MEDICAMENTOS_MAXIMOS} medicamentos distintos. Haz tu pedido o quita alguno para agregar otro.`,
        error: true,
      });
      return;
    }
    const unidades = r.cantidad === 1 ? '1 unidad' : `${r.cantidad} unidades`;
    setAvisoCarrito({
      texto: r.recortada
        ? `Tu carrito permite hasta ${CANTIDAD_MAXIMA_POR_MEDICAMENTO} unidades de cada medicamento. Ahora tienes ${unidades} de ${nombre}.`
        : `Agregaste ${nombre} a tu carrito. Ahora tienes ${unidades}.`,
      error: false,
    });
    volver();
  }

  function volver() {
    codigoAlVolver.current = elegido?.codigo ?? null;
    setCantidad(null);
    setElegido(null);
  }

  // Tras un rechazo del pedido (sin stock, medicamento inexistente) lo que se veía ya no es cierto:
  // se vuelve a pedir la búsqueda para no mostrar stock viejo.
  function volverDeLaConfirmacion() {
    setCantidad(null);
    setElegido(null);
    setEnfocarLista(true);
    setConsulta(ultimaConsulta.current);
    void buscar(ultimaConsulta.current);
  }

  // Después de crear un pedido: buscador limpio y el foco en el campo.
  function nuevaBusqueda() {
    peticion.current?.abort();
    setElegido(null);
    setCantidad(null);
    setConsulta('');
    setEstado({ tipo: 'inicial' });
    campo.current?.focus();
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
        <button type="submit" aria-disabled={ocupado}>
          Buscar
        </button>
      </form>

      {/* Región viva: anuncia en voz alta el resultado de cada búsqueda. */}
      <p className="estado-busqueda" role="status">
        {estado.tipo === 'cargando' && 'Buscando…'}
        {estado.tipo === 'resultados' && !elegido && textoCantidad(estado.resultados.length)}
      </p>

      {/* Región viva del carrito: anuncia cada medicamento agregado. Solo existe si la app tiene carrito. */}
      {carrito && (
        <div className={avisoCarrito?.error ? 'aviso aviso--error' : avisoCarrito ? 'aviso' : undefined} role="status">
          {avisoCarrito && (
            <>
              <p className="aviso__titulo">{avisoCarrito.texto}</p>
              <p>
                <Link to="/carrito">{`Ver mi carrito (${carrito.unidades} ${carrito.unidades === 1 ? 'unidad' : 'unidades'})`}</Link>
              </p>
            </>
          )}
        </div>
      )}

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

      {estado.tipo === 'resultados' && elegido && cantidad === null && (
        <div ref={zonaSelector} className="zona-selector" tabIndex={-1} aria-label={`Elegir cantidad de ${elegido.nombre}`}>
          <button type="button" className="boton-volver" onClick={volver}>
            <Icono nombre="volver" />
            Volver a los resultados
          </button>
          <SelectorCantidad
            medicamento={elegido}
            onContinuar={setCantidad}
            onAgregar={carrito ? agregarAlCarrito : undefined}
          />
        </div>
      )}

      {estado.tipo === 'resultados' && elegido && cantidad !== null && (
        <ConfirmarPedido
          key={elegido.codigo}
          medicamento={elegido}
          cantidad={cantidad}
          onCambiarCantidad={() => setCantidad(null)}
          onVolverAResultados={volverDeLaConfirmacion}
          onNuevaBusqueda={nuevaBusqueda}
          onOcupado={setOcupado}
        />
      )}

      {estado.tipo === 'resultados' && !elegido && (
        <ul ref={listaResultados} className="resultados" tabIndex={-1} aria-label="Resultados de la búsqueda">
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
