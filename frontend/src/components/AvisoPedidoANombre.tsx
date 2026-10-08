import { Link, useInRouterContext } from 'react-router-dom';
import { useSesion } from '../lib/sesion';

// Después de crear un pedido (US-15 o carrito de US-16). Con sesión de US-17 confirma que quedó a nombre
// del vecino; sin sesión lo invita a ingresar, sin obligarlo. Fuera de un router (tests de una sola
// pantalla) el enlace es uno normal.
export default function AvisoPedidoANombre() {
  const { vecino } = useSesion();
  const enRouter = useInRouterContext();

  if (vecino) {
    return <p className="pedido-a-nombre">{`Quedó a tu nombre, ${vecino.nombre}. Puedes revisarlo en «Mis pedidos».`}</p>;
  }
  const texto = 'Ingresa con Neuro-Access.';
  return (
    <p className="pedido-a-nombre">
      ¿Quieres que tus pedidos queden a tu nombre?{' '}
      {enRouter ? <Link to="/ingresar">{texto}</Link> : <a href="/ingresar">{texto}</a>}
    </p>
  );
}
