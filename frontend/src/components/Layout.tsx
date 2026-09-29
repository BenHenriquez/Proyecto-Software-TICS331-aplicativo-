import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const principal = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // Al cambiar de pantalla, el foco va al contenido para que el teclado y los lectores sigan el cambio.
  useEffect(() => {
    principal.current?.focus();
  }, [pathname]);

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="cabecera">
        <p className="marca">Farmacia Comunitaria de Peñalolén</p>
        <nav aria-label="Navegación principal">
          <ul className="menu">
            <li>
              <NavLink to="/" end>
                Buscar medicamento
              </NavLink>
            </li>
            <li>
              <NavLink to="/backoffice">Backoffice</NavLink>
            </li>
          </ul>
        </nav>
      </header>
      <main id="contenido" ref={principal} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="pie">
        <p>Prototipo con datos sintéticos. Los precios y el stock no son reales.</p>
      </footer>
    </>
  );
}
