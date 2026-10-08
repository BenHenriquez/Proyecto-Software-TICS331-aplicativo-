import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { INTERVALO_CONSULTA_MS } from './Ingresar';

// #47 Pantalla de ingreso con QR y #48 cabecera con sesión (US-17, #43).
// El backend se simula con un fetch falso que responde según método y ruta.
type Respuesta = { status: number; cuerpo: unknown };
let rutas: Record<string, Respuesta | Respuesta[]>;
let llamadas: string[];

const responder = ({ status, cuerpo }: Respuesta) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  llamadas = [];
  rutas = { 'GET /api/sesion': { status: 200, cuerpo: { vecino: null } } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const clave = `${opciones?.method ?? 'GET'} ${url}`;
      llamadas.push(clave);
      const r = rutas[clave];
      if (!r) return responder({ status: 404, cuerpo: { motivo: 'ruta_no_existe' } });
      // Una lista se consume en orden y repite la última.
      return responder(Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]) : r);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const QR = {
  status: 201,
  cuerpo: {
    modo: 'neuron',
    qr: { contentType: 'image/png', base64: 'iVBORw0KGgo=' },
    enlace: 'tagsign:lab.tagroot.io,abc',
    venceEn: '2026-10-08T12:05:00.000Z',
  },
};
const PENDIENTE = { status: 200, cuerpo: { estado: 'pendiente', venceEn: '2026-10-08T12:05:00.000Z' } };
const APROBADO = { status: 200, cuerpo: { estado: 'aprobado', vecino: { nombre: 'Rosa' } } };

function mostrar(ruta = '/ingresar') {
  const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return usuario;
}

const esperarConsulta = () => act(() => vi.advanceTimersByTimeAsync(INTERVALO_CONSULTA_MS));

describe('Ingresar', () => {
  it('muestra el QR del Neuron con los pasos y el enlace para abrir la app', async () => {
    rutas['POST /api/sesion/qr'] = QR;
    rutas['GET /api/sesion/qr'] = PENDIENTE;
    mostrar();

    const imagen = await screen.findByRole('img', { name: 'Código QR para ingresar con Neuro-Access' });
    expect(imagen.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(imagen.closest('a')?.getAttribute('href')).toBe('tagsign:lab.tagroot.io,abc');
    expect(screen.getByText('Abre la app Neuro-Access en tu teléfono.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Android' })).toBeTruthy();
  });

  it('escenario feliz: al aprobar en la app saluda por el nombre y la cabecera muestra "Hola" y "Salir"', async () => {
    rutas['POST /api/sesion/qr'] = QR;
    rutas['GET /api/sesion/qr'] = [PENDIENTE, APROBADO];
    mostrar();
    await screen.findByRole('img', { name: /Código QR/ });

    await esperarConsulta(); // todavía pendiente
    expect(screen.queryByText('¡Hola, Rosa! Ya ingresaste.')).toBeNull();

    rutas['GET /api/sesion'] = { status: 200, cuerpo: { vecino: { nombre: 'Rosa' } } };
    await esperarConsulta();

    expect(await screen.findByText('¡Hola, Rosa! Ya ingresaste.')).toBeTruthy();
    expect(await screen.findByText('Hola, Rosa')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver mis pedidos' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Código QR/ })).toBeNull();
  });

  it('escenario de error: con el código vencido explica qué pasó y genera uno nuevo', async () => {
    rutas['POST /api/sesion/qr'] = QR;
    rutas['GET /api/sesion/qr'] = {
      status: 200,
      cuerpo: { estado: 'vencido', mensaje: 'Tu código para ingresar venció. Genera uno nuevo y escanéalo con tu app Neuro-Access.' },
    };
    const usuario = mostrar();
    await screen.findByRole('img', { name: /Código QR/ });

    await esperarConsulta();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toMatch(/venció/);
    expect(screen.queryByRole('img', { name: /Código QR/ })).toBeNull();

    rutas['GET /api/sesion/qr'] = PENDIENTE;
    await usuario.click(screen.getByRole('button', { name: 'Generar un código nuevo' }));
    expect(await screen.findByRole('img', { name: /Código QR/ })).toBeTruthy();
    expect(llamadas.filter((l) => l === 'POST /api/sesion/qr')).toHaveLength(2);
  });

  it('mientras espera ofrece "Generar otro código" (si el vecino rechazó en la app, el Neuron no avisa)', async () => {
    rutas['POST /api/sesion/qr'] = QR;
    rutas['GET /api/sesion/qr'] = PENDIENTE;
    const usuario = mostrar();
    await screen.findByRole('img', { name: /Código QR/ });

    await usuario.click(screen.getByRole('button', { name: 'Generar otro código' }));

    expect(await screen.findByRole('img', { name: /Código QR/ })).toBeTruthy();
    expect(llamadas.filter((l) => l === 'POST /api/sesion/qr')).toHaveLength(2);
  });

  it('si el Neuron no responde, muestra el mensaje del backend y deja intentar de nuevo', async () => {
    rutas['POST /api/sesion/qr'] = {
      status: 502,
      cuerpo: {
        motivo: 'proveedor_no_disponible',
        mensaje: 'No pudimos crear tu código para ingresar. Inténtalo de nuevo en un momento.',
      },
    };
    mostrar();
    // Un 5xx nunca muestra el texto del servidor: se usa el mensaje propio del front, igual de simple.
    expect((await screen.findByRole('alert')).textContent).toMatch(/No pudimos crear tu código para ingresar/);
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeTruthy();
  });

  it('en modo de prueba (proveedor simulado) ofrece "Simular escaneo" en vez del QR', async () => {
    rutas['POST /api/sesion/qr'] = { status: 201, cuerpo: { ...QR.cuerpo, modo: 'simulado', qr: null, enlace: null } };
    rutas['POST /api/sesion/qr/simular'] = { status: 200, cuerpo: { ok: true } };
    rutas['GET /api/sesion/qr'] = PENDIENTE;
    const usuario = mostrar();

    await usuario.click(await screen.findByRole('button', { name: 'Simular escaneo' }));
    expect(llamadas).toContain('POST /api/sesion/qr/simular');
    expect(screen.queryByRole('img', { name: /Código QR/ })).toBeNull();

    rutas['GET /api/sesion/qr'] = APROBADO;
    await esperarConsulta();
    expect(await screen.findByText('¡Hola, Rosa! Ya ingresaste.')).toBeTruthy();
  });

  it('en modo de prueba, un doble clic en "Simular escaneo" no termina en error: igual saluda', async () => {
    rutas['POST /api/sesion/qr'] = { status: 201, cuerpo: { ...QR.cuerpo, modo: 'simulado', qr: null, enlace: null } };
    // El segundo clic llegaría con el código ya aprobado y el backend lo rechazaría.
    rutas['POST /api/sesion/qr/simular'] = [
      { status: 200, cuerpo: { ok: true } },
      { status: 409, cuerpo: { motivo: 'intento_invalido', mensaje: 'Genera un código nuevo, por favor.' } },
    ];
    rutas['GET /api/sesion/qr'] = APROBADO;
    const usuario = mostrar();

    const boton = await screen.findByRole('button', { name: 'Simular escaneo' });
    await usuario.dblClick(boton);

    expect(llamadas.filter((l) => l === 'POST /api/sesion/qr/simular')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Aprobando…' }).getAttribute('aria-disabled')).toBe('true');
    await esperarConsulta();
    expect(await screen.findByText('¡Hola, Rosa! Ya ingresaste.')).toBeTruthy();
    expect(screen.queryByText('Genera un código nuevo, por favor.')).toBeNull();
  });

  it('"Salir" cierra la sesión y vuelve a mostrar "Ingresar" en la cabecera', async () => {
    rutas['GET /api/sesion'] = { status: 200, cuerpo: { vecino: { nombre: 'Rosa' } } };
    rutas['POST /api/sesion/cerrar'] = { status: 200, cuerpo: { ok: true } };
    rutas['GET /api/medicamentos?q='] = { status: 200, cuerpo: { resultados: [] } };
    const usuario = mostrar('/');

    await usuario.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(llamadas).toContain('POST /api/sesion/cerrar');
    expect(await screen.findByRole('link', { name: 'Ingresar' })).toBeTruthy();
    expect(screen.queryByText('Hola, Rosa')).toBeNull();
  });
});
