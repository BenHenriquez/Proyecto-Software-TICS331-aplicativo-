import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import ConfirmarPedido from './ConfirmarPedido';
import PasosCompra from './PasosCompra';
import SelectorCantidad from './SelectorCantidad';

// Arreglo general de UX/UI: navegación por actor, cuenta en un lugar fijo, pasos de la compra,
// ayudas del selector e invitación a ingresar después de comprar.
const responder = (status: number, cuerpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }));

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchFalso = vi.fn((url: string) =>
    url === '/api/sesion' ? responder(200, { vecino: null }) : responder(404, { motivo: 'ruta_no_existe' }),
  );
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mostrarApp(ruta = '/') {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

describe('cabecera del sitio de vecinas', () => {
  it('el menú tiene solo destinos de vecinas: el panel de la farmacia se abre desde el pie', () => {
    mostrarApp();
    const menu = within(screen.getByRole('navigation', { name: 'Navegación principal' }));
    expect(menu.getAllByRole('link').map((a) => a.textContent)).toEqual(['Buscar medicamento', 'Mis pedidos', 'Mi carrito']);
    expect(menu.queryByRole('link', { name: /Backoffice|Panel/ })).toBeNull();

    const pie = within(screen.getByRole('contentinfo'));
    expect(pie.getByRole('link', { name: '¿Trabajas en la farmacia? Panel de la farmacia' }).getAttribute('href')).toBe(
      '/backoffice',
    );
  });

  it('«Ingresar» va en el espacio de la cuenta, fuera del menú de destinos', async () => {
    mostrarApp();
    const ingresar = await screen.findByRole('link', { name: 'Ingresar' });
    expect(ingresar.closest('nav')).toBeNull();
    expect(ingresar.closest('.cuenta')).not.toBeNull();
  });
});

describe('panel de la farmacia', () => {
  it('tiene su propia cabecera de uso interno y un enlace para volver al sitio', () => {
    mostrarApp('/backoffice');
    expect(screen.getByText('Uso interno del personal de la farmacia')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al sitio' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Precios y stock' })).toBeTruthy();
  });
});

describe('indicador de pasos de la compra', () => {
  it('marca el paso actual y anuncia los anteriores como listos', () => {
    render(<PasosCompra actual="Revisar" />);
    const pasos = within(screen.getByRole('list', { name: 'Pasos de la compra' })).getAllByRole('listitem');
    expect(pasos.map((p) => p.textContent)).toEqual(['✓Buscar (listo)', '✓Cantidad (listo)', '3Revisar', '4Listo']);
    expect(pasos[2].getAttribute('aria-current')).toBe('step');
  });
});

describe('selector de cantidad', () => {
  const amlodipino = { codigo: 'MED-003', nombre: 'Amlodipino 5 mg', precioUnitario: 1490, stock: 80 };

  it('con carrito explica qué hace cada uno de los dos caminos', () => {
    render(<SelectorCantidad medicamento={amlodipino} onContinuar={vi.fn()} onAgregar={vi.fn()} />);
    expect(screen.getByText('Pides solo este medicamento ahora.')).toBeTruthy();
    expect(screen.getByText('Sigues buscando y pides todo junto al final.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Pasos de la compra' })).toBeTruthy();
  });

  it('sin carrito no muestra ayudas, porque hay un solo camino', () => {
    render(<SelectorCantidad medicamento={amlodipino} onContinuar={vi.fn()} />);
    expect(screen.queryByText('Pides solo este medicamento ahora.')).toBeNull();
  });
});

describe('después de comprar sin sesión', () => {
  it('invita a ingresar para que los pedidos queden a su nombre', async () => {
    fetchFalso.mockImplementation(() =>
      responder(201, {
        pedido: {
          numeroPedido: 'P-ABC234',
          items: [{ codigo: 'MED-002', medicamento: 'Losartán 100 mg', cantidad: 1, precioUnitario: 2890, subtotal: 2890 }],
          medicamento: 'Losartán 100 mg',
          cantidad: 1,
          precioUnitario: 2890,
          total: 2890,
          estado: 'Solicitud creada',
          fechaCreacion: '2026-10-08T15:30:00.000Z',
        },
      }),
    );
    const usuario = userEvent.setup();
    render(
      <ConfirmarPedido
        medicamento={{ codigo: 'MED-002', nombre: 'Losartán 100 mg', precioUnitario: 2890 }}
        cantidad={1}
        onCambiarCantidad={vi.fn()}
        onVolverAResultados={vi.fn()}
        onNuevaBusqueda={vi.fn()}
        onOcupado={vi.fn()}
      />,
    );
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    expect(await screen.findByText(/¿Quieres que tus pedidos queden a tu nombre\?/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ingresa con Neuro-Access.' }).getAttribute('href')).toBe('/ingresar');
    expect(within(screen.getByRole('list', { name: 'Pasos de la compra' })).getAllByRole('listitem')[3].getAttribute('aria-current')).toBe(
      'step',
    );
  });
});
