// Iconos de línea para la navegación y los botones. Son decorativos: siempre van junto a un texto
// visible, así que se ocultan al lector de pantalla y no cambian el nombre accesible del control.
const TRAZOS = {
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  carrito: (
    <>
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),
  pedidos: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  salir: (
    <>
      <path d="M15 4h4v16h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3M21 14v7h-4" />
    </>
  ),
  volver: <path d="M15 5l-7 7 7 7" />,
  mas: <path d="M12 5v14M5 12h14" />,
  cruz: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  inventario: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </>
  ),
  casa: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
};

export type NombreIcono = keyof typeof TRAZOS;

export default function Icono({ nombre }: { nombre: NombreIcono }) {
  return (
    <svg className="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRAZOS[nombre]}
    </svg>
  );
}
