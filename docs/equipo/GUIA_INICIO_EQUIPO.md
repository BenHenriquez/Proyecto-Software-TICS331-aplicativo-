# Guía de inicio — Equipo BBMVV · FARMAC-IA · Sprint 1

## Qué vamos a construir

Un prototipo donde **una vecina busca un medicamento, ve su precio y stock, lo compra y queda registrado su pedido**. Además, la funcionaria de backoffice puede corregir precio y stock. Todo con datos inventados, para mostrarlo al sponsor en la **Sprint Review del viernes 2 de octubre**.

- Todo el código vive en este repo: backend (Node + SQLite) y front (React).
- Praxsuite queda para el Sprint 2 (ver `docs/adr/ADR-01-backend-sprint1.md`).
- Detalle técnico: `docs/arquitectura/MODELO_DE_DATOS.md`.
- Meta, backlog y criterios: `docs/sprint-1/META_Y_BACKLOG.md`.

## Setup de cada integrante (hoy)

1. **Node.js 20 LTS** (`node -v`). Evitar versiones impares o muy nuevas: la librería de SQLite necesita binarios compatibles.
2. **Git** y cuenta de GitHub agregada como colaboradora del repo (Benjamín H. envía las invitaciones).
3. **VS Code**, y opcionalmente la extensión de Claude Code.
4. Cuando el esqueleto esté en `main`:
   ```bash
   git clone https://github.com/BenHenriquez/Proyecto-Software-TICS331-aplicativo-.git
   cd Proyecto-Software-TICS331-aplicativo-
   cp .env.example .env     # y completar BACKOFFICE_TOKEN con cualquier texto
   npm install
   npm run seed
   npm run dev
   ```

## Reglas de datos y secretos (no negociables)

- **Nunca** pegar claves (`sk_live_…` u otras) en chats, commits o capturas. Si pasa, se revocan ese mismo día.
- **El repo es público:** el Excel de la farmacia nunca se sube (el `.gitignore` ya bloquea `.xls` y `.xlsx`).
- Solo datos sintéticos. Nada de RUT, recetas ni datos de personas.

## Reparto

| Pareja | Historia | Rama | Sub-issues |
|---|---|---|---|
| Martín González + Vicente Pulgar | US-02 Buscar medicamento | `feat/US-02-busqueda` | #6 a #10 |
| Benjamín Espinoza + Benjamín Henríquez | US-13 Mantener stock | `feat/US-13-backoffice` | #11 a #14 |
| Vicente Concha + Martín González | US-15 Realizar compra | `feat/US-15-compra` | #15 a #20 |

Transversal: Benjamín H. (Scrum Master) cuida el tablero y la protección de `main`; Benjamín E. (Product Owner) coordina con Max y Matías y prepara la demo.

## Flujo de trabajo en GitHub

1. Proteger `main`: Settings → Branches → exigir Pull Request y 1 aprobación.
2. Cada pareja trabaja **en su propio computador y con su cuenta**, en la rama de su historia. Así la actividad queda repartida entre los cinco.
3. Commits chicos con el número del issue: `feat(busqueda): mensaje sin resultados (#9)`.
4. Pull Request con `Closes #N`. Lo revisa otra pareja, nunca quien lo escribió.
5. Tablero: mover la tarjeta al empezar, al abrir el PR y solo a Done cuando cumple la DoD.

## Plan hasta la Review

| Día | Qué | Quién |
|---|---|---|
| **Mar 29 (hoy)** | Revocar la clave filtrada · subir estos documentos · Claude Code arma el esqueleto (prompt A) · PR a `main` · mail a Max y Matías | Benjamín H. + revisión de otra persona |
| **Mié 30** | Cada pareja implementa su historia con sus tests (prompts B) · PRs revisados cruzados | Las tres parejas |
| **Jue 1** | Alguien que no programó levanta el repo solo con el README · UML (prompt C) · revisión final (prompt D) · ensayo de la demo con cronómetro | Todos |
| **Vie 2** | Sprint Review con el sponsor | Todos |

## Mail de hoy a los ayudantes

Para Max y Matías, con copia a Romina Torres:

> Somos el equipo BBMVV (caso B, Farmacia Comunitaria). Para el Sprint 1 proponemos un backend propio (Node + SQLite) dentro del repositorio, dejando la integración con Praxsuite para el Sprint 2, porque necesitamos garantizar la prueba de concurrencia que pidió la profesora. ¿Es aceptable? También queremos confirmar si podemos usar el Excel "Maestro de Productos" más adelante o si debemos trabajar solo con datos sintéticos.

## Guion de la demo (máximo 5 minutos)

1. Meta del sprint en una frase.
2. Levantar el proyecto con el comando del README.
3. Buscar "losartan" (sin tilde) → ver precio y stock.
4. Comprar 2 unidades → pedido con total y estado "Solicitud creada".
5. Buscar algo que no existe → mensaje claro.
6. Buscar Fluoxetina (sin stock) → sin botón de compra.
7. Backoffice: cambiar un stock → se ve de inmediato en la búsqueda.
8. Correr en vivo el test de concurrencia.
9. Mostrar tablero, UML y qué quedó pendiente.

## Definition of Ready

Una historia entra a un sprint solo si cumple todo esto. Si falta algo, vuelve al backlog.

1. **Historia** en formato *Como… quiero… para…*, con el actor claro.
2. **Criterios Gherkin** en el issue padre: al menos un escenario feliz y uno de error (Dado / Cuando / Entonces).
3. **Estimada** en puntos (1, 2, 3, 5, 8 o 13) en el campo Estimate del tablero. Una historia de 13 se divide antes de empezar.
4. **Prioridad MoSCoW** en el issue y en `docs/producto/PRODUCT_BACKLOG.md`.
5. **Sub-issues** ligadas a la historia, cada una con una línea de qué entrega.
6. **Dependencias y datos** identificados: solo datos sintéticos y, si cambia el esquema, la nota de que hay que actualizar `MODELO_DE_DATOS.md` y `docs/uml/`.
7. **Sprint y responsables** asignados, y dentro del alcance acordado con el PO.

## Definition of Done

Criterios ejecutados en vivo · merge por PR revisado · sin secretos ni datos reales · UML con los mismos nombres del código · README levanta en máquina limpia · tarjeta en Done · aceptada por el PO municipal. "Casi anda" vuelve al backlog.
