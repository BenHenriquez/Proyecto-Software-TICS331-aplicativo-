import { useEffect, useRef, useState } from 'react';
import { confirmarPedido, ErrorApi, ErrorPedidoIncierto, ErrorPedidoRechazado, type Pedido } from '../lib/api';
import { formatoPesos } from '../lib/formato';
import { useSesion } from '../lib/sesion';
import './ConfirmarPedido.css';

// #18 Pantalla de confirmación (US-15): resumen del pedido, botón de confirmar y mensaje de éxito
// o de «ya no hay stock disponible». El total que se ve antes de confirmar es informativo; el pedido
// real (precio y total) lo calcula el backend y es lo que se muestra al terminar (regla 1).
export interface MedicamentoAConfirmar {
  codigo: string;
  nombre: string;
  precioUnitario: number;
}

interface Props {
  medicamento: MedicamentoAConfirmar;
  cantidad: number;
  onCambiarCantidad: () => void;
  // Tras un rechazo lo que se veía ya no es cierto (stock, medicamento): quien la use debe refrescar la búsqueda.
  onVolverAResultados: () => void;
  onNuevaBusqueda: () => void;
  // Avisa que hay una confirmación en curso, para que el buscador no la deje atrás.
  onOcupado: (ocupado: boolean) => void;
}

type Estado =
  | { tipo: 'resumen' }
  | { tipo: 'confirmando' }
  | { tipo: 'exito'; pedido: Pedido }
  // No se creó ningún pedido (400, 404 o 409).
  | { tipo: 'rechazado'; mensaje: string }
  // Falló la conexión o el servidor: se puede intentar de nuevo.
  | { tipo: 'error'; mensaje: string }
  // Respuesta que no se pudo leer: el pedido pudo crearse, no se ofrece reintentar.
  | { tipo: 'incierto'; mensaje: string };

const unidades = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

function Fila({ etiqueta, children }: { etiqueta: string; children: string }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function ConfirmarPedido({
  medicamento,
  cantidad,
  onCambiarCantidad,
  onVolverAResultados,
  onNuevaBusqueda,
  onOcupado,
}: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'resumen' });
  // US-17 (#48): con sesión, el backend deja el pedido a nombre del vecino.
  const { vecino } = useSesion();
  const zona = useRef<HTMLElement>(null);
  const enviando = useRef(false);
  const { codigo, nombre, precioUnitario } = medicamento;

  // El foco sigue a la vecina: al abrir y al terminar (éxito o error) va a esta zona.
  useEffect(() => {
    if (estado.tipo !== 'confirmando') zona.current?.focus();
  }, [estado.tipo]);

  const ocupado = estado.tipo === 'confirmando';
  useEffect(() => {
    onOcupado(ocupado);
  }, [ocupado, onOcupado]);
  useEffect(() => () => onOcupado(false), [onOcupado]);

  async function confirmar() {
    if (enviando.current) return;
    enviando.current = true;
    setEstado({ tipo: 'confirmando' });
    try {
      setEstado({ tipo: 'exito', pedido: await confirmarPedido(codigo, cantidad) });
      // `enviando` NO se libera: el pedido ya se creó y entre este punto y que React quite el botón hay un
      // instante en que un clic tardío (doble clic, Enter repetido) crearía un segundo pedido.
    } catch (error) {
      // Tampoco se libera si la respuesta fue ilegible: el pedido pudo crearse y no se ofrece reintentar.
      if (!(error instanceof ErrorPedidoIncierto)) enviando.current = false;
      const mensaje = error instanceof ErrorApi ? error.message : 'Tuvimos un problema al crear tu pedido.';
      if (error instanceof ErrorPedidoRechazado) setEstado({ tipo: 'rechazado', mensaje });
      else if (error instanceof ErrorPedidoIncierto) setEstado({ tipo: 'incierto', mensaje });
      else setEstado({ tipo: 'error', mensaje });
    }
  }

  const puedeConfirmar = estado.tipo === 'resumen' || estado.tipo === 'confirmando' || estado.tipo === 'error';
  const textoConfirmar =
    estado.tipo === 'confirmando' ? 'Confirmando…' : estado.tipo === 'error' ? 'Intentar de nuevo' : 'Confirmar pedido';
  // Región de estado siempre presente: así el lector de pantalla anuncia lo que pasa al cambiar su texto.
  const anuncio =
    estado.tipo === 'confirmando'
      ? 'Confirmando tu pedido…'
      : estado.tipo === 'exito'
        ? `Tu pedido fue creado. Número de pedido ${estado.pedido.numeroPedido}.`
        : '';

  return (
    <section ref={zona} className="confirmar" tabIndex={-1} aria-label={`Confirmar pedido de ${nombre}`}>
      <p className="confirmar__anuncio" role="status">
        {anuncio}
      </p>
      {estado.tipo === 'exito' ? (
        <>
          <h2 className="confirmar__titulo">Tu pedido fue creado</h2>
          <dl className="confirmar__datos">
            <Fila etiqueta="Número de pedido">{estado.pedido.numeroPedido}</Fila>
            <Fila etiqueta="Medicamento">{estado.pedido.medicamento}</Fila>
            <Fila etiqueta="Cantidad">{unidades(estado.pedido.cantidad)}</Fila>
            <Fila etiqueta="Precio por unidad">{formatoPesos(estado.pedido.precioUnitario)}</Fila>
            <Fila etiqueta="Total">{formatoPesos(estado.pedido.total)}</Fila>
            <Fila etiqueta="Estado">{estado.pedido.estado}</Fila>
          </dl>
          <p className="confirmar__nota">
            {vecino
              ? `Quedó a tu nombre, ${vecino.nombre}. Puedes revisarlo en «Mis pedidos».`
              : 'Anota tu número de pedido.'}
          </p>
          <button type="button" className="confirmar__principal" onClick={onNuevaBusqueda}>
            Buscar otro medicamento
          </button>
        </>
      ) : (
        <>
          <h2 className="confirmar__titulo">Revisa tu pedido</h2>
          <dl className="confirmar__datos">
            <Fila etiqueta="Medicamento">{nombre}</Fila>
            <Fila etiqueta="Cantidad">{unidades(cantidad)}</Fila>
            <Fila etiqueta="Precio por unidad">{formatoPesos(precioUnitario)}</Fila>
            <Fila etiqueta="Total estimado">{formatoPesos(cantidad * precioUnitario)}</Fila>
          </dl>
          <p className="confirmar__nota">El total final lo confirma la farmacia al crear tu pedido.</p>

          {(estado.tipo === 'rechazado' || estado.tipo === 'error' || estado.tipo === 'incierto') && (
            <div className="confirmar__error" role="alert">
              <p className="confirmar__error-texto">{estado.mensaje}</p>
              {estado.tipo === 'rechazado' && <p>No se creó ningún pedido.</p>}
              {estado.tipo === 'rechazado' && (
                <p className="confirmar__error-ayuda">Vuelve a los resultados para ver cómo quedó el stock y elegir de nuevo.</p>
              )}
            </div>
          )}

          {/* aria-disabled (no disabled) para no perder el foco del teclado mientras confirma. */}
          {puedeConfirmar && (
            <button
              type="button"
              className="confirmar__principal"
              aria-disabled={estado.tipo === 'confirmando'}
              onClick={() => void confirmar()}
            >
              {textoConfirmar}
            </button>
          )}
          {puedeConfirmar && (
            <button
              type="button"
              className="boton-secundario confirmar__secundario"
              aria-disabled={estado.tipo === 'confirmando'}
              onClick={() => !ocupado && onCambiarCantidad()}
            >
              Cambiar cantidad
            </button>
          )}
          {estado.tipo === 'rechazado' && (
            <button type="button" className="confirmar__principal" onClick={onVolverAResultados}>
              Volver a los resultados
            </button>
          )}
          {estado.tipo === 'incierto' && (
            <button type="button" className="confirmar__principal" onClick={onNuevaBusqueda}>
              Buscar otro medicamento
            </button>
          )}
        </>
      )}
    </section>
  );
}
