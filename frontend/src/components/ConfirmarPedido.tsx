import { useEffect, useRef, useState } from 'react';
import { confirmarPedido, ErrorApi, ErrorPedidoIncierto, ErrorPedidoRechazado, type Pedido } from '../lib/api';
import { formatoPesos } from '../lib/formato';
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
  // `refrescar` es true cuando el rechazo indica que lo que se veía ya no es cierto (stock, medicamento).
  onVolverAResultados: (refrescar: boolean) => void;
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
    } catch (error) {
      const mensaje = error instanceof ErrorApi ? error.message : 'Tuvimos un problema al crear tu pedido.';
      if (error instanceof ErrorPedidoRechazado) setEstado({ tipo: 'rechazado', mensaje });
      else if (error instanceof ErrorPedidoIncierto) setEstado({ tipo: 'incierto', mensaje });
      else setEstado({ tipo: 'error', mensaje });
    } finally {
      enviando.current = false;
    }
  }

  const puedeConfirmar = estado.tipo === 'resumen' || estado.tipo === 'confirmando' || estado.tipo === 'error';
  const textoConfirmar =
    estado.tipo === 'confirmando' ? 'Confirmando…' : estado.tipo === 'error' ? 'Intentar de nuevo' : 'Confirmar pedido';

  return (
    <section ref={zona} className="confirmar" tabIndex={-1} aria-label={`Confirmar pedido de ${nombre}`}>
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
          <p className="confirmar__nota">Anota tu número de pedido.</p>
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
            </div>
          )}
          {estado.tipo === 'confirmando' && <p role="status">Confirmando tu pedido…</p>}

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
            <button type="button" className="confirmar__principal" onClick={() => onVolverAResultados(true)}>
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
