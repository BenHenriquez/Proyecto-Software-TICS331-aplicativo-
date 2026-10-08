import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  confirmarCarrito,
  ErrorApi,
  ErrorCarritoRechazado,
  ErrorPedidoIncierto,
  type FaltanteCarrito,
  type PedidoCarrito,
} from '../lib/api';
import { CANTIDAD_MAXIMA_POR_MEDICAMENTO, useCarrito, type ItemCarrito } from '../lib/carrito';
import { formatoPesos } from '../lib/formato';
import './Carrito.css';

// US-16 Carrito (#42): la vecina revisa todo lo que eligió, ajusta cantidades, quita lo que no quiere y
// confirma UN solo pedido. El total que se ve antes de confirmar es estimado; el pedido real (precios,
// subtotales y total) lo calcula el backend y es lo que se muestra al terminar (regla 1).
type Estado =
  | { tipo: 'listo' }
  | { tipo: 'confirmando' }
  | { tipo: 'exito'; pedido: PedidoCarrito }
  // No se creó ningún pedido y el stock quedó igual (400, 404 o 409). `faltantes` dice cuáles no alcanzaron.
  | { tipo: 'rechazado'; mensaje: string; faltantes: FaltanteCarrito[] }
  // Falló la conexión o el servidor: se puede intentar de nuevo.
  | { tipo: 'error'; mensaje: string }
  // Respuesta que no se pudo leer: el pedido pudo crearse, no se ofrece reintentar.
  | { tipo: 'incierto'; mensaje: string };

const unidades = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

// Solo enteros entre 1 y el máximo; "", "0", "1.5", "-2" o "25" no son cantidades válidas.
function leerCantidad(texto: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const cantidad = Number(texto);
  return cantidad >= 1 && cantidad <= CANTIDAD_MAXIMA_POR_MEDICAMENTO ? cantidad : null;
}

interface PropsFila {
  item: ItemCarrito;
  // Si el backend dijo que este medicamento no alcanzó, se marca con el motivo.
  faltante?: FaltanteCarrito;
  ocupado: boolean;
  onCambiar: (codigo: string, cantidad: number) => void;
  onQuitar: (item: ItemCarrito) => void;
}

function FilaCarrito({ item, faltante, ocupado, onCambiar, onQuitar }: PropsFila) {
  const { codigo, nombre, precioUnitario, cantidad } = item;
  const idCampo = useId();
  const idError = useId();
  const [texto, setTexto] = useState(String(cantidad));
  const valida = leerCantidad(texto);

  // Si la cantidad cambia desde afuera (botones − y +), el campo la sigue.
  useEffect(() => setTexto(String(cantidad)), [cantidad]);

  const enElMinimo = cantidad <= 1;
  const enElMaximo = cantidad >= CANTIDAD_MAXIMA_POR_MEDICAMENTO;
  // Los botones usan aria-disabled (no disabled) para no perder el foco del teclado al llegar al límite.
  const cambiar = (nueva: number) => !ocupado && onCambiar(codigo, nueva);

  return (
    <li className={faltante ? 'fila-carrito fila-carrito--sin-stock' : 'fila-carrito'}>
      <h2 className="fila-carrito__nombre">{nombre}</h2>
      <p className="fila-carrito__precio">{`Precio por unidad: ${formatoPesos(precioUnitario)}`}</p>

      <label className="fila-carrito__etiqueta" htmlFor={idCampo}>
        Cantidad
      </label>
      <div className="fila-carrito__control">
        <button
          type="button"
          className="fila-carrito__paso"
          aria-label={`Disminuir cantidad de ${nombre}`}
          aria-disabled={enElMinimo || ocupado}
          onClick={() => !enElMinimo && cambiar(cantidad - 1)}
        >
          −
        </button>
        <input
          id={idCampo}
          className="fila-carrito__campo"
          type="number"
          inputMode="numeric"
          min={1}
          max={CANTIDAD_MAXIMA_POR_MEDICAMENTO}
          step={1}
          value={texto}
          aria-label={`Cantidad de ${nombre}`}
          aria-describedby={valida === null ? idError : undefined}
          aria-invalid={valida === null}
          readOnly={ocupado}
          onChange={(e) => {
            setTexto(e.target.value);
            const nueva = leerCantidad(e.target.value);
            if (nueva !== null) cambiar(nueva);
          }}
          // Al salir del campo vuelve a la última cantidad válida: lo que se ve es lo que se pedirá.
          onBlur={() => setTexto(String(cantidad))}
        />
        <button
          type="button"
          className="fila-carrito__paso"
          aria-label={`Aumentar cantidad de ${nombre}`}
          aria-disabled={enElMaximo || ocupado}
          onClick={() => !enElMaximo && cambiar(cantidad + 1)}
        >
          +
        </button>
      </div>
      {valida === null && (
        <p id={idError} className="fila-carrito__error" role="alert">
          {`Elige una cantidad entre 1 y ${CANTIDAD_MAXIMA_POR_MEDICAMENTO}.`}
        </p>
      )}

      <p className="fila-carrito__subtotal">{`Subtotal estimado: ${formatoPesos(cantidad * precioUnitario)}`}</p>

      {faltante && (
        <p className="fila-carrito__alerta">
          {faltante.stockDisponible > 0
            ? `No alcanza: solo quedan ${unidades(faltante.stockDisponible)}. Baja la cantidad o quítalo.`
            : 'Sin stock por ahora. Quítalo para poder continuar.'}
        </p>
      )}

      <button
        type="button"
        className="boton-secundario fila-carrito__quitar"
        aria-label={`Quitar ${nombre} del carrito`}
        aria-disabled={ocupado}
        onClick={() => !ocupado && onQuitar(item)}
      >
        Quitar
      </button>
    </li>
  );
}

export default function Carrito() {
  const carrito = useCarrito();
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' });
  const [anuncio, setAnuncio] = useState('');
  const zona = useRef<HTMLElement>(null);
  const enviando = useRef(false);
  const primerRender = useRef(true);

  const ocupado = estado.tipo === 'confirmando';
  const { items } = carrito;

  // El foco sigue a la vecina: al terminar de confirmar (éxito o error) va a esta zona.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    if (estado.tipo !== 'confirmando') zona.current?.focus();
  }, [estado.tipo]);

  // Si la vecina cambia su carrito después de un rechazo, esa explicación ya no describe lo que ve.
  const olvidarRechazo = () => setEstado((actual) => (actual.tipo === 'rechazado' ? { tipo: 'listo' } : actual));

  function cambiar(codigo: string, cantidad: number) {
    olvidarRechazo();
    carrito.cambiarCantidad(codigo, cantidad);
  }

  function quitar(item: ItemCarrito) {
    olvidarRechazo();
    carrito.quitar(item.codigo);
    setAnuncio(`Quitaste ${item.nombre} de tu carrito.`);
    zona.current?.focus();
  }

  async function confirmar() {
    if (enviando.current || items.length === 0) return;
    enviando.current = true;
    setAnuncio('Confirmando tu pedido…');
    setEstado({ tipo: 'confirmando' });
    try {
      const pedido = await confirmarCarrito(items);
      carrito.vaciar();
      setAnuncio(`Tu pedido fue creado. Número de pedido ${pedido.numeroPedido}.`);
      setEstado({ tipo: 'exito', pedido });
    } catch (error) {
      setAnuncio('');
      const mensaje = error instanceof ErrorApi ? error.message : 'Tuvimos un problema al crear tu pedido.';
      if (error instanceof ErrorCarritoRechazado) setEstado({ tipo: 'rechazado', mensaje, faltantes: error.faltantes });
      else if (error instanceof ErrorPedidoIncierto) setEstado({ tipo: 'incierto', mensaje });
      else setEstado({ tipo: 'error', mensaje });
    } finally {
      enviando.current = false;
    }
  }

  const faltantes = estado.tipo === 'rechazado' ? estado.faltantes : [];
  const puedeConfirmar = estado.tipo === 'listo' || estado.tipo === 'confirmando' || estado.tipo === 'error' || estado.tipo === 'rechazado';
  const textoConfirmar =
    estado.tipo === 'confirmando' ? 'Confirmando…' : estado.tipo === 'error' ? 'Intentar de nuevo' : 'Confirmar pedido';

  return (
    <section ref={zona} className="carrito" tabIndex={-1} aria-labelledby="titulo-carrito">
      {/* Región de estado siempre presente: así el lector de pantalla anuncia lo que pasa al cambiar su texto. */}
      <p className="carrito__anuncio" role="status">
        {anuncio}
      </p>

      {estado.tipo === 'exito' ? (
        <>
          <h1 id="titulo-carrito">Tu pedido fue creado</h1>
          <dl className="carrito__datos">
            <div>
              <dt>Número de pedido</dt>
              <dd>{estado.pedido.numeroPedido}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{estado.pedido.estado}</dd>
            </div>
          </dl>
          <ul className="carrito__resumen" aria-label="Medicamentos de tu pedido">
            {estado.pedido.items.map((i) => (
              <li key={i.codigo}>
                <span className="carrito__resumen-nombre">{i.medicamento}</span>
                <span>{`${unidades(i.cantidad)} × ${formatoPesos(i.precioUnitario)} = ${formatoPesos(i.subtotal)}`}</span>
              </li>
            ))}
          </ul>
          <p className="carrito__total">{`Total: ${formatoPesos(estado.pedido.total)}`}</p>
          <p className="carrito__nota">Anota tu número de pedido.</p>
          <Link to="/" className="boton-enlace boton-enlace--principal">
            Buscar otro medicamento
          </Link>
        </>
      ) : (
        <>
          <h1 id="titulo-carrito">Mi carrito</h1>

          {items.length === 0 ? (
            <>
              {estado.tipo === 'incierto' && (
                <div className="carrito__error" role="alert">
                  <p>{estado.mensaje}</p>
                </div>
              )}
              <p className="carrito__vacio">Tu carrito está vacío.</p>
              <p>Busca un medicamento y usa «Agregar al carrito» para reunir todo en un solo pedido.</p>
              <Link to="/" className="boton-enlace boton-enlace--principal">
                Buscar medicamento
              </Link>
            </>
          ) : (
            <>
              <p>Revisa tus medicamentos. Puedes cambiar las cantidades o quitar alguno.</p>
              <ul className="carrito__lista" aria-label="Medicamentos en tu carrito">
                {items.map((item) => (
                  <FilaCarrito
                    key={item.codigo}
                    item={item}
                    faltante={faltantes.find((f) => f.codigo === item.codigo)}
                    ocupado={ocupado}
                    onCambiar={cambiar}
                    onQuitar={quitar}
                  />
                ))}
              </ul>

              <output className="carrito__total" aria-live="polite">
                {`Total estimado: ${formatoPesos(carrito.totalEstimado)}`}
              </output>
              <p className="carrito__nota">El total final lo confirma la farmacia al crear tu pedido.</p>

              {(estado.tipo === 'rechazado' || estado.tipo === 'error' || estado.tipo === 'incierto') && (
                <div className="carrito__error" role="alert">
                  <p>{estado.mensaje}</p>
                  {estado.tipo === 'rechazado' && <p className="carrito__error-ayuda">Tu carrito sigue igual: puedes ajustarlo y volver a confirmar.</p>}
                </div>
              )}

              {/* aria-disabled (no disabled) para no perder el foco del teclado mientras confirma. */}
              {puedeConfirmar && (
                <button type="button" className="carrito__principal" aria-disabled={ocupado} onClick={() => void confirmar()}>
                  {textoConfirmar}
                </button>
              )}
              {estado.tipo === 'incierto' ? (
                <Link to="/" className="boton-enlace boton-enlace--principal">
                  Buscar otro medicamento
                </Link>
              ) : (
                <Link to="/" className="boton-enlace">
                  Seguir buscando
                </Link>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
