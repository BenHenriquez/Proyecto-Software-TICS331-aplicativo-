import type { ReactNode } from 'react';
import Icono from './Icono';
import './LayoutPanel.css';

// Panel interno de la farmacia (US-13), separado del sitio de vecinas: otro color de cabecera y una
// cinta de uso interno, para que nadie lo confunda con el sitio público. «Volver al sitio» es un enlace
// normal a propósito: al salir del panel se olvida la clave simulada, que vive solo en memoria.
export default function LayoutPanel({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="panel-cabecera">
        <p className="panel-cabecera__cinta">Uso interno del personal de la farmacia</p>
        <div className="panel-cabecera__franja">
          <div className="panel-cabecera__interior">
            <p className="panel-cabecera__marca">
              <span className="panel-cabecera__logo">
                <Icono nombre="inventario" />
              </span>
              <span>
                Panel de la farmacia <span className="panel-cabecera__lugar">Farmacia Comunitaria de Peñalolén</span>
              </span>
            </p>
            <a className="panel-cabecera__volver" href="/">
              <Icono nombre="casa" />
              Volver al sitio
            </a>
          </div>
        </div>
        <nav className="panel-cabecera__menu" aria-label="Navegación del panel">
          <ul className="panel-cabecera__interior">
            <li>
              <a href="/backoffice" aria-current="page">
                <Icono nombre="inventario" />
                Precios y stock
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <main id="contenido" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
