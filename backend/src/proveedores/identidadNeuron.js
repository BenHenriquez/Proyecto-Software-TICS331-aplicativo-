import { randomUUID } from 'node:crypto';

// US-17 (#46). Quick Login de TAG Neuro-Access en "modo back-end" (https://lab.tagroot.io/QuickLogin.md):
// 1. POST /QuickLogin { service, sessionId } registra nuestro callback y devuelve un serviceId (5 minutos).
// 2. POST /QuickLogin { serviceId, tab, mode, purpose } devuelve el QR que el vecino escanea con la app.
// Cuando el vecino aprueba, el Neuron hace POST al callback con su identidad y el mismo sessionId.
// El QR se pide desde el servidor: el front no carga scripts del Neuron.
const MS_ESPERA = 10_000;

export function crearProveedorNeuron({ dominio, urlCallback, fetchImpl = fetch }) {
  const urlQuickLogin = `https://${dominio}/QuickLogin`;

  async function postJson(cuerpo) {
    const res = await fetchImpl(urlQuickLogin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(MS_ESPERA),
    });
    if (!res.ok) throw new Error(`El Neuron respondió ${res.status}`);
    return res.json();
  }

  return {
    modo: 'neuron',
    dominio,

    // `secreto` es el sessionId: el Neuron lo devuelve en el callback y así sabemos que es auténtico.
    async iniciar({ secreto, proposito }) {
      if (!urlCallback) throw new Error('Falta URL_PUBLICA_API en el .env');

      const { serviceId } = await postJson({ service: urlCallback, sessionId: secreto });
      // `tab` identifica una pestaña para los eventos del Neuron; no los usamos, pero es obligatorio.
      const qr = await postJson({ serviceId, tab: randomUUID(), mode: 'base64', purpose: proposito });
      return { qr: { contentType: qr.contentType, base64: qr.base64 }, enlace: qr.signUrl };
    },
  };
}
