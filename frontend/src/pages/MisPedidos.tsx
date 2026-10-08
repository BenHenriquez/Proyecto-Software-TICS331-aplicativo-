import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi, ErrorSinSesion, listarMisPedidos, type PedidoCarrito } from '../lib/api';
import { formatoPesos } from '../lib/formato';
import { useSesion } from '../lib/sesion';
import './Ingresar.css';

// #48 Mis pedidos (US-17, #43): los pedidos confirmados con la sesión iniciada, del más reciente al
// más antiguo, cada uno con todos sus medicamentos (un pedido del carrito de US-16 puede tener varios).
type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'sin-sesion'; mensaje: string }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; pedidos: PedidoCarrito[] };

const MENSAJE_SIN_SESION = 'Para ver tus pedidos, primero ingresa con tu app Neuro-Access.';
const unidades = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', hour12: false });

export default function MisPedidos() {
  const { vecino } = useSesion();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  // Se vuelve a pedir cuando cambia la sesión (por ejemplo, al salir desde la cabecera).
  useEffect(() => {
    let activo = true;
    setEstado({ tipo: 'cargando' });
    listarMisPedidos()
      .then((pedidos) => activo && setEstado({ tipo: 'listo', pedidos }))
      .catch((error) => {
        if (!activo) return;
        if (error instanceof ErrorSinSesion) setEstado({ tipo: 'sin-sesion', mensaje: error.message || MENSAJE_SIN_SESION });
        else setEstado({ tipo: 'error', mensaje: error instanceof ErrorApi ? error.message : 'Tuvimos un problema.' });
      });
    return () => {
      activo = false;
    };
  }, [vecino]);

  return (
    <section className="ingresar" aria-labelledby="titulo-mis-pedidos">
      <h1 id="titulo-mis-pedidos">Mis pedidos</h1>
      <p className="ingresar__estado" role="status">
        {estado.tipo === 'cargando' ? 'Buscando tus pedidos…' : ''}
      </p>

      {estado.tipo === 'sin-sesion' && (
        <div className="aviso">
          <p>{estado.mensaje}</p>
          <Link to="/ingresar" className="boton-enlace boton-enlace--principal">
            Ingresar con Neuro-Access
          </Link>
        </div>
      )}

      {estado.tipo === 'error' && (
        <div className="aviso aviso--error" role="alert">
          <p>{estado.mensaje}</p>
        </div>
      )}

      {estado.tipo === 'listo' && estado.pedidos.length === 0 && (
        <div className="aviso">
          <p>Aún no tienes pedidos hechos con tu sesión.</p>
          <p>
            <Link to="/">Buscar un medicamento</Link>
          </p>
        </div>
      )}

      {estado.tipo === 'listo' && estado.pedidos.length > 0 && (
        <ul className="mis-pedidos__lista">
          {estado.pedidos.map((p) => (
            <li key={p.numeroPedido}>
              <article className="mis-pedidos__pedido" aria-labelledby={`pedido-${p.numeroPedido}`}>
                <h2 id={`pedido-${p.numeroPedido}`}>Pedido {p.numeroPedido}</h2>
                <dl>
                  <div>
                    <dt>{p.items.length === 1 ? 'Medicamento' : 'Medicamentos'}</dt>
                    <dd>
                      <ul className="mis-pedidos__items">
                        {p.items.map((item) => (
                          <li key={item.codigo}>
                            {item.medicamento} · {unidades(item.cantidad)}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{formatoPesos(p.total)}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{p.estado}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{fecha(p.fechaCreacion)}</dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
