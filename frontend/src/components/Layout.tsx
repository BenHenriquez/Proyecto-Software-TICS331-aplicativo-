import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCarritoOpcional } from '../lib/carrito';

export default function Layout() {
  const principal = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const rutaAnterior = useRef(pathname);
  const unidadesEnCarrito = useCarritoOpcional()?.unidades ?? 0;

  // Al cambiar de pantalla, el foco va al contenido para que el teclado y los lectores sigan el cambio.
  // En la primera carga no se mueve, para que el primer Tab llegue a "Saltar al contenido".
  useEffect(() => {
    if (rutaAnterior.current === pathname) return;
    rutaAnterior.current = pathname;
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
              <NavLink
                to="/carrito"
                aria-label={
                  unidadesEnCarrito > 0
                    ? `Mi carrito, ${unidadesEnCarrito} ${unidadesEnCarrito === 1 ? 'unidad' : 'unidades'}`
                    : undefined
                }
              >
                {unidadesEnCarrito > 0 ? `Mi carrito (${unidadesEnCarrito})` : 'Mi carrito'}
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
