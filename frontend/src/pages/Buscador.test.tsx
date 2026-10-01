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

    it('continuar informa la cantidad elegida (la confirmación llega con #18)', async () => {
      fetchFalso.mockReturnValue(responder(200, { resultados: [losartan50] }));
      const { usuario, buscar } = mostrar();

      await buscar('Losartán');
      await usuario.click(await screen.findByRole('button', { name: /Elegir cantidad/ }));
      await usuario.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
      await usuario.click(screen.getByRole('button', { name: 'Continuar con el pedido' }));

      expect(screen.getByText(/Elegiste 2 unidades/)).toBeTruthy();
    });
  });
});
