import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Backoffice from './Backoffice';

// #13 Panel de mantención (US-13, #2). El backend se simula con un fetch falso que responde como
// GET y PUT /api/backoffice/medicamentos (MODELO_DE_DATOS.md §3). La clave es un token SIMULADO.
const CLAVE = 'clave-de-prueba';
const losartan50 = {
  codigo: 'MED-001',
  nombre: 'Losartán 50 mg',
  principioActivo: 'Losartán potásico',
  presentacion: 'Caja 30 comprimidos',
  precioUnitario: 1990,
  stock: 120,
  disponible: true,
  version: 0,
};
const amlodipino = {
  codigo: 'MED-003',
  nombre: 'Amlodipino 5 mg',
  principioActivo: 'Amlodipino besilato',
  presentacion: 'Caja 30 comprimidos',
  precioUnitario: 1490,
  stock: 80,
  disponible: true,
  version: 0,
};
const fluoxetina = {
  codigo: 'MED-014',
  nombre: 'Fluoxetina 20 mg',
  principioActivo: 'Fluoxetina clorhidrato',
  presentacion: 'Caja 30 cápsulas',
  precioUnitario: 1890,
  stock: 0,
  disponible: false,
  version: 0,
};
const MENSAJE_CLAVE = 'Necesitas la clave del equipo de la farmacia para entrar aquí.';
const MENSAJE_CONFLICTO = 'El stock cambió mientras editabas. Recarga e intenta de nuevo.';

const responder = (status: number, cuerpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }));

let fetchFalso: ReturnType<typeof vi.fn>;

// Responde GET (listado) y PUT (guardar) según lo que reciba cada prueba.
function simular({
  listas = [[losartan50, amlodipino, fluoxetina]],
  guardar = () => responder(500, {}),
}: {
  listas?: unknown[][];
  guardar?: (codigo: string, cuerpo: Record<string, unknown>) => Promise<Response>;
} = {}) {
  let n = 0;
  fetchFalso.mockImplementation((url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    if (metodo === 'PUT') {
      const codigo = url.split('/').pop() as string;
      return guardar(codigo, JSON.parse(String(init?.body)));
    }
    const lista = listas[Math.min(n, listas.length - 1)];
    n += 1;
    return responder(200, { medicamentos: lista });
  });
}

const llamadas = (metodo: 'GET' | 'PUT') =>
  fetchFalso.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === metodo);
const cuerpoDelPut = (n = 0) => JSON.parse(String(llamadas('PUT')[n][1].body));

beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mostrar() {
  const usuario = userEvent.setup();
  render(<Backoffice />);
  const campoClave = () => screen.getByLabelText('Clave del equipo');
  const entrar = async (clave = CLAVE) => {
    await usuario.type(campoClave(), `${clave}{Enter}`);
  };
  return { usuario, campoClave, entrar };
}

const fila = (nombre: string) => screen.getByRole('article', { name: nombre });
const precio = (nombre: string) => within(fila(nombre)).getByLabelText(/Precio/) as HTMLInputElement;
const stock = (nombre: string) => within(fila(nombre)).getByLabelText(/Stock/) as HTMLInputElement;
const guardar = (nombre: string) => within(fila(nombre)).getByRole('button', { name: /Guardar cambios/ });

async function escribir(usuario: ReturnType<typeof userEvent.setup>, campo: HTMLInputElement, texto: string) {
  await usuario.clear(campo);
  if (texto !== '') await usuario.type(campo, texto);
}

describe('Backoffice (panel de mantención)', () => {
  describe('ingreso con la clave simulada del equipo', () => {
    it('pide la clave y explica que es simulada, sin mostrar medicamentos todavía', () => {
      mostrar();

      expect(screen.getByRole('heading', { name: 'Backoffice de la farmacia' })).toBeTruthy();
      expect((screen.getByLabelText('Clave del equipo') as HTMLInputElement).type).toBe('password');
      expect(screen.getByText(/no es una autenticación real/i)).toBeTruthy();
      expect(screen.queryByRole('article')).toBeNull();
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it('con la clave correcta muestra el listado y envía la clave en el encabezado del backend', async () => {
      simular();
      const { entrar } = mostrar();

      await entrar();

      expect(await screen.findByRole('article', { name: 'Losartán 50 mg' })).toBeTruthy();
      expect(fetchFalso).toHaveBeenCalledWith('/api/backoffice/medicamentos', expect.anything());
      expect(llamadas('GET')[0][1].headers['x-backoffice-token']).toBe(CLAVE);
    });

    it('con una clave incorrecta lo dice junto al campo, no muestra medicamentos y deja volver a intentar', async () => {
      fetchFalso.mockImplementationOnce(() => responder(401, { motivo: 'no_autorizado', mensaje: MENSAJE_CLAVE }));
      const { usuario, entrar, campoClave } = mostrar();

      await entrar('otra-clave');

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toBe(MENSAJE_CLAVE);
      expect(campoClave().getAttribute('aria-describedby')).toContain(alerta.id);
      expect(campoClave().getAttribute('aria-invalid')).toBe('true');
      expect(screen.queryByRole('article')).toBeNull();

      // Puede volver a intentar con la clave correcta
      simular();
      await usuario.clear(campoClave());
      await usuario.type(campoClave(), `${CLAVE}{Enter}`);
      expect(await screen.findByRole('article', { name: 'Losartán 50 mg' })).toBeTruthy();
      expect(llamadas('GET')[1][1].headers['x-backoffice-token']).toBe(CLAVE);
    });

    it('no pide entrar sin escribir la clave (no consulta al backend)', async () => {
      const { usuario } = mostrar();

      await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

      expect((await screen.findByRole('alert')).textContent).toMatch(/clave/i);
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it('la clave vive solo en memoria: no se guarda en el navegador', async () => {
      // Almacenamientos falsos: así se detecta cualquier intento de guardar la clave
      const almacen = () => ({ setItem: vi.fn(), getItem: vi.fn(() => null), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 });
      const local = almacen();
      const sesion = almacen();
      vi.stubGlobal('localStorage', local);
      vi.stubGlobal('sessionStorage', sesion);
      simular();
      const { entrar } = mostrar();

      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      expect(local.setItem).not.toHaveBeenCalled();
      expect(sesion.setItem).not.toHaveBeenCalled();
      expect(document.cookie).toBe('');
    });

    it('«Salir» olvida la clave y vuelve a pedirla', async () => {
      simular();
      const { usuario, entrar, campoClave } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await usuario.click(screen.getByRole('button', { name: 'Salir del backoffice' }));

      expect(screen.queryByRole('article')).toBeNull();
      expect((campoClave() as HTMLInputElement).value).toBe('');
      // La clave anterior se olvidó: entrar sin escribir no consulta al backend...
      const consultas = fetchFalso.mock.calls.length;
      await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
      expect(fetchFalso.mock.calls.length).toBe(consultas);
      // ...y la clave nueva es la que se envía
      await usuario.type(campoClave(), 'clave-nueva{Enter}');
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      expect(llamadas('GET').at(-1)?.[1].headers['x-backoffice-token']).toBe('clave-nueva');
    });
  });

  describe('estados del listado: cargando, vacío y error', () => {
    it('mientras carga, lo anuncia', async () => {
      let terminar!: (r: Response) => void;
      fetchFalso.mockReturnValue(new Promise<Response>((r) => (terminar = r)));
      const { entrar } = mostrar();

      await entrar();

      expect(screen.getAllByRole('status').some((s) => s.textContent === 'Cargando medicamentos…')).toBe(true);
      terminar(new Response(JSON.stringify({ medicamentos: [losartan50] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      expect(await screen.findByRole('article', { name: 'Losartán 50 mg' })).toBeTruthy();
    });

    it('muestra cuántos medicamentos hay', async () => {
      simular();
      const { entrar } = mostrar();

      await entrar();

      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      expect(screen.getAllByRole('status').some((s) => s.textContent === 'Mostrando 3 medicamentos.')).toBe(true);
    });

    it('sin medicamentos, lo dice en vez de dejar la pantalla vacía', async () => {
      simular({ listas: [[]] });
      const { entrar } = mostrar();

      await entrar();

      expect(await screen.findByText('No hay medicamentos para mostrar por ahora.')).toBeTruthy();
    });

    it.each([
      ['no hay conexión', () => Promise.reject(new TypeError('Failed to fetch')), /conectarnos/],
      ['el servidor falla', () => responder(500, { motivo: 'error_interno', mensaje: 'texto técnico' }), /problema/],
    ])('si %s, lo explica en español, sin códigos, y permite reintentar', async (_caso, respuesta, texto) => {
      fetchFalso.mockImplementationOnce(respuesta);
      const { usuario, entrar } = mostrar();

      await entrar();

      const alerta = await screen.findByRole('alert');
      expect(alerta.textContent).toMatch(texto);
      expect(alerta.textContent).not.toMatch(/500|TypeError|fetch|texto técnico/i);

      simular();
      await usuario.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
      expect(await screen.findByRole('article', { name: 'Losartán 50 mg' })).toBeTruthy();
    });
  });

  describe('listado con precio y stock editables', () => {
    it('cada medicamento muestra lo guardado y deja editar precio y stock', async () => {
      simular();
      const { entrar } = mostrar();

      await entrar();

      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      const losartan = fila('Losartán 50 mg');
      expect(within(losartan).getByText('Losartán potásico')).toBeTruthy();
      expect(within(losartan).getByText('$1.990')).toBeTruthy();
      expect(within(losartan).getByText('120 unidades')).toBeTruthy();
      expect(precio('Losartán 50 mg').value).toBe('1990');
      expect(stock('Losartán 50 mg').value).toBe('120');
      expect(guardar('Losartán 50 mg')).toBeTruthy();
    });

    it('un medicamento sin stock lo dice con texto visible y se puede reponer', async () => {
      simular();
      const { entrar } = mostrar();

      await entrar();

      await screen.findByRole('article', { name: 'Fluoxetina 20 mg' });
      expect(within(fila('Fluoxetina 20 mg')).getByText('Sin stock')).toBeTruthy();
      expect(within(fila('Losartán 50 mg')).queryByText('Sin stock')).toBeNull();
      expect(stock('Fluoxetina 20 mg').value).toBe('0');
    });
  });

  describe('escenario feliz: la funcionaria cambia el precio o el stock y confirma', () => {
    it('guarda solo lo que cambió, con la version que leyó, y confirma el cambio', async () => {
      // Mientras tanto se vendieron 2 unidades: el backend responde con el stock real (118)
      simular({
        guardar: () => responder(200, { medicamento: { ...losartan50, precioUnitario: 2500, stock: 118, version: 1 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, precio('Losartán 50 mg'), '2500');
      await usuario.click(guardar('Losartán 50 mg'));

      expect(await within(fila('Losartán 50 mg')).findByText('Guardamos el cambio de Losartán 50 mg.')).toBeTruthy();
      expect(cuerpoDelPut()).toEqual({ precioUnitario: 2500, version: 0 });
      expect(llamadas('PUT')[0][0]).toBe('/api/backoffice/medicamentos/MED-001');
      expect(llamadas('PUT')[0][1].headers['x-backoffice-token']).toBe(CLAVE);
      // Lo guardado que se ve es lo que respondió el backend, no lo que se escribió
      expect(within(fila('Losartán 50 mg')).getByText('$2.500')).toBeTruthy();
      expect(within(fila('Losartán 50 mg')).getByText('118 unidades')).toBeTruthy();
      expect(stock('Losartán 50 mg').value).toBe('118');
    });

    it('guarda el stock, y con stock 0 el medicamento pasa a «Sin stock»', async () => {
      simular({
        guardar: () => responder(200, { medicamento: { ...losartan50, stock: 0, disponible: false, version: 1 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, stock('Losartán 50 mg'), '0');
      await usuario.click(guardar('Losartán 50 mg'));

      expect(await within(fila('Losartán 50 mg')).findByText('Sin stock')).toBeTruthy();
      expect(cuerpoDelPut()).toEqual({ stock: 0, version: 0 });
    });

    it('precio y stock a la vez se guardan juntos', async () => {
      simular({
        guardar: () => responder(200, { medicamento: { ...losartan50, precioUnitario: 2100, stock: 10, version: 1 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, precio('Losartán 50 mg'), '2100');
      await escribir(usuario, stock('Losartán 50 mg'), '10');
      await usuario.click(guardar('Losartán 50 mg'));

      await within(fila('Losartán 50 mg')).findByText('Guardamos el cambio de Losartán 50 mg.');
      expect(cuerpoDelPut()).toEqual({ precioUnitario: 2100, stock: 10, version: 0 });
    });

    it('un segundo cambio usa la version nueva que devolvió el backend', async () => {
      simular({
        guardar: (_codigo, cuerpo) =>
          responder(200, {
            medicamento: { ...losartan50, precioUnitario: cuerpo.precioUnitario ?? 1990, version: Number(cuerpo.version) + 1 },
          }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, precio('Losartán 50 mg'), '2100');
      await usuario.click(guardar('Losartán 50 mg'));
      await within(fila('Losartán 50 mg')).findByText('$2.100');
      await escribir(usuario, precio('Losartán 50 mg'), '2200');
      await usuario.click(guardar('Losartán 50 mg'));
      await within(fila('Losartán 50 mg')).findByText('$2.200');

      expect(cuerpoDelPut(0).version).toBe(0);
      expect(cuerpoDelPut(1).version).toBe(1);
    });

    it('editar un medicamento no toca a los demás', async () => {
      simular({
        guardar: () => responder(200, { medicamento: { ...losartan50, precioUnitario: 2500, version: 1 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await escribir(usuario, precio('Amlodipino 5 mg'), '1600'); // cambio sin guardar en otra fila

      await escribir(usuario, precio('Losartán 50 mg'), '2500');
      await usuario.click(guardar('Losartán 50 mg'));
      await within(fila('Losartán 50 mg')).findByText('$2.500');

      expect(precio('Amlodipino 5 mg').value).toBe('1600');
      expect(within(fila('Amlodipino 5 mg')).getByText('$1.490')).toBeTruthy();
    });

    it('si no cambió nada, avisa y no envía nada al backend', async () => {
      simular();
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await usuario.click(guardar('Losartán 50 mg'));

      expect(within(fila('Losartán 50 mg')).getByText('No hay cambios para guardar.')).toBeTruthy();
      expect(llamadas('PUT')).toHaveLength(0);
    });

    it('mientras guarda, el botón lo dice y un segundo clic no envía otra petición', async () => {
      let terminar!: (r: Response) => void;
      simular({ guardar: () => new Promise<Response>((r) => (terminar = r)) });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await escribir(usuario, precio('Losartán 50 mg'), '2500');

      const boton = guardar('Losartán 50 mg');
      await usuario.click(boton);
      await usuario.click(boton);

      // Sigue siendo el mismo botón (el foco no se pierde): aria-disabled, no disabled
      expect(boton.textContent).toMatch(/Guardando/);
      expect(boton.getAttribute('aria-disabled')).toBe('true');
      expect((boton as HTMLButtonElement).disabled).toBe(false);
      expect(llamadas('PUT')).toHaveLength(1);
      terminar(new Response(JSON.stringify({ medicamento: { ...losartan50, precioUnitario: 2500, version: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      await within(fila('Losartán 50 mg')).findByText('Guardamos el cambio de Losartán 50 mg.');
      expect(boton.textContent).not.toMatch(/Guardando/);
    });
  });

  describe('escenario de error: valor inválido, se rechaza, se informa el motivo y se mantiene el anterior', () => {
    const MENSAJE_PRECIO = 'El precio debe ser un número entero mayor que cero y de hasta diez millones.';
    const MENSAJE_STOCK = 'El stock debe ser un número entero, desde cero y de hasta un millón.';

    it.each([
      ['stock negativo', 'stock', '-1', -1, MENSAJE_STOCK],
      ['stock decimal', 'stock', '2.5', 2.5, MENSAJE_STOCK],
      ['stock no numérico', 'stock', 'abc', 'abc', MENSAJE_STOCK],
      ['precio vacío', 'precio', '', '', MENSAJE_PRECIO],
      ['precio no numérico', 'precio', 'abc', 'abc', MENSAJE_PRECIO],
      ['precio cero', 'precio', '0', 0, MENSAJE_PRECIO],
    ])(
      'con %s: el motivo aparece junto al campo, lo guardado no cambia y no se confirma nada',
      async (_caso, campo, texto, enviado, mensaje) => {
        const clave = campo === 'precio' ? 'precioUnitario' : 'stock';
        simular({ guardar: () => responder(400, { motivo: 'datos_invalidos', mensaje: 'No guardamos ningún cambio.', errores: { [clave]: mensaje } }) });
        const { usuario, entrar } = mostrar();
        await entrar();
        await screen.findByRole('article', { name: 'Losartán 50 mg' });
        const elCampo = campo === 'precio' ? precio('Losartán 50 mg') : stock('Losartán 50 mg');

        await escribir(usuario, elCampo, texto);
        await usuario.click(guardar('Losartán 50 mg'));

        // El valor se envía tal cual: el backend es quien decide si es válido (y explica por qué)
        await waitFor(() => expect(llamadas('PUT')).toHaveLength(1));
        expect(cuerpoDelPut()[clave]).toBe(enviado);
        // El motivo está junto al campo, enlazado con aria-describedby
        const alerta = await within(fila('Losartán 50 mg')).findByText(mensaje);
        expect(alerta.getAttribute('role')).toBe('alert');
        expect(elCampo.getAttribute('aria-describedby')).toContain(alerta.id);
        expect(elCampo.getAttribute('aria-invalid')).toBe('true');
        expect(elCampo.value).toBe(texto); // lo que escribió se conserva para que lo corrija
        // Lo guardado sigue igual a la vista y no hay confirmación de éxito
        expect(within(fila('Losartán 50 mg')).getByText('$1.990')).toBeTruthy();
        expect(within(fila('Losartán 50 mg')).getByText('120 unidades')).toBeTruthy();
        expect(screen.queryByText(/Guardamos el cambio/)).toBeNull();
      },
    );

    it('el error del precio no marca el stock, y al corregir se puede guardar', async () => {
      simular({
        guardar: (_codigo, cuerpo) =>
          cuerpo.precioUnitario === 0
            ? responder(400, { motivo: 'datos_invalidos', mensaje: 'x', errores: { precioUnitario: MENSAJE_PRECIO } })
            : responder(200, { medicamento: { ...losartan50, precioUnitario: 2500, version: 1 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, precio('Losartán 50 mg'), '0');
      await usuario.click(guardar('Losartán 50 mg'));
      await within(fila('Losartán 50 mg')).findByText(MENSAJE_PRECIO);
      expect(stock('Losartán 50 mg').getAttribute('aria-invalid')).not.toBe('true');

      await escribir(usuario, precio('Losartán 50 mg'), '2500');
      await usuario.click(guardar('Losartán 50 mg'));

      await within(fila('Losartán 50 mg')).findByText('Guardamos el cambio de Losartán 50 mg.');
      expect(within(fila('Losartán 50 mg')).queryByText(MENSAJE_PRECIO)).toBeNull();
      expect(precio('Losartán 50 mg').getAttribute('aria-invalid')).not.toBe('true');
    });

    it('si el medicamento ya no existe (404), muestra el mensaje del sistema en la fila', async () => {
      simular({ guardar: () => responder(404, { motivo: 'no_existe', mensaje: 'No encontramos ese medicamento. Vuelve a buscarlo, por favor.' }) });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, stock('Losartán 50 mg'), '5');
      await usuario.click(guardar('Losartán 50 mg'));

      const alerta = await within(fila('Losartán 50 mg')).findByRole('alert');
      expect(alerta.textContent).toBe('No encontramos ese medicamento. Vuelve a buscarlo, por favor.');
    });

    it('si el backend rechaza solo con un mensaje general, se muestra en la fila', async () => {
      simular({
        guardar: () => responder(400, { motivo: 'datos_invalidos', mensaje: 'No guardamos ningún cambio. Revisa los datos marcados e inténtalo de nuevo.', errores: { general: 'Indica el precio o el stock que quieres cambiar.' } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, stock('Losartán 50 mg'), '5');
      await usuario.click(guardar('Losartán 50 mg'));

      expect(await within(fila('Losartán 50 mg')).findByText('Indica el precio o el stock que quieres cambiar.')).toBeTruthy();
    });

    it('si falla la conexión al guardar, lo explica sin perder lo escrito', async () => {
      simular({ guardar: () => Promise.reject(new TypeError('Failed to fetch')) });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await escribir(usuario, precio('Losartán 50 mg'), '2500');

      await usuario.click(guardar('Losartán 50 mg'));

      const alerta = await within(fila('Losartán 50 mg')).findByRole('alert');
      expect(alerta.textContent).toMatch(/conectarnos/);
      expect(precio('Losartán 50 mg').value).toBe('2500');
      expect(within(fila('Losartán 50 mg')).getByText('$1.990')).toBeTruthy();
    });

    it('si el servidor falla (500), no muestra códigos ni textos técnicos', async () => {
      simular({ guardar: () => responder(500, { motivo: 'error_interno', mensaje: 'SQLITE_ERROR' }) });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await escribir(usuario, precio('Losartán 50 mg'), '2500');

      await usuario.click(guardar('Losartán 50 mg'));

      const alerta = await within(fila('Losartán 50 mg')).findByRole('alert');
      expect(alerta.textContent).toMatch(/problema/);
      expect(alerta.textContent).not.toMatch(/500|SQLITE/i);
    });
  });

  describe('ventas simultáneas (#12): el stock cambió mientras la funcionaria editaba', () => {
    it('avisa con el mensaje del sistema, recarga lo guardado y deja volver a intentar con la versión nueva', async () => {
      const despuesDeLaVenta = { ...losartan50, stock: 118, version: 1 };
      simular({
        listas: [[losartan50, amlodipino, fluoxetina], [despuesDeLaVenta, amlodipino, fluoxetina]],
        guardar: (_codigo, cuerpo) =>
          cuerpo.version === 0
            ? responder(409, { motivo: 'version_cambiada', mensaje: MENSAJE_CONFLICTO })
            : responder(200, { medicamento: { ...despuesDeLaVenta, stock: 150, version: 2 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, stock('Losartán 50 mg'), '150');
      await usuario.click(guardar('Losartán 50 mg'));

      // Aviso claro y lo guardado ya muestra la venta (118), no el valor viejo
      expect(await within(fila('Losartán 50 mg')).findByText(MENSAJE_CONFLICTO)).toBeTruthy();
      await waitFor(() => expect(within(fila('Losartán 50 mg')).getByText('118 unidades')).toBeTruthy());
      expect(llamadas('GET')).toHaveLength(2);
      expect(stock('Losartán 50 mg').value).toBe('118');
      expect(screen.queryByText(/Guardamos el cambio/)).toBeNull();
      // La recarga es silenciosa: el aviso sigue ahí y el foco no se pierde del botón
      expect(within(fila('Losartán 50 mg')).getByText(MENSAJE_CONFLICTO)).toBeTruthy();
      expect(document.activeElement).toBe(guardar('Losartán 50 mg'));

      // Con lo recargado, la misma edición se guarda enviando la version nueva
      await escribir(usuario, stock('Losartán 50 mg'), '150');
      await usuario.click(guardar('Losartán 50 mg'));
      expect(await within(fila('Losartán 50 mg')).findByText('Guardamos el cambio de Losartán 50 mg.')).toBeTruthy();
      expect(cuerpoDelPut(1)).toEqual({ stock: 150, version: 1 });
    });

    it('el conflicto de un medicamento no borra lo que se edita en otro, y ese borrador conserva su version de origen', async () => {
      // Al recargar, Amlodipino también cambió (otra venta en paralelo): version 1 y stock 70
      const amlodipinoVendido = { ...amlodipino, stock: 70, version: 1 };
      simular({
        listas: [[losartan50, amlodipino], [{ ...losartan50, stock: 118, version: 1 }, amlodipinoVendido]],
        guardar: () => responder(409, { motivo: 'version_cambiada', mensaje: MENSAJE_CONFLICTO }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await escribir(usuario, precio('Amlodipino 5 mg'), '1600');

      await escribir(usuario, stock('Losartán 50 mg'), '150');
      await usuario.click(guardar('Losartán 50 mg'));
      await within(fila('Losartán 50 mg')).findByText(MENSAJE_CONFLICTO);

      // El borrador se conserva y lo guardado se actualiza para que ella vea la venta
      expect(precio('Amlodipino 5 mg').value).toBe('1600');
      await waitFor(() => expect(within(fila('Amlodipino 5 mg')).getByText('70 unidades')).toBeTruthy());
      // Guardarlo envía la version sobre la que se empezó a editar (0), no la recargada: así el
      // backend lo rechaza en vez de dejar que un borrador viejo pise la venta
      await usuario.click(guardar('Amlodipino 5 mg'));
      await waitFor(() => expect(llamadas('PUT')).toHaveLength(2));
      expect(cuerpoDelPut(1)).toEqual({ precioUnitario: 1600, version: 0 });
    });
  });

  describe('si la clave deja de servir mientras trabaja', () => {
    it('al guardar con la clave rechazada vuelve al ingreso con el mensaje del sistema', async () => {
      simular({ guardar: () => responder(401, { motivo: 'no_autorizado', mensaje: MENSAJE_CLAVE }) });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await escribir(usuario, precio('Losartán 50 mg'), '2500');

      await usuario.click(guardar('Losartán 50 mg'));

      expect((await screen.findByRole('alert')).textContent).toBe(MENSAJE_CLAVE);
      expect(screen.queryByRole('article')).toBeNull();
      expect((screen.getByLabelText('Clave del equipo') as HTMLInputElement).value).toBe('');
    });
  });

  describe('uso solo con teclado', () => {
    it('Enter envía la clave; el foco pasa al listado y Tab recorre Salir, precio, stock y Guardar', async () => {
      simular();
      const { usuario, entrar } = mostrar();

      await entrar(); // escribe la clave y presiona Enter
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Medicamentos del backoffice' })));
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Salir del backoffice' }));
      await usuario.tab();
      expect(document.activeElement).toBe(precio('Losartán 50 mg'));
      await usuario.tab();
      expect(document.activeElement).toBe(stock('Losartán 50 mg'));
      await usuario.tab();
      expect(document.activeElement).toBe(guardar('Losartán 50 mg'));
    });

    it('Enter dentro de un campo guarda, y el foco se queda donde estaba', async () => {
      simular({
        guardar: () => responder(200, { medicamento: { ...losartan50, stock: 90, version: 1 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });

      await escribir(usuario, stock('Losartán 50 mg'), '90');
      await usuario.type(stock('Losartán 50 mg'), '{Enter}');

      await within(fila('Losartán 50 mg')).findByText('Guardamos el cambio de Losartán 50 mg.');
      expect(cuerpoDelPut()).toEqual({ stock: 90, version: 0 });
      expect(document.activeElement).toBe(stock('Losartán 50 mg'));
    });

    it('el foco no se pierde al guardar con el botón', async () => {
      simular({
        guardar: () => responder(200, { medicamento: { ...losartan50, stock: 90, version: 1 } }),
      });
      const { usuario, entrar } = mostrar();
      await entrar();
      await screen.findByRole('article', { name: 'Losartán 50 mg' });
      await escribir(usuario, stock('Losartán 50 mg'), '90');

      await usuario.click(guardar('Losartán 50 mg'));
      await within(fila('Losartán 50 mg')).findByText('Guardamos el cambio de Losartán 50 mg.');

      expect(document.activeElement).toBe(guardar('Losartán 50 mg'));
    });
  });
});
