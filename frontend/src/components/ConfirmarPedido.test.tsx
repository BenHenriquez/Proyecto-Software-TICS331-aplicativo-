import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmarPedido from './ConfirmarPedido';

// #18 Pantalla de confirmación (US-15, #3): resumen del pedido, botón de confirmar y mensaje de
// éxito o de «ya no hay stock disponible». El backend se simula con un fetch falso que responde como
// POST /api/pedidos (MODELO_DE_DATOS.md §3). El precio y el total reales los calcula el backend.
const losartan100 = { codigo: 'MED-002', nombre: 'Losartán 100 mg', precioUnitario: 2890 };
const pedidoCreado = {
  numeroPedido: 'P-7KQ4ZD',
  medicamento: 'Losartán 100 mg',
  cantidad: 2,
  precioUnitario: 2890,
  total: 5780,
  estado: 'Solicitud creada',
  fechaCreacion: '2026-10-01T15:04:05.000Z',
};
const SIN_STOCK = 'Este medicamento ya no tiene stock disponible.';

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

function mostrar(cantidad = 2, medicamento = losartan100) {
  const props = {
    onCambiarCantidad: vi.fn(),
    onVolverAResultados: vi.fn(),
    onNuevaBusqueda: vi.fn(),
    onOcupado: vi.fn(),
  };
  const usuario = userEvent.setup();
  render(<ConfirmarPedido medicamento={medicamento} cantidad={cantidad} {...props} />);
  return {
    usuario,
    ...props,
    confirmar: () => screen.getByRole('button', { name: /Confirmar pedido/ }),
    zona: () => screen.getByRole('region', { name: `Confirmar pedido de ${medicamento.nombre}` }),
  };
}

const cuerpoDelPost = () => JSON.parse(String(fetchFalso.mock.calls[0][1].body));
// Cada dato va en su fila (dt/dd): se busca el valor dentro de la fila de su etiqueta.
const fila = (etiqueta: string) => within(screen.getByText(etiqueta).closest('div') as HTMLElement);
const botones = (zona: HTMLElement) => within(zona).getAllByRole('button').map((b) => b.textContent?.trim());

describe('ConfirmarPedido', () => {
  describe('resumen del pedido antes de confirmar', () => {
    it('muestra medicamento, cantidad, precio por unidad y total estimado, sin llamar todavía al backend', () => {
      mostrar(2);

      expect(screen.getByRole('heading', { name: 'Revisa tu pedido' })).toBeTruthy();
      expect(fila('Medicamento').getByText('Losartán 100 mg')).toBeTruthy();
      expect(fila('Cantidad').getByText('2 unidades')).toBeTruthy();
      expect(fila('Precio por unidad').getByText('$2.890')).toBeTruthy();
      expect(fila('Total estimado').getByText('$5.780')).toBeTruthy();
      expect(screen.getByText(/El total final lo confirma la farmacia/)).toBeTruthy();
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it('con una sola unidad lo dice en singular y el total es el precio de una unidad', () => {
      mostrar(1);

      expect(fila('Cantidad').getByText('1 unidad')).toBeTruthy();
      expect(fila('Total estimado').getByText('$2.890')).toBeTruthy();
    });

    it('ofrece confirmar y cambiar la cantidad', async () => {
      const { usuario, onCambiarCantidad, confirmar } = mostrar();

      expect(confirmar()).toBeTruthy();
      await usuario.click(screen.getByRole('button', { name: 'Cambiar cantidad' }));

      expect(onCambiarCantidad).toHaveBeenCalledOnce();
      expect(fetchFalso).not.toHaveBeenCalled();
    });
  });

  describe('escenario feliz: confirma y se crea el pedido con medicamento, cantidad, total y estado', () => {
    it('envía solo el código y la cantidad (nunca el precio ni el total) a POST /api/pedidos', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar(2);

      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });

      expect(fetchFalso).toHaveBeenCalledOnce();
      expect(fetchFalso.mock.calls[0][0]).toBe('/api/pedidos');
      expect(fetchFalso.mock.calls[0][1].method).toBe('POST');
      expect(cuerpoDelPost()).toEqual({ codigo: 'MED-002', cantidad: 2 });
      // Sin esta cabecera el backend no lee el cuerpo y respondería que la cantidad no es válida
      expect(new Headers(fetchFalso.mock.calls[0][1].headers).get('Content-Type')).toMatch(/application\/json/);
    });

    it('muestra el número de pedido, el medicamento, la cantidad, el total y el estado «Solicitud creada»', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar, zona } = mostrar(2);

      await usuario.click(confirmar());

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(zona()).toBeTruthy();
      expect(fila('Número de pedido').getByText('P-7KQ4ZD')).toBeTruthy();
      expect(fila('Medicamento').getByText('Losartán 100 mg')).toBeTruthy();
      expect(fila('Cantidad').getByText('2 unidades')).toBeTruthy();
      expect(fila('Total').getByText('$5.780')).toBeTruthy();
      expect(fila('Estado').getByText('Solicitud creada')).toBeTruthy();
    });

    it('el total y el precio que se muestran son los que calculó el backend, no el estimado', async () => {
      // El precio cambió en el backoffice mientras la vecina decidía: el backend manda
      fetchFalso.mockReturnValue(responder(201, { pedido: { ...pedidoCreado, precioUnitario: 3000, total: 6000 } }));
      const { usuario, confirmar, zona } = mostrar(2);

      await usuario.click(confirmar());

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(fila('Total').getByText('$6.000')).toBeTruthy();
      expect(fila('Precio por unidad').getByText('$3.000')).toBeTruthy();
      expect(within(zona()).queryByText('$5.780')).toBeNull();
    });

    it('al terminar, lo anuncia en voz alta con el número de pedido (región de estado ya presente)', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar(2);
      const estados = screen.getAllByRole('status'); // la región existe antes de confirmar

      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });

      expect(estados.some((e) => e.textContent === 'Tu pedido fue creado. Número de pedido P-7KQ4ZD.')).toBe(true);
    });

    it('tras crear el pedido ya no se puede confirmar otra vez (no se duplica la compra)', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar(2);

      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });

      expect(screen.queryByRole('button', { name: /Confirmar pedido/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cambiar cantidad' })).toBeNull();
      expect(fetchFalso).toHaveBeenCalledOnce();
    });

    it('«Buscar otro medicamento» vuelve al buscador', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar, onNuevaBusqueda } = mostrar(2);
      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });

      await usuario.click(screen.getByRole('button', { name: 'Buscar otro medicamento' }));

      expect(onNuevaBusqueda).toHaveBeenCalledOnce();
    });

    it('mientras confirma lo dice, el botón no envía una segunda petición y no se pierde el foco', async () => {
      let terminar!: (r: Response) => void;
      fetchFalso.mockReturnValue(new Promise<Response>((r) => (terminar = r)));
      const { usuario, confirmar } = mostrar(2);
      const boton = confirmar();

      await usuario.click(boton);
      await usuario.click(boton);

      expect(boton.textContent).toMatch(/Confirmando/);
      expect(boton.getAttribute('aria-disabled')).toBe('true');
      expect((boton as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getAllByRole('status').some((s) => /Confirmando tu pedido/.test(s.textContent ?? ''))).toBe(true);
      expect(fetchFalso).toHaveBeenCalledOnce();
      terminar(new Response(JSON.stringify({ pedido: pedidoCreado }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
    });
  });

  describe('escenario de error: no hay stock suficiente, no se crea el pedido y se informa claramente', () => {
    it('muestra el mensaje del sistema, dice que no se creó ningún pedido y no muestra éxito', async () => {
      fetchFalso.mockReturnValue(responder(409, { motivo: 'sin_stock', mensaje: SIN_STOCK }));
      const { usuario, confirmar } = mostrar(2);

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toContain(SIN_STOCK);
      expect(screen.getByText('No se creó ningún pedido.')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Tu pedido fue creado' })).toBeNull();
      expect(screen.queryByText('Solicitud creada')).toBeNull();
    });

    it('si quedan menos unidades que las pedidas, muestra cuántas quedan', async () => {
      const mensaje = 'No tenemos stock suficiente para esa cantidad: queda 1 unidad. Prueba con una cantidad menor.';
      fetchFalso.mockReturnValue(responder(409, { motivo: 'sin_stock', mensaje }));
      const { usuario, confirmar } = mostrar(2);

      await usuario.click(confirmar());

      expect((await screen.findByRole('alert')).textContent).toContain(mensaje);
    });

    it('tras el rechazo solo ofrece volver a los resultados, que se refrescan para no mostrar stock viejo', async () => {
      fetchFalso.mockReturnValue(responder(409, { motivo: 'sin_stock', mensaje: SIN_STOCK }));
      const { usuario, confirmar, zona, onVolverAResultados, onCambiarCantidad } = mostrar(2);
      await usuario.click(confirmar());
      await screen.findByRole('alert');

      // Nada de confirmar de nuevo ni de cambiar la cantidad con el stock que ya quedó viejo
      expect(botones(zona())).toEqual(['Volver a los resultados']);
      expect(fetchFalso).toHaveBeenCalledOnce();

      // Explica por qué no se puede cambiar la cantidad aquí: hay que ver cómo quedó el stock
      expect(screen.getByText(/ver cómo quedó el stock/)).toBeTruthy();

      await usuario.click(screen.getByRole('button', { name: 'Volver a los resultados' }));
      expect(onVolverAResultados).toHaveBeenCalledOnce(); // y la búsqueda se refresca
      expect(onCambiarCantidad).not.toHaveBeenCalled();
    });

    it.each([
      ['el medicamento ya no existe', 404, 'no_existe', 'No encontramos ese medicamento. Vuelve a buscarlo, por favor.'],
      ['la cantidad no es válida', 400, 'cantidad_invalida', 'Elige una cantidad entre 1 y 20 unidades.'],
    ])('si %s, muestra el mensaje del sistema, no crea el pedido y deja volver a los resultados', async (_caso, status, motivo, mensaje) => {
      fetchFalso.mockReturnValue(responder(status, { motivo, mensaje }));
      const { usuario, confirmar, zona, onVolverAResultados } = mostrar(2);

      await usuario.click(confirmar());

      expect((await screen.findByRole('alert')).textContent).toContain(mensaje);
      expect(screen.queryByRole('heading', { name: 'Tu pedido fue creado' })).toBeNull();
      expect(botones(zona())).toEqual(['Volver a los resultados']);
      await usuario.click(screen.getByRole('button', { name: 'Volver a los resultados' }));
      expect(onVolverAResultados).toHaveBeenCalledOnce();
    });

    it('si falla la conexión, avisa que quizá el pedido sí se creó, sin códigos, y deja intentar de nuevo', async () => {
      fetchFalso.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
      const { usuario, confirmar, zona } = mostrar(2);

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/conectarnos/);
      expect(alerta.textContent).toMatch(/no sabemos si tu pedido se creó/);
      expect(alerta.textContent).toMatch(/consulta primero en la farmacia/);
      expect(alerta.textContent).not.toMatch(/TypeError|fetch/i);
      expect(botones(zona())).toEqual(['Intentar de nuevo', 'Cambiar cantidad']);

      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      await usuario.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(fetchFalso).toHaveBeenCalledTimes(2);
      expect(JSON.parse(String(fetchFalso.mock.calls[1][1].body))).toEqual({ codigo: 'MED-002', cantidad: 2 });
    });

    it('«Intentar de nuevo» también está protegido contra el doble clic: no crea dos pedidos', async () => {
      fetchFalso.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')));
      const { usuario, confirmar } = mostrar(2);
      await usuario.click(confirmar());
      await screen.findByRole('alert');

      let terminar!: (r: Response) => void;
      fetchFalso.mockReturnValue(new Promise<Response>((r) => (terminar = r)));
      const reintentar = screen.getByRole('button', { name: 'Intentar de nuevo' });
      await usuario.click(reintentar);
      await usuario.click(reintentar);

      expect(fetchFalso).toHaveBeenCalledTimes(2); // el primer intento y un solo reintento
      terminar(new Response(JSON.stringify({ pedido: pedidoCreado }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
    });

    it('si el servidor falla (500), no muestra códigos ni textos técnicos y deja intentar de nuevo', async () => {
      fetchFalso.mockReturnValue(responder(500, { motivo: 'error_interno', mensaje: 'SQLITE_BUSY' }));
      const { usuario, confirmar, zona } = mostrar(2);

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/problema/);
      expect(alerta.textContent).not.toMatch(/500|SQLITE|interno/i);
      expect(botones(zona())).toEqual(['Intentar de nuevo', 'Cambiar cantidad']);
    });

    it.each([
      ['sin pedido', { }],
      ['con un total que no es un número', { pedido: { ...pedidoCreado, total: 'mucho' } }],
      ['sin número de pedido', { pedido: { ...pedidoCreado, numeroPedido: undefined } }],
    ])('un 201 %s no muestra «$NaN» ni «undefined» y NO ofrece reintentar (el pedido pudo crearse)', async (_caso, cuerpo) => {
      fetchFalso.mockReturnValue(responder(201, cuerpo));
      const { usuario, confirmar, zona } = mostrar(2);

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/es posible que se haya creado/);
      expect(alerta.textContent).toMatch(/consúltalo en la farmacia/);
      expect(zona().textContent).not.toMatch(/NaN|undefined|mucho/);
      expect(screen.queryByRole('heading', { name: 'Tu pedido fue creado' })).toBeNull();
      // Reintentar crearía un segundo pedido: solo se puede salir
      expect(botones(zona())).toEqual(['Buscar otro medicamento']);
      expect(fetchFalso).toHaveBeenCalledOnce();
    });

    it('un 201 que no es JSON (por ejemplo, una página del proxy) se trata igual: sin reintentar', async () => {
      fetchFalso.mockReturnValue(Promise.resolve(new Response('<html>Bad gateway</html>', { status: 201 })));
      const { usuario, confirmar, zona } = mostrar(2);

      await usuario.click(confirmar());

      expect((await screen.findByRole('alert')).textContent).toMatch(/es posible que se haya creado/);
      expect(botones(zona())).toEqual(['Buscar otro medicamento']);
    });
  });

  describe('mientras se confirma', () => {
    it('avisa que está ocupada (para que el buscador no se mueva) y no deja cambiar la cantidad', async () => {
      let terminar!: (r: Response) => void;
      fetchFalso.mockReturnValue(new Promise<Response>((r) => (terminar = r)));
      const { usuario, confirmar, onOcupado, onCambiarCantidad } = mostrar(2);

      await usuario.click(confirmar());

      expect(onOcupado).toHaveBeenLastCalledWith(true);
      const cambiar = screen.getByRole('button', { name: 'Cambiar cantidad' });
      expect(cambiar.getAttribute('aria-disabled')).toBe('true');
      await usuario.click(cambiar);
      expect(onCambiarCantidad).not.toHaveBeenCalled();

      terminar(new Response(JSON.stringify({ pedido: pedidoCreado }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(onOcupado).toHaveBeenLastCalledWith(false);
    });
  });

  describe('uso solo con teclado', () => {
    it('Enter sobre «Confirmar pedido» confirma y el foco pasa al resultado', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar, zona } = mostrar(2);

      confirmar().focus();
      await usuario.keyboard('{Enter}');

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      await waitFor(() => expect(document.activeElement).toBe(zona()));
    });

    it('el foco también va al resultado cuando se rechaza el pedido', async () => {
      fetchFalso.mockReturnValue(responder(409, { motivo: 'sin_stock', mensaje: SIN_STOCK }));
      const { usuario, confirmar, zona } = mostrar(2);

      await usuario.click(confirmar());
      await screen.findByRole('alert');

      await waitFor(() => expect(document.activeElement).toBe(zona()));
    });

    it('en el resumen, Tab recorre «Confirmar pedido» y «Cambiar cantidad»', async () => {
      const { usuario, confirmar } = mostrar(2);

      await usuario.tab();
      expect(document.activeElement).toBe(confirmar());
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cambiar cantidad' }));
    });
  });
});
