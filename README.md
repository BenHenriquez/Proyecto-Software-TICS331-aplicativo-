# FARMAC-IA · Farmacia Comunitaria de Peñalolén

Prototipo del curso TICS331 (equipo BBMVV). En el Sprint 1 una vecina busca un medicamento por nombre o principio activo, ve su precio y disponibilidad y genera un pedido. Todo funciona con **datos sintéticos**.

> Estado actual (Sprint 1, en construcción): funcionan `GET /api/health`, `GET /api/medicamentos?q=` (búsqueda por nombre o principio activo, US-02), `POST /api/pedidos` (compra atómica, US-15) y `GET /api/backoffice/medicamentos` junto con `PUT /api/backoffice/medicamentos/:codigo` (listar y actualizar precio y stock, con candado de versión frente a ventas simultáneas, US-13). En el front, el panel de mantención (`/backoffice`) lista los medicamentos y deja editar su precio y stock, y la pantalla de búsqueda (`/`) muestra tarjetas con nombre, principio activo, precio y disponibilidad, avisa cuando no hay coincidencias, marca «Sin stock» sin botón de compra y abre el selector de cantidad (`SelectorCantidad`); la confirmación del pedido (#18) aún no está conectada.

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

## Estructura

```
backend/            Node + Express + better-sqlite3
  src/app.js        fábrica de la app (sin listen, para tests)
  src/server.js     arranque del servidor
  src/routes/       rutas HTTP
  src/middleware/   token simulado del backoffice
  src/services/     reglas de negocio
  src/repositories/ único lugar que toca SQLite (se reemplaza por Praxsuite en el Sprint 2)
  src/db/schema.sql esquema oficial (docs/arquitectura/MODELO_DE_DATOS.md §2)
  seed/             semilla sintética
  tests/            vitest + supertest
frontend/           React + Vite + TypeScript
  src/pages/        "/" buscador y "/backoffice"
  src/components/   componentes reutilizables (tarjeta de medicamento, selector de cantidad, fila del panel de mantención)
  src/lib/          cliente de la API y utilidades (formato de pesos)
docs/               ADR, modelo de datos, backlog del sprint y trazabilidad de la verificación (docs/sprint-1/TRAZABILIDAD.md)
```

Decisión de arquitectura: [ADR-01](docs/adr/ADR-01-backend-sprint1.md). Esquema y API: [MODELO_DE_DATOS.md](docs/arquitectura/MODELO_DE_DATOS.md).
