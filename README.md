# FARMAC-IA · Farmacia Comunitaria de Peñalolén

Prototipo del curso TICS331 (equipo BBMVV). En el Sprint 1 una vecina busca un medicamento por nombre o principio activo, ve su precio y disponibilidad y genera un pedido. Todo funciona con **datos sintéticos**.

> Estado actual (Sprint 1, en construcción): funcionan `GET /api/health`, `GET /api/medicamentos?q=` (búsqueda por nombre o principio activo, US-02), `POST /api/pedidos` (compra atómica, US-15) y `GET /api/backoffice/medicamentos` junto con `PUT /api/backoffice/medicamentos/:codigo` (listar y actualizar precio y stock, con candado de versión frente a ventas simultáneas, US-13). En el front, el panel de mantención (`/backoffice`) lista los medicamentos y deja editar su precio y stock, y la pantalla de búsqueda (`/`) muestra tarjetas con nombre, principio activo, precio y disponibilidad, avisa cuando no hay coincidencias, marca «Sin stock» sin botón de compra y abre el selector de cantidad (`SelectorCantidad`) y, al continuar, la confirmación del pedido (`ConfirmarPedido`): resumen, botón de confirmar y, al terminar, el número de pedido con su total y el estado «Solicitud creada» (o el aviso de que ya no hay stock).

## Requisitos

- Node.js 20.19 o superior (probado también con Node 22)
- npm 10 o superior

## Cómo levantarlo (desde la raíz)

```bash
npm install          # instala backend y frontend (npm workspaces)
cp .env.example .env # en Windows PowerShell: Copy-Item .env.example .env
npm run seed         # recrea la base SQLite y carga los 34 medicamentos sintéticos
npm run dev          # levanta API (puerto 3001) y front (http://localhost:5173) juntos
```

Abre <http://localhost:5173>. El front hace proxy de `/api` hacia el backend; puedes comprobarlo en <http://localhost:5173/api/health>, que debe responder `{ "ok": true }`.

Otros comandos:

```bash
npm test       # tests del backend (vitest + supertest, base en memoria) y del front (vitest + Testing Library)
npm run build  # compila el front (TypeScript + Vite)
```

## Variables de entorno (`.env`)

| Variable | Para qué | Ejemplo |
|---|---|---|
| `PORT` | Puerto del backend; Vite lo usa para el proxy | `3001` |
| `DB_PATH` | Archivo SQLite, relativo a la raíz del repo | `backend/data/farmacia.db` |
| `BACKOFFICE_TOKEN` | Token **simulado** del backoffice | cualquier texto |
| `IDENTIDAD_PROVEEDOR` | Ingreso con Neuro-Access (US-17): `simulado` o `neuron` | `simulado` |
| `NEURON_DOMINIO` | Neuron de TAG que genera el QR (solo con `neuron`) | `lab.tagroot.io` |
| `URL_PUBLICA_API` | URL HTTPS pública que llega al backend, para el callback del Neuron (solo con `neuron`) | `https://xxxx.trycloudflare.com` |

El `.env` no se sube al repositorio.

## Qué es sintético y qué es simulado

- **Datos sintéticos:** todos los medicamentos, precios y stock de `backend/seed/medicamentos_semilla.csv` son inventados. No hay datos reales de la farmacia ni de personas (sin RUT, recetas, nombres ni direcciones). El repositorio es público: nunca se suben planillas reales (`*.xls`, `*.xlsx` están en `.gitignore`).
- **Productos de prueba:** `PRB-001` (1 unidad) y `PRB-002` (2 unidades) existen solo para las pruebas de concurrencia. `MED-014`, `MED-019` y `MED-030` vienen sin stock.
- **Token del backoffice simulado:** el backoffice se protege con el header `x-backoffice-token`, comparado con `BACKOFFICE_TOKEN` del `.env`. **No es autenticación real**; es solo para el prototipo. Si `BACKOFFICE_TOKEN` está vacío, el backoffice rechaza todas las peticiones. Ejemplo para cambiar el precio de un medicamento (Git Bash, macOS o Linux; en PowerShell usa `curl.exe` y comillas dobles escapadas). Hay que enviar la `version` vigente del medicamento (parte en 0 con `npm run seed` y sube con cada venta o cambio); si no coincide, el sistema responde que el stock cambió y no guarda nada:
  ```bash
  curl -X PUT http://localhost:5173/api/backoffice/medicamentos/MED-001 -H "x-backoffice-token: <el valor de tu .env>" -H "Content-Type: application/json" -d '{"precioUnitario": 2100, "version": 0}'
  ```
- **Panel de mantención:** en <http://localhost:5173/backoffice> la funcionaria escribe la clave del equipo (el valor de `BACKOFFICE_TOKEN` de tu `.env`; es simulada y solo vive en la memoria de la página, nunca se guarda en el navegador), ve el listado con el precio y el stock de cada medicamento, los edita y confirma con «Guardar cambios». Si el valor no es válido, el motivo aparece junto al campo y se mantiene el valor guardado. Si una venta cambió el medicamento mientras editaba, el panel avisa y recarga lo guardado para que pueda volver a intentarlo.
- **Fuera del Sprint 1:** pagos, Praxsuite, SAP, WhatsApp, delivery e IA no están implementados.

## Ingresar con Neuro-Access (US-17)

En <http://localhost:5173/ingresar> el vecino ingresa escaneando un QR con la app **Neuro-Access** de Trust Anchor Group (Quick Login sobre Neuro-Ledger), sin usuario ni clave. Con la sesión iniciada, sus pedidos quedan a su nombre y los revisa en **Mis pedidos** (`/mis-pedidos`). Buscar y comprar **no** exigen ingresar.

- **Modo simulado (por defecto, `IDENTIDAD_PROVEEDOR=simulado`):** no necesita red ni app. En vez del QR aparece el botón «Simular escaneo», que ingresa como la vecina ficticia «Rosa». Es el modo de los tests.
- **Modo real (`IDENTIDAD_PROVEEDOR=neuron`):** el backend pide el QR al Neuron público de pruebas `lab.tagroot.io`. Cuando el vecino aprueba en la app, el Neuron avisa al backend por HTTPS, así que el backend debe ser accesible desde internet con un túnel:
  ```bash
  winget install Cloudflare.cloudflared          # una vez (Windows)
  cloudflared tunnel --url http://localhost:3001 # copia la URL https://….trycloudflare.com que imprime
  ```
  Pon esa URL en `URL_PUBLICA_API` del `.env` (cambia cada vez que abres el túnel) y reinicia `npm run dev`. Para probar hace falta la app Neuro-Access ([Android](https://play.google.com/store/apps/details?id=com.tag.NeuroAccess) · [iPhone](https://apps.apple.com/us/app/neuro-access/id6446863270)) con una identidad aprobada en `lab.tagroot.io`.
- **Privacidad:** de la identidad solo se guardan su Id y el nombre de pila; nunca el RUT ni otros datos, y nada se escribe en logs. Las sesiones usan cookies httpOnly de 8 horas; el código QR vale 5 minutos.
- Si ya tenías la base creada, vuelve a ejecutar `npm run seed`: el esquema agregó las tablas `vecinos`, `intentos_ingreso` y `sesiones`.

## Estructura

```
backend/            Node + Express + better-sqlite3
  src/app.js        fábrica de la app (sin listen, para tests)
  src/server.js     arranque del servidor
  src/routes/       rutas HTTP
  src/middleware/   token simulado del backoffice y lectura de cookies
  src/proveedores/  proveedor de identidad: Neuro-Access (Neuron de TAG) o simulado (US-17)
  src/services/     reglas de negocio
  src/repositories/ único lugar que toca SQLite (se reemplaza por Praxsuite en el Sprint 2)
  src/db/schema.sql esquema oficial (docs/arquitectura/MODELO_DE_DATOS.md §2)
  seed/             semilla sintética
  tests/            vitest + supertest
frontend/           React + Vite + TypeScript
  src/pages/        "/" buscador, "/ingresar", "/mis-pedidos" y "/backoffice"
  src/components/   componentes reutilizables (tarjeta de medicamento, selector de cantidad, confirmación del pedido, fila del panel de mantención)
  src/lib/          cliente de la API y utilidades (formato de pesos)
docs/               ADR, modelo de datos, backlog del sprint y trazabilidad de la verificación (docs/sprint-1/TRAZABILIDAD.md)
```

Decisión de arquitectura: [ADR-01](docs/adr/ADR-01-backend-sprint1.md). Esquema y API: [MODELO_DE_DATOS.md](docs/arquitectura/MODELO_DE_DATOS.md).
