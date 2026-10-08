import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { CarritoProvider } from '../lib/carrito';
import Buscador from './Buscador';

// US-16 Carrito (#42), lado de la búsqueda: «Agregar al carrito» desde el selector de cantidad, el aviso,
// el contador del menú y el ciclo completo buscar → agregar varios → carrito → un solo pedido.
const CLAVE = 'farmacia.carrito';
const losartan50 = {
  codigo: 'MED-001',
  nombre: 'Losartán 50 mg',
  principioActivo: 'Losartán potásico',
  presentacion: 'Caja 30 comprimidos',
  precioUnitario: 1990,
  stock: 120,
  disponible: true,
};
const amlodipino = {
  codigo: 'MED-003',
  nombre: 'Amlodipino 5 mg',
  principioActivo: 'Amlodipino',
  presentacion: 'Caja 30 comprimidos',
  precioUnitario: 1490,
  stock: 80,
  disponible: true,
};
const pedidoCreado = {
  numeroPedido: 'P-7KQ4ZD',
  items: [
    { codigo: 'MED-001', medicamento: 'Losartán 50 mg', cantidad: 2, precioUnitario: 1990, subtotal: 3980 },
    { codigo: 'MED-003', medicamento: 'Amlodipino 5 mg', cantidad: 1, precioUnitario: 1490, subtotal: 1490 },
  ],
  total: 5470,
  estado: 'Solicitud creada',
  fechaCreacion: '2026-10-08T15:04:05.000Z',
};

const responder = (status: number, cuerpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }));

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchFalso = vi.fn((url: string) =>
    String(url).startsWith('/api/medicamentos')
      ? responder(200, { resultados: [losartan50, amlodipino] })
      : responder(201, { pedido: pedidoCreado }),
  );
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mostrarBuscador({ conCarrito = true } = {}) {
  const usuario = userEvent.setup();
  const pagina = <Buscador />;
  render(
    conCarrito ? (
      <MemoryRouter>
        <CarritoProvider>{pagina}</CarritoProvider>
      </MemoryRouter>
    ) : (
      pagina
    ),
  );
  return { usuario };
}

async function buscarYElegir(usuario: ReturnType<typeof userEvent.setup>, nombre = 'Losartán 50 mg') {
  await usuario.type(screen.getByRole('searchbox', { name: 'Nombre o principio activo' }), 'a{Enter}');
  await screen.findByRole('list', { name: 'Resultados de la búsqueda' });
  const tarjeta = screen.getByRole('article', { name: nombre });
  await usuario.click(within(tarjeta).getByRole('button', { name: 'Elegir cantidad' }));
  return screen.getByRole('region', { name: `Comprar ${nombre}` });
}

const guardado = () => JSON.parse(window.localStorage.getItem(CLAVE) ?? '[]');

describe('Buscador con carrito', () => {
  it('sin carrito en la app (como en US-15) el selector solo ofrece continuar con el pedido', async () => {
    const { usuario } = mostrarBuscador({ conCarrito: false });

    const selector = await buscarYElegir(usuario);

    expect(within(selector).getByRole('button', { name: 'Continuar con el pedido' })).toBeTruthy();
    expect(within(selector).queryByRole('button', { name: 'Agregar al carrito' })).toBeNull();
  });

  it('con carrito, el selector ofrece «Agregar al carrito» además de «Continuar con el pedido»', async () => {
    const { usuario } = mostrarBuscador();

    const selector = await buscarYElegir(usuario);

    expect(within(selector).getByRole('button', { name: 'Agregar al carrito' })).toBeTruthy();
    expect(within(selector).getByRole('button', { name: 'Continuar con el pedido' })).toBeTruthy();
  });

  it('«Agregar al carrito» guarda la cantidad elegida, avisa y vuelve a los resultados sin buscar de nuevo', async () => {
    const { usuario } = mostrarBuscador();
    const selector = await buscarYElegir(usuario);

    await usuario.click(within(selector).getByRole('button', { name: 'Aumentar cantidad' }));
    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));

    expect(guardado()).toEqual([{ codigo: 'MED-001', nombre: 'Losartán 50 mg', precioUnitario: 1990, cantidad: 2 }]);
    expect(screen.getByText('Agregaste Losartán 50 mg a tu carrito. Ahora tienes 2 unidades.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver mi carrito (2 unidades)' }).getAttribute('href')).toBe('/carrito');
    // Sigue en los resultados para elegir otro medicamento, sin repetir la búsqueda
    expect(screen.getByRole('list', { name: 'Resultados de la búsqueda' })).toBeTruthy();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    // El foco vuelve al botón de la tarjeta que se había elegido
    expect(document.activeElement).toBe(
      within(screen.getByRole('article', { name: 'Losartán 50 mg' })).getByRole('button', { name: 'Elegir cantidad' }),
    );
  });

  it('agregar dos veces el mismo medicamento suma las cantidades', async () => {
    const { usuario } = mostrarBuscador();

    let selector = await buscarYElegir(usuario);
    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));
    await usuario.click(within(screen.getByRole('article', { name: 'Losartán 50 mg' })).getByRole('button', { name: 'Elegir cantidad' }));
    selector = screen.getByRole('region', { name: 'Comprar Losartán 50 mg' });
    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));

    expect(guardado()).toHaveLength(1);
    expect(guardado()[0].cantidad).toBe(2);
    expect(screen.getByText('Agregaste Losartán 50 mg a tu carrito. Ahora tienes 2 unidades.')).toBeTruthy();
  });

  it('al pasar de 20 unidades de un medicamento lo explica y deja 20', async () => {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify([{ codigo: 'MED-001', nombre: 'Losartán 50 mg', precioUnitario: 1990, cantidad: 19 }]),
    );
    const { usuario } = mostrarBuscador();
    const selector = await buscarYElegir(usuario);

    await usuario.click(within(selector).getByRole('button', { name: 'Aumentar cantidad' }));
    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));

    expect(guardado()[0].cantidad).toBe(20);
    expect(screen.getByText('Tu carrito permite hasta 20 unidades de cada medicamento. Ahora tienes 20 unidades de Losartán 50 mg.')).toBeTruthy();
  });

  it('con 10 medicamentos distintos avisa, no agrega otro y deja elegir otra cosa', async () => {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify(
        Array.from({ length: 10 }, (_, i) => ({ codigo: `X-${i}`, nombre: `Otro ${i}`, precioUnitario: 1000, cantidad: 1 })),
      ),
    );
    const { usuario } = mostrarBuscador();
    const selector = await buscarYElegir(usuario);

    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));

    expect(screen.getByText(/Tu carrito ya tiene 10 medicamentos distintos/)).toBeTruthy();
    expect(guardado()).toHaveLength(10);
    // Sigue en el selector: puede volver o continuar con el pedido de solo este medicamento
    expect(screen.getByRole('region', { name: 'Comprar Losartán 50 mg' })).toBeTruthy();
  });

  it('una búsqueda nueva borra el aviso anterior', async () => {
    const { usuario } = mostrarBuscador();
    const selector = await buscarYElegir(usuario);
    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));
    expect(screen.getByText(/Agregaste Losartán 50 mg/)).toBeTruthy();

    await usuario.type(screen.getByRole('searchbox', { name: 'Nombre o principio activo' }), '{Enter}');
    await screen.findByRole('list', { name: 'Resultados de la búsqueda' });

    expect(screen.queryByText(/Agregaste Losartán 50 mg/)).toBeNull();
  });
});

describe('menú: enlace «Mi carrito»', () => {
  function mostrarApp(ruta = '/') {
    const usuario = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <CarritoProvider>
          <App />
        </CarritoProvider>
      </MemoryRouter>,
    );
    const menu = () => within(screen.getByRole('navigation', { name: 'Navegación principal' }));
    return { usuario, menu };
  }

  it('con el carrito vacío dice solo «Mi carrito» y lleva a /carrito', () => {
    const { menu } = mostrarApp();
    expect(menu().getByRole('link', { name: 'Mi carrito' }).getAttribute('href')).toBe('/carrito');
  });

  it('con medicamentos muestra cuántas unidades hay, también para el lector de pantalla', async () => {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify([
        { codigo: 'MED-001', nombre: 'Losartán 50 mg', precioUnitario: 1990, cantidad: 2 },
        { codigo: 'MED-003', nombre: 'Amlodipino 5 mg', precioUnitario: 1490, cantidad: 1 },
      ]),
    );
    const { menu } = mostrarApp();

    const enlace = menu().getByRole('link', { name: 'Mi carrito, 3 unidades' });
    expect(enlace.textContent).toBe('Mi carrito (3)');
  });

  it('con una sola unidad lo dice en singular', () => {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify([{ codigo: 'MED-001', nombre: 'Losartán 50 mg', precioUnitario: 1990, cantidad: 1 }]),
    );
    const { menu } = mostrarApp();
    expect(menu().getByRole('link', { name: 'Mi carrito, 1 unidad' })).toBeTruthy();
  });
});

describe('ciclo completo de US-16', () => {
  it('buscar → agregar dos medicamentos → ver el carrito → confirmar → un solo pedido con los dos', async () => {
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <CarritoProvider>
          <App />
        </CarritoProvider>
      </MemoryRouter>,
    );

    // Primer medicamento: 2 unidades
    let selector = await buscarYElegir(usuario, 'Losartán 50 mg');
    await usuario.click(within(selector).getByRole('button', { name: 'Aumentar cantidad' }));
    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));
    // Segundo medicamento: 1 unidad
    await usuario.click(within(screen.getByRole('article', { name: 'Amlodipino 5 mg' })).getByRole('button', { name: 'Elegir cantidad' }));
    selector = screen.getByRole('region', { name: 'Comprar Amlodipino 5 mg' });
    await usuario.click(within(selector).getByRole('button', { name: 'Agregar al carrito' }));

    // Al carrito, desde el aviso
    await usuario.click(screen.getByRole('link', { name: 'Ver mi carrito (3 unidades)' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Mi carrito' })).toBeTruthy();
    expect(screen.getByText('Total estimado: $5.470')).toBeTruthy();

    // Confirmar: una sola petición con los dos medicamentos, solo códigos y cantidades
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('heading', { name: 'Tu pedido fue creado' });

    const peticiones = fetchFalso.mock.calls.filter(([url]) => url === '/api/pedidos');
    expect(peticiones).toHaveLength(1);
    expect(JSON.parse(String(peticiones[0][1].body))).toEqual({
      items: [
        { codigo: 'MED-001', cantidad: 2 },
        { codigo: 'MED-003', cantidad: 1 },
      ],
    });
    expect(screen.getByText('Total: $5.470')).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name: 'Mi carrito' })).toBeTruthy();
    expect(guardado()).toEqual([]);
  });
});
