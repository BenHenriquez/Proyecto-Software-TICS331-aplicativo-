import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MisPedidos from './MisPedidos';

// #48 Mis pedidos (US-17, #43). El backend se simula con un fetch falso de GET /api/mis-pedidos.
const responder = (status: number, cuerpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }));

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mostrar() {
  render(
    <MemoryRouter>
      <MisPedidos />
    </MemoryRouter>,
  );
}

const pedido = {
  numeroPedido: 'P-ABC234',
  medicamento: 'Losartán 50 mg',
  cantidad: 2,
  precioUnitario: 1990,
  total: 3980,
  estado: 'Solicitud creada',
  fechaCreacion: '2026-10-08T15:30:00.000Z',
};

describe('Mis pedidos', () => {
  it('muestra cada pedido con número, medicamento, cantidad, total y estado', async () => {
    fetchFalso.mockReturnValue(responder(200, { pedidos: [pedido] }));
    mostrar();

    const tarjeta = await screen.findByRole('article', { name: 'Pedido P-ABC234' });
    expect(within(tarjeta).getByText('Losartán 50 mg')).toBeTruthy();
    expect(within(tarjeta).getByText('2 unidades')).toBeTruthy();
    expect(within(tarjeta).getByText('$3.980')).toBeTruthy();
    expect(within(tarjeta).getByText('Solicitud creada')).toBeTruthy();
    expect(fetchFalso).toHaveBeenCalledWith('/api/mis-pedidos', { method: 'GET' });
  });

  it('sin sesión pide ingresar con Neuro-Access, con un enlace a "Ingresar"', async () => {
    fetchFalso.mockReturnValue(
      responder(401, { motivo: 'sin_sesion', mensaje: 'Para ver tus pedidos, primero ingresa con tu app Neuro-Access.' }),
    );
    mostrar();

    expect(await screen.findByText('Para ver tus pedidos, primero ingresa con tu app Neuro-Access.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ingresar con Neuro-Access' }).getAttribute('href')).toBe('/ingresar');
  });

  it('sin pedidos lo dice en vez de dejar la pantalla vacía', async () => {
    fetchFalso.mockReturnValue(responder(200, { pedidos: [] }));
    mostrar();
    expect(await screen.findByText('Aún no tienes pedidos hechos con tu sesión.')).toBeTruthy();
  });

  it('si el servidor falla, muestra un mensaje simple y nunca el error técnico', async () => {
    fetchFalso.mockReturnValue(responder(500, { motivo: 'error_interno', mensaje: 'stack trace' }));
    mostrar();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('No pudimos mostrar tus pedidos. Por favor, inténtalo de nuevo en un momento.');
  });
});
