import { useId, useState, type FormEvent } from 'react';
import type { CambiosMedicamento, ErroresCampo, MedicamentoBackoffice } from '../lib/api';
import { formatoPesos } from '../lib/formato';
import './FilaMantencion.css';

// #13: una fila del panel de mantención (US-13). Muestra lo guardado y deja editar precio y stock.
export type AvisoFila =
  | { tipo: 'exito' | 'info'; texto: string }
  | { tipo: 'error'; texto?: string; ayuda?: string; errores?: ErroresCampo };

interface Props {
  medicamento: MedicamentoBackoffice;
  // Sube cuando el panel manda reiniciar el borrador (tras guardar o tras un conflicto de versión).
  reinicio: number;
  aviso?: AvisoFila;
  guardando: boolean;
  // Entrega solo lo que cambió y la version sobre la que se empezó a editar (candado de #12).
  onGuardar: (cambios: CambiosMedicamento, version: number) => void;
  onSinCambios: () => void;
}

// Lo que mostraban los campos al empezar a editar. Sirve para saber qué cambió y con qué version.
interface Origen {
  version: number;
  reinicio: number;
  precio: string;
  stock: string;
}

const origenDe = (m: MedicamentoBackoffice, reinicio: number): Origen => ({
  version: m.version,
  reinicio,
  precio: String(m.precioUnitario),
  stock: String(m.stock),
});

// Un entero escrito se envía como número y cualquier otra cosa tal cual, para que el backend la
// rechace y explique el motivo. Por eso los campos son de texto (type="number" vaciaría «abc»).
// Los decimales y los puntos de miles NO se convierten: en Chile «10.000» es diez mil, pero
// Number('10.000') daría 10, un entero válido que se guardaría sin avisar.
function aValor(texto: string): number | string {
  const limpio = texto.trim();
  return /^-?\d+$/.test(limpio) ? Number(limpio) : limpio;
}

const unidades = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

function Fila({ medicamento, reinicio, aviso, guardando, onGuardar, onSinCambios }: Props) {
  const idTitulo = useId();
  const idPrecio = useId();
  const idStock = useId();
  const idErrorPrecio = useId();
  const idErrorStock = useId();
  const [origen, setOrigen] = useState(() => origenDe(medicamento, reinicio));
  const [precio, setPrecio] = useState(origen.precio);
  const [stock, setStock] = useState(origen.stock);

  // Se vuelve a leer lo guardado cuando el panel lo pide, o cuando cambió y no hay nada escrito.
  // Un borrador sin guardar se respeta y conserva su version de origen: si el medicamento cambió
  // mientras tanto, el backend lo rechaza con 409 en vez de dejar que pise esa venta.
  const hayBorrador = precio !== origen.precio || stock !== origen.stock;
  if (reinicio !== origen.reinicio || (!hayBorrador && medicamento.version !== origen.version)) {
    const nuevo = origenDe(medicamento, reinicio);
    setOrigen(nuevo);
    setPrecio(nuevo.precio);
    setStock(nuevo.stock);
  }

  const errores = aviso?.tipo === 'error' ? (aviso.errores ?? {}) : {};
  const errorFila = aviso?.tipo === 'error' ? (errores.general ?? aviso.texto) : undefined;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (guardando) return;
    const cambios: CambiosMedicamento = {};
    if (precio !== origen.precio) cambios.precioUnitario = aValor(precio);
    if (stock !== origen.stock) cambios.stock = aValor(stock);
    if (Object.keys(cambios).length === 0) onSinCambios();
    else onGuardar(cambios, origen.version);
  }

  return (
    <article className="fila" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="fila__nombre">
        {medicamento.nombre}
      </h2>
      <p className="fila__detalle">{medicamento.principioActivo}</p>
      <p className="fila__detalle">{medicamento.presentacion}</p>
      {medicamento.stock <= 0 && <p className="fila__sin-stock">Sin stock</p>}

      <dl className="fila__guardado">
        <div>
          <dt>Precio guardado</dt>
          <dd>{formatoPesos(medicamento.precioUnitario)}</dd>
        </div>
        <div>
          <dt>Stock guardado</dt>
          <dd>{unidades(medicamento.stock)}</dd>
        </div>
      </dl>

      <form className="fila__formulario" noValidate onSubmit={enviar}>
        <div className="fila__campo">
          <label htmlFor={idPrecio}>Precio por unidad (pesos)</label>
          <input
            id={idPrecio}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={precio}
            aria-invalid={errores.precioUnitario ? true : undefined}
            aria-describedby={errores.precioUnitario ? idErrorPrecio : undefined}
            onChange={(e) => setPrecio(e.target.value)}
          />
          {errores.precioUnitario && (
            <p id={idErrorPrecio} className="fila__error" role="alert">
              {errores.precioUnitario}
            </p>
          )}
        </div>

        <div className="fila__campo">
          <label htmlFor={idStock}>Stock (unidades)</label>
          <input
            id={idStock}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={stock}
            aria-invalid={errores.stock ? true : undefined}
            aria-describedby={errores.stock ? idErrorStock : undefined}
            onChange={(e) => setStock(e.target.value)}
          />
          {errores.stock && (
            <p id={idErrorStock} className="fila__error" role="alert">
              {errores.stock}
            </p>
          )}
        </div>

        {/* aria-disabled (no disabled) para no perder el foco del teclado mientras guarda. */}
        <button
          type="submit"
          className="fila__guardar"
          aria-disabled={guardando}
        >
          {guardando ? (
            'Guardando…'
          ) : (
            <>
              Guardar cambios{' '}
              <span className="solo-lectores">de {medicamento.nombre}</span>
            </>
          )}
        </button>
      </form>

      {errorFila && (
        <p className="fila__error fila__error--fila" role="alert">
          <span>{errorFila}</span>
          {aviso?.tipo === 'error' && aviso.ayuda && <span className="fila__ayuda"> {aviso.ayuda}</span>}
        </p>
      )}
      {/* Siempre presente (aunque vacía) para que el lector de pantalla anuncie el aviso al aparecer. */}
      <p className={aviso && aviso.tipo !== 'error' ? 'aviso' : undefined} role="status">
        {aviso && aviso.tipo !== 'error' ? aviso.texto : ''}
      </p>
    </article>
  );
}

export default function FilaMantencion(props: Props) {
  // Sin `key` por version: la fila se queda montada al guardar y el foco no se pierde.
  return <Fila {...props} />;
}
