# CLAUDE.md — FARMAC-IA (TICS331 · Equipo BBMVV)

Responde siempre en español. Es un proyecto universitario evaluado: la **evidencia del proceso** (ramas, commits, PRs, tablero, pruebas) importa tanto como el código.

## Proyecto

Prototipo para la Farmacia Comunitaria de Peñalolén (cliente real). **Todos los datos son sintéticos.**

**Meta del Sprint 1:** una vecina busca un medicamento por nombre o principio activo, conoce su precio y disponibilidad y puede generar una compra/pedido utilizando datos sintéticos; si el medicamento no existe o no tiene stock, el sistema lo informa claramente.

Ciclo a demostrar: buscar → ver precio/stock → elegir cantidad → confirmar → pedido con total y estado `Solicitud creada`.

| Historia | Issue padre | Sub-issues |
|---|---|---|
| US-02 Consultar medicamento | #1 | #6–#10 |
| US-13 Mantener stock (backoffice) | #2 | #11–#14 |
| US-15 Realizar compra/pedido (incluye concurrencia) | #3 | #15–#20 |

**Fuera de alcance del Sprint 1** (no implementar aunque se pida de pasada; si una tarea lo requiere, detente y pregunta): Praxsuite (Sprint 2), SAP, Tesorería, Webpay, WhatsApp, IA o predicción de demanda, lector de pantalla completo (US-07), delivery y rutas, pacientes, recetas, RUT.

## Stack (ver docs/adr/ADR-01-backend-sprint1.md)

- Monorepo con npm workspaces.
- `/backend`: Node 20 + Express + better-sqlite3.
- `/frontend`: React + Vite + TypeScript.
- Tests: vitest + supertest.
- Comandos desde la raíz: `npm install`, `npm run seed`, `npm run dev`, `npm test`.
- Capas del backend: `routes` → `services` → `repositories`. **Solo los repositories tocan SQLite**, para poder migrar a Praxsuite en el Sprint 2 sin tocar el resto.
- Esquema oficial: `docs/arquitectura/MODELO_DE_DATOS.md`. Si cambias el esquema, actualiza ese archivo en el mismo PR.
- Monolito simple. No proponer microservicios ni Docker multi-servicio.

## Reglas técnicas clave

1. Precio y total se calculan en el backend. Nunca se aceptan desde el cliente.
2. La compra descuenta stock con un `UPDATE ... WHERE stock >= ?` atómico e inserta el pedido **en la misma transacción** (ver modelo §4). Nunca "leer stock, restar en JavaScript y guardar".
3. El stock nunca puede quedar negativo (CHECK en la tabla + validación).
4. Búsqueda insensible a mayúsculas y tildes, usando la columna `busqueda` normalizada.
5. El backoffice se protege con un token simulado leído desde `.env`. Declararlo como simulado en el README.
6. Los mensajes al usuario van en español simple y cálido, nunca códigos de error.

## Front: criterios de diseño

Usuarias principales: adultos mayores y cuidadoras. Letra de al menos 18 px, alto contraste, botones grandes, navegable solo con teclado (mínimo de la DoD de US-02). Cada pantalla maneja los estados: cargando, vacío, error y sin stock.

## Seguridad y datos (no negociable)

- Nunca imprimas, copies ni commitees claves. Si el usuario pega una en el chat, avísale que la revoque.
- Solo datos sintéticos (`backend/seed/`). **Nunca uses ni subas el Excel de la farmacia: el repositorio es público.** Sin datos de personas.
- `.env`, `*.db`, `*.xls` y `*.xlsx` no se commitean (ya están en `.gitignore`).

## Cómo trabajar un issue

1. Lee el issue y su historia padre: los criterios Gherkin están en el cuerpo del padre (#1, #2 o #3) y en `docs/sprint-1/META_Y_BACKLOG.md`.
2. Trabaja en la rama de la historia (`feat/US-02-busqueda`, etc.). Nunca en `main`.
3. Commits chicos en español con el número: `feat(compra): selector de cantidad con total (#17)`.
4. Cada escenario Gherkin debe tener su test.
5. Antes del PR: `npm test` y `npm run build` pasan; sin secretos en el diff.
6. PR con `Closes #N`, qué cambió, cómo probarlo y captura si hay UI. Lo revisa otra persona del equipo; no lo mergees tú.
7. Si cambian nombres de clases, métodos o endpoints, avisa que hay que actualizar `docs/uml/`.

## Definition of Done

Criterios Gherkin ejecutados en vivo · merge por PR revisado · sin secretos ni datos reales · UML con los mismos nombres que el código · README levanta en máquina limpia · tarjeta en Done con el mismo ID · aceptada por el PO municipal. "Casi anda" no es Done.
