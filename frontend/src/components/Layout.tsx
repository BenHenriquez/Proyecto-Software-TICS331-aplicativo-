import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCarritoOpcional } from '../lib/carrito';
import { useSesion } from '../lib/sesion';
import Icono from './Icono';
import './Layout.css';

// Sitio de vecinas y cuidadoras. Cabecera en dos franjas: la azul tiene la marca y un espacio fijo de
// cuenta («Ingresar» o «Hola, X · Salir» en el mismo lugar, así el menú nunca cambia); la clara tiene
// los destinos. El panel interno de la farmacia no está en el menú: se entra desde el pie de página.
export default function Layout() {
  const principal = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const rutaAnterior = useRef(pathname);
  const unidadesEnCarrito = useCarritoOpcional()?.unidades ?? 0;
  const { vecino, salir } = useSesion();

  // Al cambiar de pantalla, el foco va al contenido para que el teclado y los lectores sigan el cambio.
  // En la primera carga no se mueve, para que el primer Tab llegue a "Saltar al contenido".
  useEffect(() => {
    if (rutaAnterior.current === pathname) return;
    rutaAnterior.current = pathname;
    principal.current?.focus();
  }, [pathname]);

  // En el celular la cabecera queda fija arriba mientras se recorren los resultados de la búsqueda.
  const fija = pathname === '/';

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className={fija ? 'cabecera cabecera--fija' : 'cabecera'}>
        <div className="cabecera__franja">
          <div className="cabecera__interior">
            <Link to="/" className="cabecera__marca">
              <span className="cabecera__logo">
                <Icono nombre="cruz" />
              </span>
              <span>
                Farmacia <span className="cabecera__lugar">Comunitaria de Peñalolén</span>
              </span>
            </Link>
            <div className="cuenta">
              {vecino ? (
                <>
                  <p className="cuenta__saludo">
                    <Icono nombre="usuario" />
                    <span>Hola, {vecino.nombre}</span>
                  </p>
                  <button type="button" className="cuenta__salir" onClick={() => void salir()}>
                    <Icono nombre="salir" />
                    Salir
                  </button>
                </>
              ) : (
                <NavLink to="/ingresar" className="cuenta__ingresar">
                  <Icono nombre="qr" />
                  Ingresar
                </NavLink>
              )}
            </div>
          </div>
        </div>
        <nav className="servicio" aria-label="Navegación principal">
          <ul className="cabecera__interior menu">
            <li>
              <NavLink to="/" end>
                <Icono nombre="buscar" />
                Buscar medicamento
              </NavLink>
            </li>
            <li>
              <NavLink to="/mis-pedidos">
                <Icono nombre="pedidos" />
                Mis pedidos
              </NavLink>
            </li>
            <li className="menu__carrito">
              <NavLink
                to="/carrito"
                aria-label={
                  unidadesEnCarrito > 0
                    ? `Mi carrito, ${unidadesEnCarrito} ${unidadesEnCarrito === 1 ? 'unidad' : 'unidades'}`
                    : undefined
                }
              >
                <Icono nombre="carrito" />
                Mi carrito
                {unidadesEnCarrito > 0 && (
                  <span className="insignia" aria-hidden="true">
                    {unidadesEnCarrito}
                  </span>
                )}
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>
      <main id="contenido" ref={principal} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="pie">
        <p>Prototipo con datos sintéticos. Los precios y el stock no son reales.</p>
        <p>
          <Link to="/backoffice">¿Trabajas en la farmacia? Panel de la farmacia</Link>
        </p>
      </footer>
    </>
  );
}
