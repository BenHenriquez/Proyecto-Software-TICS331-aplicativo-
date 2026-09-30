# FARMAC-IA · Farmacia Comunitaria de Peñalolén

Prototipo del curso TICS331 (equipo BBMVV). En el Sprint 1 una vecina busca un medicamento por nombre o principio activo, ve su precio y disponibilidad y genera un pedido. Todo funciona con **datos sintéticos**.

> Estado actual (Sprint 1, en construcción): funcionan `GET /api/health`, `POST /api/pedidos` (compra atómica, US-15) y `PUT /api/backoffice/medicamentos/:codigo` (actualizar precio y stock, US-13). Siguen respondiendo `501` la búsqueda (`GET /api/medicamentos`, US-02) y el listado del backoffice (`GET /api/backoffice/medicamentos`). En el front, el selector de cantidad (`SelectorCantidad`) está construido y probado, pero aún no está conectado a la pantalla de búsqueda.

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
- **Token del backoffice simulado:** el backoffice se protege con el header `x-backoffice-token`, comparado con `BACKOFFICE_TOKEN` del `.env`. **No es autenticación real**; es solo para el prototipo. Si `BACKOFFICE_TOKEN` está vacío, el backoffice rechaza todas las peticiones. Ejemplo para cambiar el precio de un medicamento (Git Bash, macOS o Linux; en PowerShell usa `curl.exe` y comillas dobles escapadas):
  ```bash
  curl -X PUT http://localhost:5173/api/backoffice/medicamentos/MED-001 -H "x-backoffice-token: <el valor de tu .env>" -H "Content-Type: application/json" -d '{"precioUnitario": 2100}'
  ```
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
  src/components/   componentes reutilizables (selector de cantidad)
  src/lib/          utilidades (formato de pesos)
docs/               ADR, modelo de datos, backlog del sprint y trazabilidad de la verificación (docs/sprint-1/TRAZABILIDAD.md)
```

Decisión de arquitectura: [ADR-01](docs/adr/ADR-01-backend-sprint1.md). Esquema y API: [MODELO_DE_DATOS.md](docs/arquitectura/MODELO_DE_DATOS.md).
