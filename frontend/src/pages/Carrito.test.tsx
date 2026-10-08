import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CarritoProvider } from '../lib/carrito';
import Carrito from './Carrito';

// US-16 Carrito (#42): la vecina revisa su carrito, ajusta cantidades y confirma UN pedido. El backend se
// simula con un fetch falso que responde como POST /api/pedidos con { items } (MODELO_DE_DATOS.md §3).
// El precio y el total reales los calcula el backend: la pantalla solo muestra un total estimado.
const CLAVE = 'farmacia.carrito';
const losartan = { codigo: 'MED-001', nombre: 'Losartán 50 mg', precioUnitario: 1990, cantidad: 2 };
const amlodipino = { codigo: 'MED-003', nombre: 'Amlodipino 5 mg', precioUnitario: 1490, cantidad: 1 };

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
const MENSAJE_SIN_STOCK =
  'No tenemos stock suficiente de «Amlodipino 5 mg»: quedan 1 unidad. No se creó ningún pedido; ajusta la cantidad e inténtalo de nuevo.';

const responder = (status: number, cuerpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }));

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mostrar(items: object[] = [losartan, amlodipino]) {
  window.localStorage.setItem(CLAVE, JSON.stringify(items));
  const usuario = userEvent.setup();
  render(
    <MemoryRouter>
      <CarritoProvider>
        <Carrito />
      </CarritoProvider>
    </MemoryRouter>,
  );
  return {
    usuario,
    confirmar: () => screen.getByRole('button', { name: /Confirmar pedido|Confirmando|Intentar de nuevo/ }),
    fila: (nombre: string) => within(screen.getByRole('heading', { name: nombre }).closest('li') as HTMLElement),
  };
}

const guardado = () => JSON.parse(window.localStorage.getItem(CLAVE) ?? '[]');
const cuerpoDelPost = () => JSON.parse(String(fetchFalso.mock.calls[0][1].body));
const fila = (etiqueta: string) => within(screen.getByText(etiqueta).closest('div') as HTMLElement);

describe('Carrito', () => {
  describe('carrito vacío', () => {
    it('lo dice con claridad y ofrece volver a buscar, sin botón de confirmar', () => {
      mostrar([]);

      expect(screen.getByRole('heading', { level: 1, name: 'Mi carrito' })).toBeTruthy();
      expect(screen.getByText('Tu carrito está vacío.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Buscar medicamento' }).getAttribute('href')).toBe('/');
      expect(screen.queryByRole('button', { name: /Confirmar pedido/ })).toBeNull();
    });
  });

  describe('revisión del carrito antes de confirmar', () => {
    it('al abrir la pantalla no se roba el foco (Layout lo lleva al contenido)', () => {
      mostrar();
      expect(document.activeElement).toBe(document.body);
    });

    it('lista cada medicamento con su precio, cantidad y subtotal estimado, y el total estimado', () => {
      const { fila } = mostrar();

      expect(screen.getByRole('list', { name: 'Medicamentos en tu carrito' })).toBeTruthy();
      expect(fila('Losartán 50 mg').getByText('Precio por unidad: $1.990')).toBeTruthy();
      expect(fila('Losartán 50 mg').getByText('Subtotal estimado: $3.980')).toBeTruthy();
      expect((fila('Losartán 50 mg').getByRole('spinbutton') as HTMLInputElement).value).toBe('2');
      expect(fila('Amlodipino 5 mg').getByText('Subtotal estimado: $1.490')).toBeTruthy();
      expect(screen.getByText('Total estimado: $5.470')).toBeTruthy();
      expect(screen.getByText(/El total final lo confirma la farmacia/)).toBeTruthy();
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it('los botones « + » y « − » cambian la cantidad y recalculan los totales estimados', async () => {
      const { usuario, fila } = mostrar();

      await usuario.click(fila('Amlodipino 5 mg').getByRole('button', { name: 'Aumentar cantidad de Amlodipino 5 mg' }));
      expect(fila('Amlodipino 5 mg').getByText('Subtotal estimado: $2.980')).toBeTruthy();
      expect(screen.getByText('Total estimado: $6.960')).toBeTruthy();

      await usuario.click(fila('Losartán 50 mg').getByRole('button', { name: 'Disminuir cantidad de Losartán 50 mg' }));
      expect(screen.getByText('Total estimado: $4.970')).toBeTruthy();
      expect(guardado().map((i: { cantidad: number }) => i.cantidad)).toEqual([1, 2]);
    });

    it('en 1 y en 20 el botón se ve apagado pero conserva el foco del teclado', async () => {
      const { usuario, fila } = mostrar([{ ...losartan, cantidad: 1 }]);
      const menos = fila('Losartán 50 mg').getByRole('button', { name: 'Disminuir cantidad de Losartán 50 mg' });

      expect(menos.getAttribute('aria-disabled')).toBe('true');
      menos.focus();
      await usuario.keyboard('{Enter}');
      expect(document.activeElement).toBe(menos);
      expect((fila('Losartán 50 mg').getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
    });

    it('escribir una cantidad válida la aplica; una inválida avisa y al salir vuelve a la última válida', async () => {
      const { usuario, fila } = mostrar([losartan]);
      const campo = fila('Losartán 50 mg').getByRole('spinbutton') as HTMLInputElement;

      await usuario.clear(campo);
      await usuario.type(campo, '5');
      expect(screen.getByText('Total estimado: $9.950')).toBeTruthy();

      await usuario.clear(campo);
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('alert').textContent).toBe('Elige una cantidad entre 1 y 20.');
      expect(screen.getByText('Total estimado: $9.950')).toBeTruthy();

      // «2» ya es válido y se aplica; «25» pasa del máximo y se marca como inválido.
      await usuario.type(campo, '25');
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Total estimado: $3.980')).toBeTruthy();

      // Al salir del campo vuelve a la última cantidad válida: lo que se ve es lo que se pedirá.
      await usuario.tab();
      expect(campo.value).toBe('2');
      expect(campo.getAttribute('aria-invalid')).toBe('false');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('«Quitar» saca solo ese medicamento, lo anuncia y deja el foco dentro del carrito', async () => {
      const { usuario } = mostrar();

      await usuario.click(screen.getByRole('button', { name: 'Quitar Losartán 50 mg del carrito' }));

      expect(screen.queryByRole('heading', { name: 'Losartán 50 mg' })).toBeNull();
      expect(screen.getByRole('heading', { name: 'Amlodipino 5 mg' })).toBeTruthy();
      expect(screen.getByText('Total estimado: $1.490')).toBeTruthy();
      expect(screen.getByText('Quitaste Losartán 50 mg de tu carrito.')).toBeTruthy();
      expect(guardado().map((i: { codigo: string }) => i.codigo)).toEqual(['MED-003']);
      expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Mi carrito' }));
    });

    it('al quitar el último medicamento queda el carrito vacío', async () => {
      const { usuario } = mostrar([losartan]);
      await usuario.click(screen.getByRole('button', { name: 'Quitar Losartán 50 mg del carrito' }));
      expect(screen.getByText('Tu carrito está vacío.')).toBeTruthy();
    });
  });

  describe('escenario feliz: confirma y se crea UN pedido con todos los medicamentos', () => {
    it('envía solo códigos y cantidades (nunca precios ni totales) a POST /api/pedidos', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(fetchFalso).toHaveBeenCalledOnce();
      expect(fetchFalso.mock.calls[0][0]).toBe('/api/pedidos');
      expect(fetchFalso.mock.calls[0][1].method).toBe('POST');
      expect(cuerpoDelPost()).toEqual({
        items: [
          { codigo: 'MED-001', cantidad: 2 },
          { codigo: 'MED-003', cantidad: 1 },
        ],
      });
    });

    it('muestra el pedido que calculó el backend: número, cada medicamento con su subtotal, total y estado', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(fila('Número de pedido').getByText('P-7KQ4ZD')).toBeTruthy();
      expect(fila('Estado').getByText('Solicitud creada')).toBeTruthy();
      const detalle = within(screen.getByRole('list', { name: 'Medicamentos de tu pedido' }));
      expect(detalle.getByText('Losartán 50 mg')).toBeTruthy();
      expect(detalle.getByText('2 unidades × $1.990 = $3.980')).toBeTruthy();
      expect(detalle.getByText('Amlodipino 5 mg')).toBeTruthy();
      expect(detalle.getByText('1 unidad × $1.490 = $1.490')).toBeTruthy();
      expect(screen.getByText('Total: $5.470')).toBeTruthy();
      expect(screen.getByText('Anota tu número de pedido.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Buscar otro medicamento' }).getAttribute('href')).toBe('/');
    });

    it('si el precio real es distinto al que vio al agregar, lo avisa con el antes y el ahora', async () => {
      fetchFalso.mockReturnValue(
        responder(201, {
          pedido: {
            ...pedidoCreado,
            items: [
              { ...pedidoCreado.items[0], precioUnitario: 2100, subtotal: 4200 },
              pedidoCreado.items[1],
            ],
            total: 5690,
          },
        }),
      );
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      const aviso = screen.getByRole('note');
      expect(aviso.textContent).toContain('El precio cambió desde que agregaste tus medicamentos');
      expect(aviso.textContent).toContain('Losartán 50 mg: ahora $2.100 por unidad (antes $1.990).');
      expect(aviso.textContent).not.toContain('Amlodipino');
      expect(screen.getByText('Total: $5.690')).toBeTruthy();
    });

    it('si los precios no cambiaron, no muestra ningún aviso de precio', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(screen.queryByRole('note')).toBeNull();
    });

    it('vacía el carrito, anuncia el número de pedido y lleva el foco al resultado', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(guardado()).toEqual([]);
      expect(screen.getByRole('status').textContent).toBe('Tu pedido fue creado. Número de pedido P-7KQ4ZD.');
      expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Tu pedido fue creado' }));
      expect(screen.queryByRole('button', { name: /Confirmar pedido/ })).toBeNull();
    });

    it('mientras confirma se ve «Confirmando…» y un segundo clic NO envía otro pedido', async () => {
      let terminar: (r: Response) => void = () => {};
      fetchFalso.mockReturnValue(new Promise<Response>((resolver) => (terminar = resolver)));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());
      const boton = screen.getByRole('button', { name: 'Confirmando…' });
      expect(boton.getAttribute('aria-disabled')).toBe('true');
      await usuario.click(boton);
      await usuario.keyboard('{Enter}');
      expect(fetchFalso).toHaveBeenCalledOnce();

      terminar(new Response(JSON.stringify({ pedido: pedidoCreado }), { status: 201 }));
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(fetchFalso).toHaveBeenCalledOnce();
    });

    it('un clic tardío justo después de llegar la respuesta (antes de que se dibuje el resultado) NO crea otro pedido', async () => {
      // La respuesta llega, la pantalla ya la procesó, pero React todavía no quitó el botón: ahí cae un doble clic lento.
      const respuesta = new Response(JSON.stringify({ pedido: pedidoCreado }), { status: 201 });
      const leer = respuesta.json.bind(respuesta);
      respuesta.json = async () => {
        const cuerpo = await leer();
        let turno: Promise<void> = Promise.resolve();
        for (let i = 0; i < 8; i++) turno = turno.then(() => {});
        void turno.then(() => boton.click());
        return cuerpo;
      };
      fetchFalso.mockReturnValue(Promise.resolve(respuesta));
      const { usuario, confirmar } = mostrar();
      const boton = confirmar();

      await usuario.click(boton);

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(fetchFalso).toHaveBeenCalledOnce();
    });

    it('mientras confirma no se puede cambiar el carrito', async () => {
      fetchFalso.mockReturnValue(new Promise<Response>(() => {}));
      const { usuario, confirmar, fila } = mostrar();

      await usuario.click(confirmar());
      await usuario.click(fila('Losartán 50 mg').getByRole('button', { name: 'Aumentar cantidad de Losartán 50 mg' }));
      await usuario.click(screen.getByRole('button', { name: 'Quitar Amlodipino 5 mg del carrito' }));

      expect(screen.getByText('Total estimado: $5.470')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Amlodipino 5 mg' })).toBeTruthy();
    });
  });

  describe('escenario de error — sin stock: no se crea el pedido y se dice cuál medicamento falta', () => {
    const rechazoSinStock = {
      motivo: 'sin_stock',
      mensaje: MENSAJE_SIN_STOCK,
      faltantes: [{ codigo: 'MED-003', medicamento: 'Amlodipino 5 mg', stockDisponible: 1 }],
    };

    it('muestra el mensaje del backend, marca el medicamento que no alcanzó y avisa que no se creó ningún pedido', async () => {
      fetchFalso.mockReturnValue(responder(409, rechazoSinStock));
      const { usuario, confirmar, fila } = mostrar([losartan, { ...amlodipino, cantidad: 3 }]);

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toContain(MENSAJE_SIN_STOCK);
      expect(alerta.textContent).toContain('Tu carrito sigue igual');
      expect(fila('Amlodipino 5 mg').getByText('No alcanza: solo quedan 1 unidad. Baja la cantidad o quítalo.')).toBeTruthy();
      // El medicamento que sí alcanzaba no se marca
      expect(fila('Losartán 50 mg').queryByText(/No alcanza/)).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Tu pedido fue creado' })).toBeNull();
    });

    it('mantiene todo el carrito (cantidades incluidas) y deja volver a confirmar', async () => {
      fetchFalso.mockReturnValue(responder(409, rechazoSinStock));
      const { usuario, confirmar } = mostrar([losartan, { ...amlodipino, cantidad: 3 }]);

      await usuario.click(confirmar());
      await screen.findByRole('alert');

      expect(guardado().map((i: { codigo: string; cantidad: number }) => [i.codigo, i.cantidad])).toEqual([
        ['MED-001', 2],
        ['MED-003', 3],
      ]);
      expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Mi carrito' }));
      expect(confirmar()).toBeTruthy();
    });

    it('un medicamento agotado se explica distinto: sin stock, quítalo para continuar', async () => {
      fetchFalso.mockReturnValue(
        responder(409, {
          motivo: 'sin_stock',
          mensaje: '«Amlodipino 5 mg» ya no tiene stock disponible. No se creó ningún pedido; quítalo de tu carrito para continuar.',
          faltantes: [{ codigo: 'MED-003', medicamento: 'Amlodipino 5 mg', stockDisponible: 0 }],
        }),
      );
      const { usuario, confirmar, fila } = mostrar();

      await usuario.click(confirmar());

      await screen.findByRole('alert');
      expect(fila('Amlodipino 5 mg').getByText('Sin stock por ahora. Quítalo para poder continuar.')).toBeTruthy();
    });

    it('al ajustar el carrito desaparece la explicación vieja, y al reintentar se crea el pedido', async () => {
      fetchFalso.mockReturnValueOnce(responder(409, rechazoSinStock));
      const { usuario, confirmar, fila } = mostrar([losartan, { ...amlodipino, cantidad: 3 }]);

      await usuario.click(confirmar());
      await screen.findByRole('alert');

      await usuario.click(fila('Amlodipino 5 mg').getByRole('button', { name: 'Disminuir cantidad de Amlodipino 5 mg' }));
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByText(/No alcanza/)).toBeNull();

      fetchFalso.mockReturnValueOnce(responder(201, { pedido: pedidoCreado }));
      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(JSON.parse(String(fetchFalso.mock.calls[1][1].body)).items[1]).toEqual({ codigo: 'MED-003', cantidad: 2 });
    });

    it('al ajustar una cantidad tras el rechazo, el foco se queda en el botón que se usó', async () => {
      fetchFalso.mockReturnValue(responder(409, rechazoSinStock));
      const { usuario, confirmar, fila } = mostrar([losartan, { ...amlodipino, cantidad: 3 }]);

      await usuario.click(confirmar());
      await screen.findByRole('alert');

      const menos = fila('Amlodipino 5 mg').getByRole('button', { name: 'Disminuir cantidad de Amlodipino 5 mg' });
      menos.focus();
      await usuario.keyboard('{Enter}');

      expect(screen.queryByRole('alert')).toBeNull();
      expect(document.activeElement).toBe(menos);
    });

    it('si se quita el medicamento sin stock, el resto del carrito se puede confirmar', async () => {
      fetchFalso.mockReturnValueOnce(responder(409, rechazoSinStock));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());
      await screen.findByRole('alert');
      await usuario.click(screen.getByRole('button', { name: 'Quitar Amlodipino 5 mg del carrito' }));

      fetchFalso.mockReturnValueOnce(
        responder(201, { pedido: { ...pedidoCreado, items: [pedidoCreado.items[0]], total: 3980 } }),
      );
      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(JSON.parse(String(fetchFalso.mock.calls[1][1].body))).toEqual({ items: [{ codigo: 'MED-001', cantidad: 2 }] });
    });

    it('un medicamento que ya no está en el catálogo se marca en su fila, y quitándolo se puede confirmar el resto', async () => {
      fetchFalso.mockReturnValueOnce(
        responder(404, {
          motivo: 'no_existe',
          mensaje: 'Hay medicamentos de tu carrito que ya no están en el catálogo. Quítalos para continuar.',
          noDisponibles: [{ codigo: 'MED-003' }],
        }),
      );
      const { usuario, confirmar, fila } = mostrar();

      await usuario.click(confirmar());

      expect((await screen.findByRole('alert')).textContent).toContain('ya no están en el catálogo');
      expect(fila('Amlodipino 5 mg').getByText('Ya no está disponible en la farmacia. Quítalo para poder continuar.')).toBeTruthy();
      expect(fila('Losartán 50 mg').queryByText(/Ya no está disponible/)).toBeNull();
      expect(guardado()).toHaveLength(2);

      await usuario.click(screen.getByRole('button', { name: 'Quitar Amlodipino 5 mg del carrito' }));
      expect(screen.queryByText(/Ya no está disponible/)).toBeNull();
      fetchFalso.mockReturnValueOnce(
        responder(201, { pedido: { ...pedidoCreado, items: [pedidoCreado.items[0]], total: 3980 } }),
      );
      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
    });

    it('otros rechazos sin lista de medicamentos muestran su mensaje sin marcar nada', async () => {
      fetchFalso.mockReturnValue(
        responder(404, {
          motivo: 'no_existe',
          mensaje: 'Uno de los medicamentos de tu carrito ya no está en el catálogo. Revisa tu carrito, por favor.',
        }),
      );
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      expect((await screen.findByRole('alert')).textContent).toContain('ya no está en el catálogo');
      expect(screen.queryByText(/No alcanza/)).toBeNull();
      expect(guardado()).toHaveLength(2);
    });
  });

  describe('fallas de conexión y respuestas que no se pueden leer', () => {
    it('sin conexión avisa en español, conserva el carrito y ofrece «Intentar de nuevo»', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/No pudimos conectarnos con la farmacia/);
      expect(alerta.textContent).not.toMatch(/TypeError|Failed to fetch/);
      expect(guardado()).toHaveLength(2);
      expect(confirmar().textContent).toBe('Intentar de nuevo');

      fetchFalso.mockReturnValueOnce(responder(201, { pedido: pedidoCreado }));
      await usuario.click(confirmar());
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
    });

    it('un error del servidor (500) muestra un texto simple, nunca el código ni el detalle técnico', async () => {
      fetchFalso.mockReturnValue(responder(500, { motivo: 'error_interno', mensaje: 'SQLITE_BUSY: database is locked' }));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/Tuvimos un problema al crear tu pedido/);
      expect(alerta.textContent).not.toMatch(/SQLITE|error_interno|500/);
    });

    it.each([
      ['sin lista de ítems', { pedido: { numeroPedido: 'P-AAAAAA', total: 100, estado: 'Solicitud creada' } }],
      ['con la lista vacía', { pedido: { ...pedidoCreado, items: [] } }],
      ['sin número de pedido', { pedido: { ...pedidoCreado, numeroPedido: '' } }],
      ['sin cuerpo', {}],
    ])('si el 201 viene %s, avisa que el pedido pudo crearse, NO ofrece reintentar y muestra lo que se pedía', async (_caso, cuerpo) => {
      fetchFalso.mockReturnValue(responder(201, cuerpo));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/es posible que se haya creado/);
      expect(screen.getByRole('heading', { level: 1, name: 'No pudimos mostrarte tu pedido' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Confirmar pedido|Intentar de nuevo/ })).toBeNull();
      const pedido = within(screen.getByRole('list', { name: 'Lo que pedías' }));
      expect(pedido.getByText('Losartán 50 mg')).toBeTruthy();
      expect(pedido.getByText('2 unidades')).toBeTruthy();
      expect(pedido.getByText('Amlodipino 5 mg')).toBeTruthy();
      expect(pedido.getByText('1 unidad')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Buscar otro medicamento' })).toBeTruthy();
    });

    it('en ese caso el carrito se vacía: al volver a /carrito no se puede confirmar el mismo pedido otra vez', async () => {
      fetchFalso.mockReturnValue(responder(201, {}));
      const { usuario, confirmar } = mostrar();

      await usuario.click(confirmar());
      await screen.findByRole('alert');

      expect(guardado()).toEqual([]);
      cleanup();
      render(
        <MemoryRouter>
          <CarritoProvider>
            <Carrito />
          </CarritoProvider>
        </MemoryRouter>,
      );
      expect(screen.getByText('Tu carrito está vacío.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Confirmar pedido/ })).toBeNull();
      expect(fetchFalso).toHaveBeenCalledOnce();
    });
  });

  describe('uso solo con teclado', () => {
    it('Tab recorre cada medicamento (−, cantidad, +, Quitar) y termina en Confirmar pedido y Seguir buscando', async () => {
      const { usuario } = mostrar();

      const recorrido: string[] = [];
      for (let i = 0; i < 10; i++) {
        await usuario.tab();
        const activo = document.activeElement as HTMLElement;
        recorrido.push(activo.getAttribute('aria-label') ?? activo.textContent ?? '');
      }

      expect(recorrido).toEqual([
        'Disminuir cantidad de Losartán 50 mg',
        'Cantidad de Losartán 50 mg',
        'Aumentar cantidad de Losartán 50 mg',
        'Quitar Losartán 50 mg del carrito',
        'Disminuir cantidad de Amlodipino 5 mg',
        'Cantidad de Amlodipino 5 mg',
        'Aumentar cantidad de Amlodipino 5 mg',
        'Quitar Amlodipino 5 mg del carrito',
        'Confirmar pedido',
        'Seguir buscando',
      ]);
    });

    it('con Enter sobre «Confirmar pedido» se crea el pedido', async () => {
      fetchFalso.mockReturnValue(responder(201, { pedido: pedidoCreado }));
      const { usuario, confirmar } = mostrar();

      confirmar().focus();
      await usuario.keyboard('{Enter}');

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
    });
  });
});
