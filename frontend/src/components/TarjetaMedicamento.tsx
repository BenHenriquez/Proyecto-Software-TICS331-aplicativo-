import { forwardRef, useId } from 'react';
import type { Medicamento } from '../lib/api';
import { formatoPesos } from '../lib/formato';
import './TarjetaMedicamento.css';

interface Props {
  medicamento: Medicamento;
  onElegir: (medicamento: Medicamento) => void;
}

// #8: tarjeta con los cuatro datos de US-02 (nombre oficial con su dosificación, principio activo,
// precio y disponibilidad). #9: sin stock se dice con texto visible y no se ofrece comprar.
// La ref apunta al botón «Elegir cantidad», para devolverle el foco al volver del selector.
const TarjetaMedicamento = forwardRef<HTMLButtonElement, Props>(function TarjetaMedicamento(
  { medicamento, onElegir },
  refBoton,
) {
  const idTitulo = useId();
  const { nombre, principioActivo, presentacion, precioUnitario, disponible } = medicamento;

  return (
    <article className="tarjeta" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="tarjeta__nombre">
        {nombre}
      </h2>
      <dl className="tarjeta__datos">
        <div>
          <dt>Principio activo</dt>
          <dd>{principioActivo}</dd>
        </div>
        <div>
          <dt>Presentación</dt>
          <dd>{presentacion}</dd>
        </div>
        <div>
          <dt>Precio por unidad</dt>
          <dd className="tarjeta__precio">{formatoPesos(precioUnitario)}</dd>
        </div>
      </dl>

      {disponible ? (
        <>
          <p className="tarjeta__estado tarjeta__estado--disponible">
            <span aria-hidden="true">✓ </span>Disponible
          </p>
          <button
            ref={refBoton}
            type="button"
            className="tarjeta__elegir"
            aria-describedby={idTitulo}
            onClick={() => onElegir(medicamento)}
          >
            Elegir cantidad
          </button>
        </>
      ) : (
        <>
          <p className="tarjeta__estado tarjeta__estado--sin-stock">
            <span aria-hidden="true">✕ </span>Sin stock
          </p>
          <p className="tarjeta__nota">Por ahora no lo tenemos. Puedes volver a consultar más adelante.</p>
        </>
      )}
    </article>
  );
});

export default TarjetaMedicamento;
