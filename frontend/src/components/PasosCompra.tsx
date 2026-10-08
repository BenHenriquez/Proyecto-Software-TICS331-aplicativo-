import './PasosCompra.css';

// Indicador de pasos de la compra (arreglo general de UX/UI): le dice a la vecina en qué paso va y
// cuántos faltan. El paso actual lleva aria-current="step" y los anteriores se anuncian como listos.
const PASOS = ['Buscar', 'Cantidad', 'Revisar', 'Listo'] as const;
export type PasoCompra = (typeof PASOS)[number];

export default function PasosCompra({ actual }: { actual: PasoCompra }) {
  const indiceActual = PASOS.indexOf(actual);
  return (
    <ol className="pasos-compra" aria-label="Pasos de la compra">
      {PASOS.map((paso, i) => {
        const estado = i < indiceActual ? 'hecho' : i === indiceActual ? 'actual' : 'pendiente';
        return (
          <li key={paso} className={`pasos-compra__paso pasos-compra__paso--${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
            <span className="pasos-compra__marca" aria-hidden="true">
              {estado === 'hecho' ? '✓' : i + 1}
            </span>
            {paso}
            {estado === 'hecho' && <span className="solo-lector"> (listo)</span>}
          </li>
        );
      })}
    </ol>
  );
}
