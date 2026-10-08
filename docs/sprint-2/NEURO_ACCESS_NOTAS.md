# Neuro-Access y Quick Login — notas del spike (#44, US-17)

> Hallazgos para integrar el ingreso con QR de Trust Anchor Group (TAG). Documentación oficial:
> <https://lab.tagroot.io/QuickLogin.md>. Datos de prueba: nunca se suben identidades reales al repositorio.

## Qué es cada cosa

- **TAG Neuron®:** servidor de TAG que guarda identidades digitales y contratos. `lab.tagroot.io` es su Neuron público de pruebas.
- **Neuro-Ledger:** registro distribuido donde viven las identidades legales (Legal ID) firmadas, según IEEE P1451.99.
- **Neuro-Access:** app gratuita (Android/iOS) donde la persona crea su identidad digital y aprueba solicitudes de firma, como el ingreso.
- **Quick Login:** el sitio muestra un QR generado por el Neuron; la persona lo escanea con la app, aprueba, y el Neuron entrega su identidad firmada al sitio.

## Verificado (2026-10-08)

- `POST https://lab.tagroot.io/QuickLogin` con `{ "service": "<url https>", "sessionId": "<opaco>" }` responde `{ "serviceId": "…" }` **sin credenciales**.
- Con ese `serviceId`, `POST /QuickLogin` con `{ serviceId, tab, mode: "base64", purpose }` responde `{ base64, contentType: "image/png", width, height, signUrl: "tagsign:lab.tagroot.io,…" }`. El campo `tab` es obligatorio (`Missing Tab ID.`), pero sirve cualquier GUID: por eso el QR se pide desde el backend, sin cargar `Events.js`/`QuickLogin.js` en el front (`Events.js` ejecuta `eval` con lo que envía el servidor).
- El Neuron permite CORS desde `http://localhost:5173` (no lo necesitamos, porque el front no llama al Neuron).
- El proveedor real del backend (`backend/src/proveedores/identidadNeuron.js`) obtuvo un QR válido de `lab.tagroot.io` con el servidor corriendo.
- Según TAG, desde el build 2026-01-07 del Neuron las identidades simples se aprueban automáticamente, y Neuro-Access acepta números de prueba `+1555` fuera de producción.

## Prueba en vivo (2026-10-08)

Con la app Neuro-Access en un iPhone, una identidad aprobada en el Neuron `waher.se` y el túnel `cloudflared` hacia el backend:

- **Ingreso feliz: funciona.** Con `NEURON_DOMINIO=waher.se` (el Neuron donde está la identidad), se escaneó el QR, se aprobó en la app y el Neuron llamó al callback por el túnel. El sitio saludó y quedó la sesión. En la base se guardó solo el Id de la identidad (`…@legal.waher.se`) y el nombre.
- **Pedido a su nombre, Mis pedidos y Salir: funcionan** con la identidad real (pedido asociado a `vecino_id`).
- **Nombre de pila:** la identidad de prueba es una identidad *simple* y solo tiene país, teléfono y correo; no trae `Properties.FIRST`, así que el saludo usó el respaldo «vecino». **Decisión:** se mantiene «vecino». No se usan el teléfono ni el correo para saludar, porque serían datos personales guardados. Si la identidad trae nombre de pila, el sitio lo usa sin cambios.
- **Rechazo en la app: el Neuron no envía ningún callback.** El intento queda `pendiente` hasta vencer, igual que si nadie hubiera escaneado. Por eso la pantalla ofrece «Generar otro código» mientras espera.
- **Código vencido:** el primer intento mostró «ya no sirve» en vez de «venció», porque la cookie del intento vencía junto con el código. Se corrigió: la cookie dura 15 minutos y el código 5.
- `waher.se` también acepta `POST /QuickLogin` sin credenciales, igual que `lab.tagroot.io`.

## Pendiente

- [ ] Confirmar el `Content-Type` real del callback (el backend acepta JSON con cualquier tipo).
- [ ] Ver si `propertyFilter` permite pedir solo el nombre de pila (menos datos personales en tránsito).
- [ ] Opcional: verificar `ServerSignature` con la clave del Neuron. Hoy la autenticidad del callback se apoya en el `sessionId` secreto, de un solo uso y con 5 minutos de vigencia, que nunca llega al navegador.
