// Proveedor que se comporta como el Neuron (modo "neuron") sin red: guarda el secreto (sessionId)
// que el servidor le entrega, para que el test pueda hacer el callback como lo haría el Neuron.
export function crearNeuronFalso() {
  const neuron = {
    modo: 'neuron',
    dominio: 'neuron.falso',
    ultimoSecreto: null,
    falla: false,
    async iniciar({ secreto }) {
      if (neuron.falla) throw new Error('sin conexión');
      neuron.ultimoSecreto = secreto;
      return { qr: { contentType: 'image/png', base64: 'iVBORw0KGgo=' }, enlace: 'tagsign:neuron.falso,abc' };
    },
  };
  return neuron;
}

// Cuerpo con la forma del que envía el Neuron (https://lab.tagroot.io/QuickLogin.md, "Identity
// Information"). Datos sintéticos: el PNR es inventado y solo sirve para comprobar que no se guarda.
export function identidadNeuron(secreto, cambios = {}) {
  return {
    SessionId: secreto,
    Id: '2c9f1e7a-prueba@legal.neuron.falso',
    Provider: 'legal.neuron.falso',
    State: 'Approved',
    Created: 1767225600,
    From: 1767225600,
    To: 1893456000, // año 2030
    Properties: { FIRST: 'Rosa', LAST: 'Pérez Ficticia', PNR: '11.111.111-1', COUNTRY: 'CL' },
    Attachments: [],
    ServerSignature: 'ZmlybWEtZmFsc2E=',
    ...cambios,
  };
}
