import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Buscador from './Buscador';

// #8 Pantalla de búsqueda y #9 Casos sin resultado y sin stock (US-02, #1).
// El backend se simula con un fetch falso que responde como GET /api/medicamentos?q=.
const losartan50 = {
  codigo: 'MED-001',
  nombre: 'Losartán 50 mg',
  principioActivo: 'Losartán potásico',
  presentacion: 'Caja 30 comprimidos',
  precioUnitario: 1990,
  stock: 120,
  disponible: true,
};
const losartan100 = { ...losartan50, codigo: 'MED-002', nombre: 'Losartán 100 mg', precioUnitario: 2890, stock: 45 };
const fluoxetina = {
  codigo: 'MED-014',
  nombre: 'Fluoxetina 20 mg',
  principioActivo: 'Fluoxetina clorhidrato',
  presentacion: 'Caja 30 cápsulas',
  precioUnitario: 1890,
  stock: 0,
  disponible: false,
};
const MENSAJE_VACIO = 'No encontramos ese medicamento. Revisa cómo está escrito o prueba buscando por su principio activo.';

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
  const usuario = userEvent.setup();
  render(<Buscador />);
  const campo = () => screen.getByRole('searchbox', { name: 'Nombre o principio activo' });
  // Escribe y presiona Enter, como lo haría la vecina con el teclado.
  const buscar = async (texto: string) => {
    await usuario.clear(campo());
    await usuario.type(campo(), `${texto}{Enter}`);
  };
  return { usuario, campo, buscar };
}

const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre });

describe('Buscador', () => {
  describe('#8 escenario feliz: tarjetas con los cuatro datos', () => {
    it('muestra nombre oficial con dosificación, principio activo, precio y disponibilidad', async () => {
      fetchFalso.mockReturnValue(responder(200, { resultados: [losartan100, losartan50] }));
      const { buscar } = mostrar();

      await buscar('Losartán');

      const t = await screen.findByRole('article', { name: 'Losartán 50 mg' });
      expect(within(t).getByRole('heading', { name: 'Losartán 50 mg' })).toBeTruthy();
      expect(within(t).getByText('Losartán potásico')).toBeTruthy();
      expect(within(t).getByText('Caja 30 comprimidos')).toBeTruthy();
      expect(within(t).getByText('$1.990')).toBeTruthy();
      expect(within(t).getByText('Disponible')).toBeTruthy();
      expect(within(t).getByRole('button', { name: /Elegir cantidad/ })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Encontramos 2 medicamentos.');
    });

    it('envía lo escrito al backend sin espacios sobrantes y bien codificado', async () => {
      fetchFalso.mockReturnValue(responder(200, { resultados: [losartan50] }));
      const { buscar } = mostrar();

      await buscar('  Losartán 50 ');

      expect(fetchFalso).toHaveBeenCalledWith('/api/medicamentos?q=Losart%C3%A1n%2050', expect.anything());
    });

    it('mientras espera muestra «Buscando…»', async () => {
      let terminar!: (r: Response) => void;
      fetchFalso.mockReturnValue(new Promise<Response>((r) => (terminar = r)));
      const { buscar } = mostrar();

      await buscar('Losartán');
      expect(screen.getByRole('status').textContent).toBe('Buscando…');

      terminar(new Response(JSON.stringify({ resultados: [losartan50] }), { status: 200 }));
      expect(await screen.findByText('Encontramos 1 medicamento.')).toBeTruthy();
    });
  });

  describe('#9 sin coincidencias', () => {
    it('informa claramente que no encontró el medicamento, en vez de una pantalla vacía', async () => {
      fetchFalso.mockReturnValue(responder(200, { resultados: [], mensaje: MENSAJE_VACIO }));
      const { buscar } = mostrar();

      await buscar('Remedioquenoexiste');

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toBe(MENSAJE_VACIO);
      expect(screen.queryByRole('list', { name: 'Resultados de la búsqueda' })).toBeNull();
    });
  });

  describe('#9 sin stock', () => {
    it('muestra la etiqueta visible «Sin stock» y no ofrece comprar', async () => {
      fetchFalso.mockReturnValue(responder(200, { resultados: [fluoxetina] }));
      const { buscar } = mostrar();

      await buscar('Fluoxetina');

      const t = await screen.findByRole('article', { name: 'Fluoxetina 20 mg' });
      expect(within(t).getByText('Sin stock')).toBeTruthy();
      expect(within(t).getByText('$1.890')).toBeTruthy();
      expect(within(t).queryByRole('button')).toBeNull();
      expect(within(t).queryByText('Disponible')).toBeNull();
    });

    it('en una lista mixta, solo los disponibles tienen botón de compra', async () => {
      fetchFalso.mockReturnValue(responder(200, { resultados: [fluoxetina, losartan50] }));
      const { buscar } = mostrar();

      await buscar('mg');

      await screen.findByRole('article', { name: 'Fluoxetina 20 mg' });
      expect(screen.getAllByRole('button', { name: /Elegir cantidad/ })).toHaveLength(1);
      expect(within(tarjeta('Losartán 50 mg')).getByRole('button', { name: /Elegir cantidad/ })).toBeTruthy();
    });
  });

  describe('errores', () => {
    it('muestra el mensaje del backend cuando la búsqueda es muy corta', async () => {
      const mensaje = 'Escribe al menos 2 letras del nombre o del principio activo del medicamento.';
      fetchFalso.mockReturnValue(responder(400, { motivo: 'busqueda_muy_corta', mensaje }));
      const { buscar, campo } = mostrar();

      await buscar('l');

      expect((await screen.findByRole('alert')).textContent).toBe(mensaje);
      expect(document.activeElement).toBe(campo());
    });

    it('sin conexión da un mensaje cálido, sin códigos de error', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'));
      const { buscar } = mostrar();

      await buscar('Losartán');

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/No pudimos conectarnos con la farmacia/);
      expect(alerta.textContent).not.toMatch(/fetch|error|\d{3}/i);
    });

    it('un fallo del servidor (500) no muestra textos técnicos', async () => {
      fetchFalso.mockReturnValue(responder(500, { motivo: 'error_interno', mensaje: 'detalle interno' }));
      const { buscar } = mostrar();

      await buscar('Losartán');

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(/Tuvimos un problema al buscar/);
      expect(alerta.textContent).not.toMatch(/500|interno/);
    });
  });

  describe('elegir un medicamento disponible (abre el selector de #17)', () => {
    it('solo con teclado: Tab hasta «Elegir cantidad», Enter abre el selector y «Volver» regresa a la misma tarjeta', async () => {
      fetchFalso.mockReturnValue(responder(200, { resultados: [losartan50] }));
      const { usuario, buscar } = mostrar();

      await buscar('Losartán');
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await usuario.tab(); // del campo al botón «Buscar»
      await usuario.tab(); // a «Elegir cantidad»
      expect(document.activeElement?.textContent).toBe('Elegir cantidad');
      await usuario.keyboard('{Enter}');

      const zona = screen.getByLabelText('Elegir cantidad de Losartán 50 mg');
      expect(document.activeElement).toBe(zona);
      expect(within(zona).getByRole('spinbutton', { name: 'Cantidad' })).toBeTruthy();
      expect(screen.queryByRole('list', { name: 'Resultados de la búsqueda' })).toBeNull();

      await usuario.click(screen.getByRole('button', { name: /Volver a los resultados/ }));

      const boton = within(tarjeta('Losartán 50 mg')).getByRole('button', { name: /Elegir cantidad/ });
      expect(document.activeElement).toBe(boton);
    });

  });

  // #18 Pantalla de confirmación (US-15): búsqueda → cantidad → resumen → confirmar → pedido.
  describe('#18 confirmar el pedido (de punta a punta con la búsqueda)', () => {
    const pedido = {
      numeroPedido: 'P-7KQ4ZD',
      medicamento: 'Losartán 50 mg',
      cantidad: 2,
      precioUnitario: 1990,
      total: 3980,
      estado: 'Solicitud creada',
      fechaCreacion: '2026-10-01T15:04:05.000Z',
    };
    const SIN_STOCK = 'Este medicamento ya no tiene stock disponible.';

    // Responde la búsqueda (GET) en orden y el pedido (POST) con lo que se indique.
    function simular({
      busquedas = [[losartan50]],
      pedido: respuestaPedido = () => responder(201, { pedido }),
    }: { busquedas?: unknown[][]; pedido?: () => Promise<Response> } = {}) {
      let n = 0;
      fetchFalso.mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return respuestaPedido();
        const lista = busquedas[Math.min(n, busquedas.length - 1)];
        n += 1;
        return responder(200, { resultados: lista });
      });
    }
    const posts = () => fetchFalso.mock.calls.filter(([, init]) => init?.method === 'POST');
    const busquedasHechas = () => fetchFalso.mock.calls.filter(([, init]) => init?.method !== 'POST');

    // Busca «Losartán», elige el medicamento, sube a 2 unidades y continúa.
    async function llegarAlResumen(usuario: ReturnType<typeof userEvent.setup>, buscar: (t: string) => Promise<void>) {
      await buscar('Losartán');
      await usuario.click(await screen.findByRole('button', { name: /Elegir cantidad/ }));
      await usuario.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
      await usuario.click(screen.getByRole('button', { name: 'Continuar con el pedido' }));
    }

    it('«Continuar con el pedido» abre el resumen con la cantidad elegida y lleva el foco a la confirmación', async () => {
      simular();
      const { usuario, buscar } = mostrar();

      await llegarAlResumen(usuario, buscar);

      const zona = screen.getByRole('region', { name: 'Confirmar pedido de Losartán 50 mg' });
      expect(document.activeElement).toBe(zona);
      expect(within(zona).getByText('2 unidades')).toBeTruthy();
      expect(within(zona).getByText('$3.980')).toBeTruthy(); // total estimado: 2 × $1.990
      expect(posts()).toHaveLength(0); // nada se compra hasta confirmar
      expect(screen.queryByText(/muy pronto/)).toBeNull();
      // El selector desaparece: no conviven dos totales ni dos «Continuar»
      expect(screen.queryByRole('spinbutton')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Continuar con el pedido' })).toBeNull();
    });

    it('mientras se confirma, el buscador no se mueve: una búsqueda nueva no hace perder el pedido', async () => {
      let terminar!: (r: Response) => void;
      simular({ pedido: () => new Promise<Response>((r) => (terminar = r)) });
      const { usuario, buscar, campo } = mostrar();
      await llegarAlResumen(usuario, buscar);
      await usuario.click(screen.getByRole('button', { name: /Confirmar pedido/ }));
      const antes = busquedasHechas().length;

      await usuario.type(campo(), '{Enter}');
      await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

      expect(busquedasHechas()).toHaveLength(antes); // no se pidió ninguna búsqueda
      expect(screen.getByRole('region', { name: 'Confirmar pedido de Losartán 50 mg' })).toBeTruthy();
      terminar(new Response(JSON.stringify({ pedido }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
      expect(await screen.findByRole('heading', { name: 'Tu pedido fue creado' })).toBeTruthy();

      // Terminada la confirmación, buscar vuelve a funcionar
      await buscar('Losartán');
      expect(await screen.findByRole('article', { name: 'Losartán 50 mg' })).toBeTruthy();
    });

    it('escenario feliz: confirma y ve el pedido con número, total y estado; envía solo código y cantidad', async () => {
      simular();
      const { usuario, buscar } = mostrar();
      await llegarAlResumen(usuario, buscar);

      await usuario.click(screen.getByRole('button', { name: /Confirmar pedido/ }));

      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });
      expect(posts()).toHaveLength(1);
      expect(JSON.parse(String(posts()[0][1].body))).toEqual({ codigo: 'MED-001', cantidad: 2 });
      expect(new Headers(posts()[0][1].headers).get('Content-Type')).toMatch(/application\/json/);
      expect(screen.getByText('P-7KQ4ZD')).toBeTruthy();
      expect(screen.getByText('Solicitud creada')).toBeTruthy();
      expect(screen.getAllByText('$3.980').length).toBeGreaterThan(0);
    });

    it('«Buscar otro medicamento» deja el buscador limpio y con el foco en el campo', async () => {
      simular();
      const { usuario, buscar, campo } = mostrar();
      await llegarAlResumen(usuario, buscar);
      await usuario.click(screen.getByRole('button', { name: /Confirmar pedido/ }));
      await screen.findByRole('heading', { name: 'Tu pedido fue creado' });

      await usuario.click(screen.getByRole('button', { name: 'Buscar otro medicamento' }));

      expect(screen.queryByRole('heading', { name: 'Tu pedido fue creado' })).toBeNull();
      expect(screen.queryByRole('article')).toBeNull();
      expect((campo() as HTMLInputElement).value).toBe('');
      expect(document.activeElement).toBe(campo());
    });

    it('escenario de error: sin stock al confirmar no crea el pedido y «Volver a los resultados» refresca la búsqueda', async () => {
      simular({
        busquedas: [[losartan50], [{ ...losartan50, stock: 0, disponible: false }]],
        pedido: () => responder(409, { motivo: 'sin_stock', mensaje: SIN_STOCK }),
      });
      const { usuario, buscar } = mostrar();
      await llegarAlResumen(usuario, buscar);

      await usuario.click(screen.getByRole('button', { name: /Confirmar pedido/ }));

      expect((await screen.findByRole('alert')).textContent).toContain(SIN_STOCK);
      expect(screen.queryByRole('heading', { name: 'Tu pedido fue creado' })).toBeNull();

      await usuario.click(screen.getByRole('button', { name: 'Volver a los resultados' }));

      // La lista se vuelve a pedir: ya no muestra stock viejo
      const t = await screen.findByRole('article', { name: 'Losartán 50 mg' });
      expect(within(t).getByText('Sin stock')).toBeTruthy();
      expect(within(t).queryByRole('button', { name: /Elegir cantidad/ })).toBeNull();
      expect(busquedasHechas()).toHaveLength(2);
    });

    it('«Cambiar cantidad» en el resumen vuelve al selector del mismo medicamento sin comprar nada', async () => {
      simular();
      const { usuario, buscar } = mostrar();
      await llegarAlResumen(usuario, buscar);

      await usuario.click(screen.getByRole('button', { name: 'Cambiar cantidad' }));

      const zona = screen.getByLabelText('Elegir cantidad de Losartán 50 mg');
      expect(document.activeElement).toBe(zona);
      expect(within(zona).getByRole('spinbutton', { name: 'Cantidad' })).toBeTruthy();
      expect(screen.queryByRole('region', { name: /Confirmar pedido/ })).toBeNull();
      expect(posts()).toHaveLength(0);
    });

    it('una búsqueda nueva descarta la confirmación en pantalla', async () => {
      simular({ busquedas: [[losartan50], [losartan100]] });
      const { usuario, buscar } = mostrar();
      await llegarAlResumen(usuario, buscar);

      await buscar('Losartán 100');

      expect(screen.queryByRole('region', { name: /Confirmar pedido/ })).toBeNull();
      expect(await screen.findByRole('article', { name: 'Losartán 100 mg' })).toBeTruthy();
    });

    it('todo el ciclo solo con teclado: buscar, elegir, cantidad, continuar y confirmar con Enter', async () => {
      simular();
      const { usuario, buscar } = mostrar();

      await buscar('Losartán');
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await usuario.tab(); // «Buscar»
      await usuario.tab(); // «Elegir cantidad»
      await usuario.keyboard('{Enter}');
      // Tab por «Volver», «−», el campo y «+» hasta «Continuar con el pedido»
      const continuar = screen.getByRole('button', { name: 'Continuar con el pedido' });
      for (let i = 0; i < 6 && document.activeElement !== continuar; i++) await usuario.tab();
      expect(document.activeElement).toBe(continuar);
      await usuario.keyboard('{Enter}');

      const zona = screen.getByRole('region', { name: 'Confirmar pedido de Losartán 50 mg' });
      expect(document.activeElement).toBe(zona);
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Confirmar pedido/ }));
      await usuario.keyboard('{Enter}');

      expect(await screen.findByRole('heading', { name: 'Tu pedido fue creado' })).toBeTruthy();
    });
  });
});
