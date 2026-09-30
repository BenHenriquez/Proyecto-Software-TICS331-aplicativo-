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
| US-15 «elegir cantidad» con total a la vista | `SelectorCantidad.test.tsx` | automático | #17 | ⏳ |
| Front: letra ≥ 18 px, contraste, solo teclado, estado «sin stock» | `SelectorCantidad.test.tsx` + prueba manual con teclado | automático + manual | #17 | ⏳ |
| Regla 1: precio y total los calcula el backend | tests existentes de `pedidosApi`; el total del selector es solo informativo | regresión | #17 | ⏳ |
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

## 4. Revisiones con IA (advisor con Opus)

| Punto | Qué se consultó | Resultado |
|---|---|---|
| A1 — tests de #11 antes de implementar | ¿Falta algún escenario del Gherkin? ¿Algún test no puede fallar? | Se quitó `version` del test de campos ignorados (es de #12), se cambió la prueba «lo que verá la búsqueda» por una real vía compra, se eliminó un test que no podía fallar y se agregó «401 antes que 400/404» |
| A2 — implementación de #11 | ¿Fuera de alcance, regresiones, secretos, tests débiles? | Faltaba detectar un `UPDATE` sin `WHERE` (M9): corregido. Se alineó el modelo de datos sobre `version` y el ejemplo del README para PowerShell |

## 5. Nota para #12 (Vicenlol09)

Cuando #12 agregue `AND version = ?` al `UPDATE`, `changes === 0` ya no significará solo «no existe»: también será «la versión cambió» (409). Hay que distinguir ambos casos dentro de la misma transacción para no devolver 404 por un conflicto de versión.

## 6. Pendiente de completar

- Filas de #17 y su comprobación manual con teclado.
- A2 de #17, revisión con contexto limpio (G5) y A3 antes del PR a `main`.
- Verificación en clon limpio de `dev`.
