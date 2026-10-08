import { describe, it, expect } from 'vitest';
import { crearProveedorNeuron } from '../src/proveedores/identidadNeuron.js';

// #46: el proveedor habla con el Neuron como indica https://lab.tagroot.io/QuickLogin.md (modo back-end).
describe('proveedor de identidad Neuron', () => {
  function fetchFalso(respuestas) {
    const llamadas = [];
    const impl = async (url, opciones) => {
      llamadas.push({ url, metodo: opciones.method, cuerpo: JSON.parse(opciones.body) });
      const r = respuestas.shift();
      return { ok: r.status === 200, status: r.status, json: async () => r.json };
    };
    return { impl, llamadas };
  }

  it('registra el callback con el secreto y luego pide el QR en base64', async () => {
    const { impl, llamadas } = fetchFalso([
      { status: 200, json: { serviceId: 'svc-1' } },
      { status: 200, json: { base64: 'QUJD', contentType: 'image/png', width: 400, height: 400, signUrl: 'tagsign:x,y' } },
    ]);
    const proveedor = crearProveedorNeuron({
      dominio: 'lab.tagroot.io',
      urlCallback: 'https://tunel.ejemplo/api/sesion/callback',
      fetchImpl: impl,
    });

    const r = await proveedor.iniciar({ secreto: 'secreto-1', proposito: 'Ingresar a FarmacIA' });

    expect(r).toEqual({ qr: { contentType: 'image/png', base64: 'QUJD' }, enlace: 'tagsign:x,y' });
    expect(llamadas[0]).toEqual({
      url: 'https://lab.tagroot.io/QuickLogin',
      metodo: 'POST',
      cuerpo: { service: 'https://tunel.ejemplo/api/sesion/callback', sessionId: 'secreto-1' },
    });
    expect(llamadas[1].cuerpo).toMatchObject({ serviceId: 'svc-1', mode: 'base64', purpose: 'Ingresar a FarmacIA' });
    expect(llamadas[1].cuerpo.tab).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('falla si el Neuron responde con error', async () => {
    const { impl } = fetchFalso([{ status: 400, json: null }]);
    const proveedor = crearProveedorNeuron({ dominio: 'lab.tagroot.io', urlCallback: 'https://x/cb', fetchImpl: impl });
    await expect(proveedor.iniciar({ secreto: 's', proposito: 'p' })).rejects.toThrow(/400/);
  });

  it('falla sin URL pública para el callback, sin llamar al Neuron', async () => {
    const { impl, llamadas } = fetchFalso([]);
    const proveedor = crearProveedorNeuron({ dominio: 'lab.tagroot.io', urlCallback: '', fetchImpl: impl });
    await expect(proveedor.iniciar({ secreto: 's', proposito: 'p' })).rejects.toThrow(/URL_PUBLICA_API/);
    expect(llamadas).toEqual([]);
  });
});
