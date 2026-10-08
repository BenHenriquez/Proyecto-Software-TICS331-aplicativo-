import { useId, useState } from 'react';
import { formatoPesos } from '../lib/formato';
import './SelectorCantidad.css';

// Espejo de CANTIDAD_MAXIMA en backend/src/services/pedidosService.js. El backend sigue siendo
// la fuente de verdad: aquí solo evitamos que la vecina elija algo que igual será rechazado.
export const CANTIDAD_MAXIMA = 20;

// Subconjunto del resultado de búsqueda (MODELO_DE_DATOS.md §3): un resultado se puede pasar tal cual.
export interface MedicamentoComprable {
  codigo: string;
  nombre: string;
  precioUnitario: number;
  stock: number;
}

interface Props {
  medicamento: MedicamentoComprable;
  // Entrega solo la cantidad: el precio y el total los calcula el backend (regla 1).
  onContinuar: (cantidad: number) => void;
  // US-16: si viene, se ofrece también «Agregar al carrito» con la misma cantidad.
  onAgregar?: (cantidad: number) => void;
}

// Solo enteros entre 1 y el máximo; "", "0", "1.5", "-2" o "25" no son cantidades válidas.
function leerCantidad(texto: string, maximo: number): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const cantidad = Number(texto);
  return cantidad >= 1 && cantidad <= maximo ? cantidad : null;
}

function SelectorDeCantidad({ medicamento, onContinuar, onAgregar }: Props) {
  const { nombre, precioUnitario, stock } = medicamento;
  const idCampo = useId();
  const idAyuda = useId();
  const idError = useId();
  const [texto, setTexto] = useState('1');

  if (stock <= 0) {
    return (
      <section className="selector" aria-label={`Comprar ${nombre}`}>
        <h2 className="selector__nombre">{nombre}</h2>
        <p className="selector__sin-stock">Sin stock</p>
        <p>Este medicamento no tiene stock disponible por ahora.</p>
      </section>
    );
  }

  const maximo = Math.min(stock, CANTIDAD_MAXIMA);
  const cantidad = leerCantidad(texto, maximo);
  const enElMinimo = cantidad !== null && cantidad <= 1;
  const enElMaximo = cantidad !== null && cantidad >= maximo;

  // Los botones usan aria-disabled (no disabled) para no perder el foco del teclado al llegar al límite.
  const bajar = () => {
    if (cantidad === null) setTexto('1');
    else if (!enElMinimo) setTexto(String(cantidad - 1));
  };
  const subir = () => {
    if (cantidad === null) setTexto('1');
    else if (!enElMaximo) setTexto(String(cantidad + 1));
  };

  const ayuda = maximo === 1 ? 'Puedes pedir 1 unidad.' : `Puedes pedir hasta ${maximo} unidades.`;
  const error = maximo === 1 ? 'Solo hay 1 unidad disponible.' : `Elige una cantidad entre 1 y ${maximo}.`;

  return (
    <section className="selector" aria-label={`Comprar ${nombre}`}>
      <h2 className="selector__nombre">{nombre}</h2>
      <p className="selector__precio">{`Precio por unidad: ${formatoPesos(precioUnitario)}`}</p>

      <label className="selector__etiqueta" htmlFor={idCampo}>
        Cantidad
      </label>
      <div className="selector__control">
        <button
          type="button"
          className="selector__paso"
          aria-label="Disminuir cantidad"
          aria-disabled={enElMinimo}
          onClick={bajar}
        >
          −
        </button>
        <input
          id={idCampo}
          className="selector__campo"
          type="number"
          inputMode="numeric"
          min={1}
          max={maximo}
          step={1}
          value={texto}
          aria-describedby={cantidad === null ? `${idAyuda} ${idError}` : idAyuda}
          aria-invalid={cantidad === null}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button
          type="button"
          className="selector__paso"
          aria-label="Aumentar cantidad"
          aria-disabled={enElMaximo}
          onClick={subir}
        >
          +
        </button>
      </div>
      <p id={idAyuda} className="selector__ayuda">
        {ayuda}
      </p>
      {cantidad === null && (
        <p id={idError} className="selector__error" role="alert">
          {error}
        </p>
      )}

      <output className="selector__total" aria-live="polite">
        {`Total: ${cantidad === null ? '—' : formatoPesos(cantidad * precioUnitario)}`}
      </output>
      <p className="selector__nota">El total final lo confirma la farmacia al crear tu pedido.</p>

      <button
        type="button"
        className="selector__continuar"
        disabled={cantidad === null}
        onClick={() => cantidad !== null && onContinuar(cantidad)}
      >
        Continuar con el pedido
      </button>
      {onAgregar && (
        <button
          type="button"
          className="boton-secundario selector__agregar"
          disabled={cantidad === null}
          onClick={() => cantidad !== null && onAgregar(cantidad)}
        >
          Agregar al carrito
        </button>
      )}
    </section>
  );
}

// La `key` por código reinicia la cantidad cuando el padre reutiliza el componente con otro medicamento.
export default function SelectorCantidad(props: Props) {
  return <SelectorDeCantidad key={props.medicamento.codigo} {...props} />;
}
