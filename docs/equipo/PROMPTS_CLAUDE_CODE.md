# Prompts para Claude Code

Úsenlos en un **chat nuevo** de Claude Code, abierto en la carpeta del repo. Claude lee `CLAUDE.md` automáticamente, pero los prompts lo piden igual para asegurarse.

---

## Prompt A — Esqueleto del proyecto (hoy, una sola persona)

```
Lee CLAUDE.md, docs/arquitectura/MODELO_DE_DATOS.md y docs/adr/ADR-01-backend-sprint1.md.
Trabaja en la rama "chore/esqueleto" con commits chicos en español.

1. Monorepo con npm workspaces: /backend (Node 20, Express, better-sqlite3) y
   /frontend (React + Vite + TypeScript). Tests con vitest + supertest.
2. Backend: crea el esquema exacto de MODELO_DE_DATOS.md §2 y un script
   "npm run seed" que recree la base y cargue backend/seed/medicamentos_semilla.csv
   con version = 0. Estructura routes/, services/, repositories/.
   Exporta la app de Express separada del listen, para poder testearla.
3. Endpoints de MODELO_DE_DATOS.md §3 solo como esqueleto (responden 501),
   excepto GET /api/health, que responde { ok: true }.
4. Front: layout accesible (letra >= 18px, alto contraste, navegable con teclado)
   con rutas "/" (buscador) y "/backoffice". Proxy de Vite hacia /api.
5. Desde la raíz deben funcionar: npm install, npm run seed, npm run dev
   (levanta backend y front juntos) y npm test. Usa el .gitignore y el
   .env.example que ya existen. Escribe el README con esos pasos, qué datos son
   sintéticos y qué está simulado (token del backoffice).
6. Verifica que levante y que npm test pase con un test de /api/health.
   Abre el PR hacia main con "Refs #1 #2 #3".

No implementes la lógica de las historias. No uses datos reales.
```

---

## Prompts B — Una historia por pareja (mañana, en paralelo)

Cada pareja parte desde `main` actualizado (`git pull`) y usa **solo** su prompt.

### B1 · US-02 Buscar medicamento (Martín + Vicente P.)

```
Lee CLAUDE.md y docs/sprint-1/META_Y_BACKLOG.md. Implementa US-02 (issue #1,
sub-issues #6 a #10) en la rama "feat/US-02-busqueda".
- GET /api/medicamentos?q= según MODELO_DE_DATOS.md §3: búsqueda parcial,
  sin distinguir mayúsculas ni tildes, sobre la columna busqueda.
- Pantalla "/": buscador grande, tarjetas con nombre, presentación, precio y stock;
  mensaje claro si no hay resultados; etiqueta "Sin stock" y sin botón de compra
  cuando stock = 0. Deja un botón "Comprar" que lleve a /comprar/:codigo
  (esa pantalla la hace US-15).
- Un test por cada escenario Gherkin de US-02, más "losartan" vs "Losartán"
  y búsqueda por principio activo.
Un commit por sub-issue con "(#N)". Corre npm test, verifica en el navegador y abre
el PR con "Closes #6 #7 #8 #9 #10". No toques archivos de otras historias.
```

### B2 · US-13 Mantener stock (Benjamín E. + Benjamín H.)

```
Lee CLAUDE.md y docs/sprint-1/META_Y_BACKLOG.md. Implementa US-13 (issue #2,
sub-issues #11 a #14) en la rama "feat/US-13-backoffice".
- GET y PUT /api/backoffice/medicamentos según MODELO_DE_DATOS.md §3, protegidos
  con el header x-backoffice-token (valor de BACKOFFICE_TOKEN en .env).
- Validaciones: stock entero >= 0, precio entero > 0. Si algo es inválido no se
  guarda nada y se responde 400 con el motivo por campo.
- Control de versión de MODELO_DE_DATOS.md §5: si la versión cambió, 409.
- Pantalla "/backoffice": pide el token, lista medicamentos con precio y stock
  editables, confirma el cambio y muestra los errores junto al campo.
- Un test por cada escenario Gherkin de US-13, más el caso 409 de versión y el 401.
Un commit por sub-issue con "(#N)". Corre npm test y abre el PR con
"Closes #11 #12 #13 #14". No toques archivos de otras historias.
```

### B3 · US-15 Realizar compra (Vicente C. + Martín)

```
Lee CLAUDE.md y docs/sprint-1/META_Y_BACKLOG.md. Implementa US-15 (issue #3,
sub-issues #15 a #20) en la rama "feat/US-15-compra".
- POST /api/pedidos según MODELO_DE_DATOS.md §3 y §4: descuento con
  UPDATE ... WHERE stock >= ? e INSERT del pedido en la misma transacción.
  Precio y total se calculan en el servidor. Estado inicial "Solicitud creada".
- Pantalla "/comprar/:codigo": selector de cantidad con el total a la vista y
  botón confirmar. Pantalla de resultado: número de pedido, medicamento, cantidad,
  total y estado; o mensaje claro "ya no hay stock disponible".
- Tests: escenario feliz, stock insuficiente, y los dos escenarios de concurrencia
  sobre PRB-001 y PRB-002. Para la concurrencia levanta el servidor en un puerto
  real y lanza 20 peticiones con Promise.all: exactamente 1 confirmada, stock final 0
  y un solo pedido en la tabla. En la variante: nunca stock negativo.
Un commit por sub-issue con "(#N)". Corre npm test y abre el PR con
"Closes #15 #16 #17 #18 #19 #20". No toques archivos de otras historias.
```

---

## Prompt C — UML del alcance (jueves)

```
Lee CLAUDE.md y el código actual. Crea en docs/uml/ los 4 diagramas del alcance
del Sprint 1 en PlantUML (.puml) y un .md con un párrafo que explique cada uno:
casos de uso (actores Vecina y Funcionaria de backoffice), clases de diseño
(con los nombres reales de routes, services y repositories), secuencia de la
compra con fragmento alt para "sin stock", y componentes y despliegue
(navegador, backend Express, SQLite). Usa exactamente los nombres del código.
Solo lo que existe en el Sprint 1. Abre el PR "docs/uml-sprint1".
```

---

## Prompt D — Revisión antes de la demo (jueves)

```
Revisa el repo completo contra docs/sprint-1/META_Y_BACKLOG.md y la Definition of
Done de CLAUDE.md. Dime, historia por historia, qué escenarios Gherkin tienen test
y pasan, qué falta, si hay secretos o datos reales en el repo, y si el README
permite levantar todo en una máquina limpia. No cambies nada: solo repórtalo.
```
