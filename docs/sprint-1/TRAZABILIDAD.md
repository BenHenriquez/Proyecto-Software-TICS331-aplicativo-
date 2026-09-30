# Trazabilidad y verificación — #11 (US-13) y #17 (US-15)

> Evidencia de que cada criterio de aceptación del Sprint 1 tiene una comprobación concreta.
> Datos 100% sintéticos. Última actualización: 2026-09-30.

Leyenda de estado: ✅ comprobado · ⏳ pendiente · ➡️ lo cubre otra tarea.

## 1. Matriz: criterio → comprobación

| Criterio (fuente) | Comprobación | Tipo | Tarea | Estado |
|---|---|---|---|---|
| US-13 feliz: el cambio se guarda (Gherkin del issue #2) | `backend/tests/backofficeApi.test.js` → «escenario feliz: el cambio queda guardado» | automático | #11 | ✅ |
| US-13 feliz: aparece de inmediato para la vecina | mismo archivo → «el cambio se ve de inmediato en lo que consulta la vecina» (vía `POST /api/pedidos`, que lee precio y stock en vivo). **La búsqueda (#7) aún no existe**: se cubre en #14 | automático parcial | #11 → #14 | ✅ vía compra · ➡️ búsqueda en #14 |
| US-13 error: rechaza, informa el motivo y mantiene el valor anterior | mismo archivo → «escenario de error: valor inválido…» (12 valores inválidos, campo válido + inválido, cuerpo vacío, sin cuerpo) | automático | #11 | ✅ |
| Regla 3: el stock nunca queda negativo | casos `stock` `-1` y decimal + CHECK de la tabla | automático | #11 | ✅ |
| Regla 5: token simulado desde `.env`, declarado en el README | «token simulado del backoffice» (401 sin token / incorrecto / vacío / servidor sin token; 401 antes que 400 y 404) + README | automático | #11 | ✅ |
| Regla 6: mensajes en español simple, sin códigos | «los mensajes son texto simple en español…» | automático | #11 | ✅ |
| El `PUT` solo toca el medicamento indicado | «solo modifica el medicamento indicado…» | automático | #11 | ✅ |
| JSON mal formado responde 400, no 500 | `backend/tests/jsonInvalido.test.js` | automático | #11 | ✅ |
| Concurrencia de US-15 no se rompe (Gherkin del issue #3) | `backend/tests/us15-concurrencia.test.js` se ejecuta en cada `npm test` | regresión | #11, #17 | ✅ |
| US-15 «elegir cantidad» con total a la vista | `frontend/src/components/SelectorCantidad.test.tsx` → «escenario feliz…» | automático | #17 | ✅ |
| US-15 cantidad fuera de rango se informa y no deja continuar | mismo archivo → «escenario de error: cantidad inválida» (0, 25, 1.5, vacío, máximo real según stock) | automático | #17 | ✅ |
| US-02 sin stock: se dice «sin stock» y no se ofrece comprar | mismo archivo → «estado sin stock» | automático | #17 | ✅ |
| Front: solo teclado (Tab, Enter, flechas), letra ≥ 18 px, contraste, zoom 200 % | mismo archivo → «uso solo con teclado» + prueba en navegador real (sección 2b) | automático + navegador | #17 | ✅ |
| Regla 1: precio y total los calcula el backend | `onContinuar` se prueba con `toHaveBeenCalledWith(2)`: entrega solo la cantidad, nunca precio ni total; el total del selector es informativo y así se dice en pantalla. Regresión: `pedidosApi.test.js` | automático | #17 | ✅ |
| El selector se conecta a la pantalla de búsqueda y a la confirmación | pendiente de #8 (búsqueda) y #18 (confirmación) | integración | #8, #18 | ➡️ |
| Fuera de alcance del Sprint 1 (Praxsuite, WhatsApp, IA…) | revisión del diff | revisión | todas | ⏳ al abrir el PR |

## 2. Ejecución en vivo del Gherkin de US-13 (2026-09-30)

`npm run seed` + `npm run dev`; peticiones por `http://localhost:5173/api/...` (a través del proxy de Vite). El token del `.env` no se muestra en ningún registro.

| # | Acción | Resultado esperado | Resultado real |
|---|---|---|---|
| 1 | `PUT` a MED-001 sin token | 401 | ✅ 401 `no_autorizado` |
| 2 | `PUT` con token incorrecto | 401 | ✅ 401 `no_autorizado` |
| 3 | **Feliz:** `{ precioUnitario: 2100 }` con token | 200, precio nuevo, version 1 | ✅ 200, precio 2100, version 1 |
| 4 | **Error:** `{ stock: -5 }` | 400, motivo, nada guardado | ✅ 400 `datos_invalidos`, `errores.stock` |
| 5 | **Error:** `{ precioUnitario: "abc" }` | 400, motivo, nada guardado | ✅ 400 `datos_invalidos`, `errores.precioUnitario` |
| 6 | Cambio válido de stock (`118`) | el precio 2100 y la version no cambiaron por los rechazos | ✅ precio 2100; version 2 (solo subió por el cambio válido) |
| 7 | Compra de 2 unidades de MED-001 (la vecina) | total con el precio nuevo | ✅ 201, total 4200 = 2 × 2100 |
| 8 | `PUT` a MED-999 | 404 | ✅ 404 `no_existe` |
| 9 | `PUT` con JSON roto | 400 (no 500) | ✅ 400 `solicitud_invalida` |

## 2b. Selector de cantidad en navegador real (2026-09-30)

Componente montado temporalmente en la página de búsqueda (sin commitear) y probado con Chromium (Playwright). Capturas locales: estado normal, cantidad inválida y zoom 200 %.

| Comprobación | Resultado |
|---|---|
| Primer Tab desde la carga | llega a «Saltar al contenido» (el foco no se roba al cargar) |
| Orden de Tab dentro del selector | «−» → campo → «+» → «Continuar con el pedido» |
| Flechas ↑ ↓ en el campo | suben y bajan la cantidad y el total (2 × ↑ → 3 unidades, $4.470) |
| 25 × Enter sobre «+» | llega a 20, el foco **sigue en «+»** y queda `aria-disabled="true"` |
| Cantidad 0 | alerta «Elige una cantidad entre 1 y 20.», total «—», «Continuar» deshabilitado |
| Tamaños | base 20 px; botones «−»/«+» 64 × 64 px; campo 64 px; «Continuar» 64 px; total 36 px |
| Contraste | texto 18,9:1; «Continuar» 11,4:1; «Sin stock» 12,6:1; botón apagado 9,2:1 (mínimo exigido 7:1) |
| Zoom 200 % (ventana de 550 px) | sin scroll horizontal |
| Errores de consola | ninguno |

Pendiente para una persona del equipo: probarlo con lector de pantalla (queda para US-07, fuera del Sprint 1) y con una persona usuaria real.

## 3. Los tests pueden fallar (mutaciones, sin commitear)

Se rompió el código a propósito y se comprobó que al menos un test se pone rojo. Después se restauró el código original.

| Mutación | Tests en rojo |
|---|---|
| M1 el stock acepta cualquier valor | 7 |
| M2 el precio acepta 0 y negativos | 4 |
| M3 no se sube `version` | 5 |
| M4 un token vacío autoriza | 1 |
| M5 nunca se valida | 18 |
| M6 el precio no se guarda | 4 |
| M7 el stock acepta decimales | 1 |
| M8 no se revisa el token | 4 |
| M9 el `UPDATE` sin `WHERE` (pisa todo el catálogo) | 1 (detectada tras agregar el test de aislamiento; antes pasaba en verde) |

Hallazgo: los primeros tests no detectaban M9. Se agregó «solo modifica el medicamento indicado…» y se repitió la mutación.

Mutaciones del selector de cantidad (#17):

| Mutación | Tests en rojo |
|---|---|
| S1 acepta decimales | 1 |
| S2 los botones siempre aparecen bloqueados | 1 |
| S3 el máximo ignora el stock | 5 |
| S4 el máximo ignora el tope de 20 | 4 |
| S5 el total queda fijo en precio × 1 | 3 |
| S6 entrega el total en vez de la cantidad | 2 |
| S7 acepta cantidad 0 | 2 |
| S8 sin stock sigue mostrando el selector | 1 |

## 4. Revisiones con IA (advisor con Opus)

| Punto | Qué se consultó | Resultado |
|---|---|---|
| A1 — tests de #11 antes de implementar | ¿Falta algún escenario del Gherkin? ¿Algún test no puede fallar? | Se quitó `version` del test de campos ignorados (es de #12), se cambió la prueba «lo que verá la búsqueda» por una real vía compra, se eliminó un test que no podía fallar y se agregó «401 antes que 400/404» |
| A2 — implementación de #11 | ¿Fuera de alcance, regresiones, secretos, tests débiles? | Faltaba detectar un `UPDATE` sin `WHERE` (M9): corregido. Se alineó el modelo de datos sobre `version` y el ejemplo del README para PowerShell |
| A1 — tests de #17 antes del componente | ¿Escenarios sin test? ¿Tests que no pueden fallar? | El caso de «1.5» podía pasar por el motivo equivocado (jsdom vacía el campo): se asigna el valor completo y se comprueba. Se agregó que los botones solo aparecen bloqueados en los límites. Las flechas del teclado y las medidas se comprobaron en navegador real (sección 2b) |

## 5. Nota para #12 (Vicenlol09)

Cuando #12 agregue `AND version = ?` al `UPDATE`, `changes === 0` ya no significará solo «no existe»: también será «la versión cambió» (409). Hay que distinguir ambos casos dentro de la misma transacción para no devolver 404 por un conflicto de versión.

## 6. Pendiente de completar

- Revisión con contexto limpio (G5) y A3 antes del PR a `main`.
- Verificación en clon limpio de `dev`.
- Conectar el selector a la búsqueda (#8) y a la confirmación (#18).
