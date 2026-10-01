# Trazabilidad y verificación — #11 (US-13), #17 (US-15), #7, #8, #9 y #10 (US-02)

> Evidencia de que cada criterio de aceptación del Sprint 1 tiene una comprobación concreta.
> Datos 100% sintéticos. Última actualización: 2026-09-30.

Leyenda de estado: ✅ comprobado · ⏳ pendiente · ➡️ lo cubre otra tarea.

## 1. Matriz: criterio → comprobación

| Criterio (fuente) | Comprobación | Tipo | Tarea | Estado |
|---|---|---|---|---|
| US-13 feliz: el cambio se guarda (Gherkin del issue #2) | `backend/tests/backofficeApi.test.js` → «escenario feliz: el cambio queda guardado» | automático | #11 | ✅ |
| US-13 feliz: aparece de inmediato para la vecina | mismo archivo → «el cambio se ve de inmediato en lo que consulta la vecina» (vía `POST /api/pedidos`, que lee precio y stock en vivo) + `backend/tests/medicamentosApi.test.js` → «refleja al instante un cambio de precio y stock hecho en el backoffice» (vía la búsqueda, #7). De punta a punta con la búsqueda: `backend/tests/us13-mantener-stock.funcional.test.js` → «Escenario feliz» (precio, stock, stock 0, reponer, ambos a la vez). El panel (`/backoffice`) lo hace #13 | automático | #11, #7, #14 | ✅ compra, búsqueda y punta a punta · ➡️ panel en #13 |
| US-13 error: rechaza, informa el motivo y mantiene el valor anterior | mismo archivo → «escenario de error: valor inválido…» (18 valores inválidos, incluidos enormes y sobre los topes; campo válido + inválido, cuerpo vacío, sin cuerpo; topes exactos aceptados y guardados como enteros) | automático | #11 | ✅ |
| Regla 3: el stock nunca queda negativo | casos `stock` `-1` y decimal + CHECK de la tabla | automático | #11 | ✅ |
| Regla 5: token simulado desde `.env`, declarado en el README | «token simulado del backoffice» (401 sin token / incorrecto / vacío / servidor sin token; 401 antes que 400 y 404) + README | automático | #11 | ✅ |
| Regla 6: mensajes en español simple, sin códigos | «los mensajes son texto simple en español…» | automático | #11 | ✅ |
| El `PUT` solo toca el medicamento indicado | «solo modifica el medicamento indicado…» | automático | #11 | ✅ |
| JSON mal formado responde 400, no 500 | `backend/tests/jsonInvalido.test.js` | automático | #11 | ✅ |
| US-02 feliz: por nombre o principio activo se ve nombre oficial, dosificación, precio y disponibilidad | `backend/tests/us02-busqueda.funcional.test.js` → «Escenario feliz» con «Losartán» y «Losartán potásico» | automático | #7, #10 | ✅ |
| US-02 error sin coincidencias: se informa claramente | mismo archivo → «Escenario de error — sin coincidencias» (`resultados: []` + `mensaje` en español) | automático | #7, #10 | ✅ |
| US-02 error sin stock (backend): aparece como no disponible y no se puede comprar | mismo archivo → «Escenario de error — sin stock» (`disponible: false` y `POST /api/pedidos` responde 409) | automático | #7, #10 | ✅ · ➡️ pantalla en #9 |
| Regla 4: búsqueda sin distinguir mayúsculas ni tildes («Losartan» = «Losartán»), parcial y por principio activo | mismo archivo + `backend/tests/medicamentosApi.test.js` (mayúsculas, tildes, espacios, parcial, varias palabras, `%`/`_` literales, inactivos, `q` corto/repetido/largo → 400) | automático | #7, #10 | ✅ |
| La columna `busqueda` de la semilla coincide con la normalización del servidor | `medicamentosApi.test.js` → «coincide con la columna busqueda de toda la semilla» | automático | #6, #7 | ✅ |
| US-02 feliz (pantalla): tarjetas con nombre oficial y dosificación, principio activo, precio y disponibilidad | `frontend/src/pages/Buscador.test.tsx` → «#8 escenario feliz…» | automático | #8 | ✅ |
| US-02 sin coincidencias (pantalla): mensaje claro en vez de pantalla vacía | mismo archivo → «#9 sin coincidencias» | automático | #9 | ✅ |
| US-02 sin stock (pantalla): etiqueta «Sin stock» visible y sin botón de compra | mismo archivo → «#9 sin stock» (también en una lista mixta) | automático | #9 | ✅ |
| Pantalla de búsqueda: estados cargando y error (400 con mensaje del backend, sin conexión, 500) en español, sin códigos | mismo archivo → «mientras espera…» y «errores» | automático | #8, #9 | ✅ |
| Pantalla de búsqueda solo con teclado (Enter busca, Tab llega a «Elegir cantidad», el foco vuelve a la tarjeta) | mismo archivo → «solo con teclado…» | automático | #8 | ✅ |
| Concurrencia de US-15 no se rompe (Gherkin del issue #3) | `backend/tests/us15-concurrencia.test.js` se ejecuta en cada `npm test` | regresión | #11, #17 | ✅ |
| US-15 «elegir cantidad» con total a la vista | `frontend/src/components/SelectorCantidad.test.tsx` → «escenario feliz…» | automático | #17 | ✅ |
| US-15 cantidad fuera de rango se informa y no deja continuar | mismo archivo → «escenario de error: cantidad inválida» (0, 25, 1.5, vacío, máximo real según stock) | automático | #17 | ✅ |
| US-02 sin stock: se dice «sin stock» y no se ofrece comprar | mismo archivo → «estado sin stock» | automático | #17 | ✅ |
| Front: solo teclado (Tab, Enter, flechas), letra ≥ 18 px, contraste, zoom 200 % | mismo archivo → «uso solo con teclado» + prueba en navegador real (sección 2b) | automático + navegador | #17 | ✅ |
| Regla 1: precio y total los calcula el backend | `onContinuar` se prueba con `toHaveBeenCalledWith(2)`: entrega solo la cantidad, nunca precio ni total; el total del selector es informativo y así se dice en pantalla. Regresión: `pedidosApi.test.js` | automático | #17 | ✅ |
| El selector se conecta a la pantalla de búsqueda y a la confirmación | `frontend/src/pages/Buscador.test.tsx` → «elegir un medicamento disponible…» (búsqueda → selector → volver) y «#18 confirmar el pedido» (selector → confirmación) | automático | #8 → #18 | ✅ búsqueda · ✅ confirmación (#18) |
| #18 US-15 feliz: con el resumen delante, confirma y ve el pedido con número, medicamento, cantidad, total y estado «Solicitud creada»; el stock se descuenta | `frontend/src/components/ConfirmarPedido.test.tsx` → «escenario feliz…» y `Buscador.test.tsx` → «escenario feliz: confirma y ve el pedido…»; el descuento atómico lo prueban `backend/tests/us15-compra.funcional.test.js` y se comprobó en vivo (sección 2e) | automático + navegador | #18 | ✅ |
| #18 US-15 error: sin stock suficiente (409) no se crea el pedido, se muestra el mensaje del sistema y «No se creó ningún pedido.»; solo se ofrece volver a los resultados, que se refrescan con la búsqueda original y llevan el foco a la lista; 404 y 400 igual | `ConfirmarPedido.test.tsx` → «escenario de error…» y `Buscador.test.tsx` → «sin stock al confirmar…», «al refrescar tras un rechazo repite la búsqueda original…» | automático + navegador | #18 | ✅ |
| #18 Regla 1: el cliente envía solo `{ codigo, cantidad }` con `Content-Type: application/json` (sin esa cabecera el backend leería el cuerpo vacío); el precio y el total que se ven al terminar son los del backend, no el estimado | `ConfirmarPedido.test.tsx` → «envía solo el código y la cantidad…», «el total y el precio que se muestran son los que calculó el backend…» | automático | #18 | ✅ |
| #18 sin pedidos duplicados: doble clic o Enter repetido, «Intentar de nuevo» con doble clic, ningún botón de confirmar tras el éxito, y un 201 que no se puede leer no ofrece reintentar (el pedido pudo crearse) | `ConfirmarPedido.test.tsx` → «mientras confirma…», «Intentar de nuevo también está protegido…», «tras crear el pedido ya no se puede confirmar otra vez», «un 201 … NO ofrece reintentar» | automático | #18 | ✅ (ver limitación abajo) |
| #18 estados y teclado: confirmando, éxito, rechazado, error de conexión o 500 (sin códigos); el buscador no se mueve mientras se confirma; foco a la confirmación al abrir y al terminar; Enter confirma; ciclo completo solo con teclado; el éxito se anuncia con el número de pedido; letra ≥ 18 px y botones ≥ 56 px | `ConfirmarPedido.test.tsx` y `Buscador.test.tsx` (bloque #18) + navegador real (sección 2e) | automático + navegador | #18 | ✅ |
| US-13 error de punta a punta: la búsqueda sigue mostrando el valor anterior | `us13-mantener-stock.funcional.test.js` → «Escenario de error» (7 valores inválidos: stock negativo, decimal y no numérico; precio vacío, no numérico, cero y enorme) | automático | #14 | ✅ |
| US-13 cambios mientras ocurren ventas: el cambio de precio no pisa el stock y no hay errores | mismo archivo → «Actualización a la vez que varias vecinas compran» (6 procesos con conexiones SQLite propias + el `PUT` en el mismo instante: stock 114, version 7, totales cuadran; y cambio de stock sin stock negativo ni errores) | automático (procesos reales) | #14 | ✅ |
| US-13 una actualización con datos viejos no pisa una venta (409) | `us13-mantener-stock.funcional.test.js` → «una actualización con una versión vieja se rechaza con 409 y no pisa la venta» (con la búsqueda mostrando el stock real), «tras el 409 la funcionaria recarga y guarda con la versión nueva» y, con 3 procesos reales que compran, «…se rechaza con 409 y no las pisa» (stock 114, version 3) | automático (también con procesos reales) | #12, #14 | ✅ |
| #12 el candado: 409 `version_cambiada` y mensaje de §5; no guarda nada (tampoco el precio); aplica también al cambio de solo precio; dos ediciones con la misma versión → la segunda 409; versión futura → 409 | `backend/tests/backofficeApi.test.js` → bloque «candado de version frente a ventas simultáneas (#12)» | automático | #12 | ✅ |
| #12 `version` obligatoria: ausente, negativa, decimal, texto, nula o fuera de rango → 400 con `errores.version`; la validación va antes que el candado y que el 404; inexistente → 404 (no 409) | mismo bloque + «medicamento inexistente» | automático | #12 | ✅ |
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

### Repetición en clon limpio con el código final (2026-09-30)

Clon de `origin/dev` (commit `63d4056`) siguiendo el README: `npm ci`, `cp .env.example .env`, `npm run seed` (34 medicamentos), `npm test` (85 tests del backend y 30 del front, todos verdes), `npm run build` y `npm run dev`. Se repitieron las llamadas de arriba con los topes y los errores 4xx ya corregidos:

| Llamada | Resultado |
|---|---|
| `GET /api/health` por `:5173` | 200 `{ ok: true }` |
| Sin token / token incorrecto | 401 `no_autorizado` |
| Feliz: `precioUnitario: 2100` | 200, version 1 |
| Error: `stock: -5` · `precioUnitario: "abc"` · `precioUnitario: 1e308` | 400 `datos_invalidos`, con el motivo de cada campo |
| Cambio válido de stock a 118 | 200, precio 2100 intacto, version 2 (los rechazos no subieron la version) |
| Compra de 2 unidades por la vecina | 201, total 4200 = 2 × 2100 |
| MED-999 inexistente | 404 `no_existe` |
| JSON roto | 400 `solicitud_invalida` |
| Cuerpo de 200 KB | 413 `solicitud_invalida`, sin cambios en la base |
| Estado final de MED-001 en la base | precio 2100, stock 116 (118 − 2 de la compra), version 3 |

> Las dos tablas anteriores son de #11, anteriores a #12: sus `PUT` no llevan `version`. Con #12 esas mismas llamadas sin `version` responden 400; la repetición con `version` está en la sección 2a.

## 2a. Candado de versión en vivo (#12, 2026-10-01)

`npm run seed` + `npm run dev` con el código de la rama `feat/US-13-version`; peticiones por `http://localhost:5173/api/...`. El token se leyó del `.env` y no se muestra.

| # | Acción | Resultado esperado | Resultado real |
|---|---|---|---|
| 1 | `PUT` a MED-001 con `{ precioUnitario: 2100 }` (sin `version`) | 400, nada guardado | ✅ 400 |
| 2 | **Feliz:** `{ precioUnitario: 2100, version: 0 }` | 200, precio nuevo, version 1 | ✅ 200, precio 2100, version 1 |
| 3 | Compra de 2 unidades (la vecina) | total con el precio nuevo; sube la version a 2 | ✅ 201, total 4200 |
| 4 | **Datos viejos:** `{ stock: 150, version: 0 }` después de la venta | 409, no pisa la venta | ✅ 409 |
| 5 | Recarga y guarda con la version vigente: `{ stock: 150, version: 2 }` | 200, version 3 | ✅ 200, stock 150, version 3 |
| 6 | `PUT` a MED-999 | 404 (no 409) | ✅ 404 |
| 7 | **Error:** `{ stock: -5, version: 3 }` | 400, nada guardado | ✅ 400 |
| 8 | Búsqueda de la vecina («losartan 50») | muestra el valor vigente | ✅ precio 2100, stock 150 |

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

## 2e. Confirmación del pedido en navegador real (#18, 2026-10-01)

Rama `feat/US-15-confirmacion`, `npm run seed` + `npm run dev` y Chrome controlado con Playwright. Capturas locales: resumen, éxito, sin stock y ancho de 500 px.

| Paso | Resultado |
|---|---|
| **Feliz, solo teclado:** «losartan 50» + Enter, Tab hasta «Elegir cantidad» + Enter, «+» y «Continuar con el pedido» con Enter | el foco pasa a la confirmación; resumen: Losartán 50 mg · 2 unidades · $1.990 por unidad · total estimado $3.980 |
| Primer Tab dentro de la confirmación | «Confirmar pedido» |
| Enter en «Confirmar pedido» | «Tu pedido fue creado»: número `P-…`, 2 unidades, total $3.980 y estado «Solicitud creada»; el foco queda en la zona de la confirmación |
| Stock de MED-001 | 120 → 118 (se descontó la compra) |
| «Buscar otro medicamento» | buscador limpio y con el foco en el campo |
| **Última unidad (concurrencia):** `PRB-001` (1 unidad) en el resumen y otra vecina la compra antes de confirmar | 201 para la otra vecina; al confirmar: «Este medicamento ya no tiene stock disponible. No se creó ningún pedido.» con un solo botón, «Volver a los resultados» |
| Stock final de `PRB-001` | 0 (nunca negativo) y un solo pedido |
| «Volver a los resultados» | la lista se vuelve a pedir y la tarjeta ya dice «Sin stock», sin botón de compra |
| Medidas | letra mínima 20 px; «Confirmar pedido» y «Cambiar cantidad» de 64 px |
| Ancho de 500 px (zoom 200 %) | sin scroll horizontal |
| Almacenamiento y consola | `localStorage` y `sessionStorage` vacíos; solo el 409 provocado y el `favicon.ico` (404, ya existía) |

**Limitación conocida (no se puede resolver sin cambiar el backend):** si la conexión se corta *después* de que el backend guardó el pedido, la vecina no ve la respuesta y «Intentar de nuevo» crearía un segundo pedido. El mensaje lo advierte («no sabemos si tu pedido se creó… consulta primero en la farmacia») y un 201 ilegible no ofrece reintentar. Los errores 5xx del backend no tienen este problema: la transacción se revierte. Resolverlo del todo requiere una clave de idempotencia en `POST /api/pedidos`, fuera del alcance del Sprint 1.

## 2c. Flujo integrado búsqueda → selector en navegador real (2026-09-30, noche)

Con `dev` en el commit `895415b` (incluye la búsqueda de Coaffy, #7 y #8), datos del seed, `npm run dev` y Chromium (Playwright). Solo teclado.

| Paso | Resultado |
|---|---|
| Escribir «losartan» y Enter | «Encontramos 2 medicamentos.» (se anuncia en una región viva) |
| Tab hasta «Elegir cantidad» y Enter | el foco pasa a la zona «Elegir cantidad de Losartán 100 mg»; el selector muestra ese medicamento, cantidad 1, total $2.890 |
| «+» dos veces con Enter y «Continuar con el pedido» | cantidad 3, total $8.670, aviso «Elegiste 3 unidades. La confirmación del pedido estará disponible muy pronto.» |
| «Volver a los resultados» | el foco regresa a la tarjeta que se había elegido |
| Elegir otro medicamento (Losartán 50 mg) | la cantidad vuelve a 1 (no arrastra la anterior) |
| Buscar un medicamento sin stock (Fluoxetina, MED-014) | dice «Sin stock» y no hay ningún botón de compra |
| Buscar «zzzzzz» | «No encontramos ese medicamento. Revisa cómo está escrito o prueba buscando por su principio activo.» |
| Zoom 200 % con el selector abierto | sin scroll horizontal |
| Errores de consola | ninguno |

Con esto el criterio de #17 («selector de cantidad desde el resultado de búsqueda, con total a la vista y diseño accesible») queda cumplido en `dev`. La confirmación del pedido es #18.

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
| N1 se usa `isInteger` en vez de `isSafeInteger` en el precio | 3 |
| N2 el stock no tiene tope | 1 |
| N3 el tope de precio permite un peso más | 1 |
| N4 los errores 4xx del cliente vuelven a caer en 500 | 3 |

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

Mutaciones de la pantalla de confirmación (#18). Cuentan los 46 tests de `ConfirmarPedido.test.tsx` y `Buscador.test.tsx`; se aplicaron leyendo y escribiendo en UTF-8:

| Mutación | Tests en rojo |
|---|---|
| E1 sin la cabecera `Content-Type` (hallazgo A1) | 2 |
| E2 se envía un total calculado por el cliente | 3 |
| E3 el éxito muestra el total estimado y no el del backend | 1 |
| E4 se puede confirmar dos veces (sin guardia) | 2 |
| E5 no se refresca la búsqueda tras un rechazo | 5 |
| E6 un rechazo se trata como error reintentable | 5 |
| E7 `disabled` en vez de `aria-disabled` al confirmar | 1 |
| E8 un 201 ilegible ofrece reintentar (hallazgo A1) | 4 |
| E9 cualquier cuerpo 201 se acepta como pedido (hallazgo A1) | 4 |
| E10 el buscador no se bloquea mientras se confirma (hallazgo A1) | 1 |
| E11 la confirmación nunca avisa que está ocupada | 2 |
| E12 el foco no pasa a la confirmación | 4 |
| E13 el selector sigue visible junto a la confirmación (hallazgo A1) | 2 |
| E14 tras un rechazo se ofrece cambiar la cantidad con el stock viejo (hallazgo A1) | 3 |
| E15 «Cambiar cantidad» funciona mientras se confirma | 1 |
| E16 el refresco usa lo que haya en el campo y no la búsqueda original (hallazgo A2) | 1 |
| E17 el aviso de foco queda pendiente si el refresco no trae resultados (hallazgo A2) | 1 |
| E18 el éxito no se anuncia en voz alta (hallazgo A2) | 1 |
| E19 el foco no va a la lista tras refrescar (hallazgo A2) | 1 |

Mutaciones de las pruebas de US-13 de punta a punta (#14):

| Mutación | Tests en rojo |
|---|---|
| P1 `disponible` siempre verdadero en la búsqueda | 2 |
| P2 el `PUT` no persiste el precio | 4 |
| P3 el `UPDATE` del `PUT` sin `WHERE` | 1 |
| P4 cambiar el precio deja el stock en 0 | 2 |
| P5 la búsqueda no refleja el stock real | 5 |

Mutaciones del candado de versión (#12):

| Mutación | Tests en rojo |
|---|---|
| V1 el `UPDATE` sin `AND version` | 7 |
| V2 siempre 404 cuando `changes === 0` | 6 |
| V3 siempre 409 cuando `changes === 0` | 2 |
| V4 el candado solo se aplica cuando viene `stock` | 1 (agregado tras la revisión A1: antes pasaba en verde) |
| V5 `version` deja de ser obligatoria | 11 |
| V6 `version` acepta texto | 7 |
| V7 el cambio no sube `version` | 8 |

## 4. Revisiones con IA (advisor con Opus)

| Punto | Qué se consultó | Resultado |
|---|---|---|
| A1 — tests de #11 antes de implementar | ¿Falta algún escenario del Gherkin? ¿Algún test no puede fallar? | Se quitó `version` del test de campos ignorados (es de #12), se cambió la prueba «lo que verá la búsqueda» por una real vía compra, se eliminó un test que no podía fallar y se agregó «401 antes que 400/404» |
| A2 — implementación de #11 | ¿Fuera de alcance, regresiones, secretos, tests débiles? | Faltaba detectar un `UPDATE` sin `WHERE` (M9): corregido. Se alineó el modelo de datos sobre `version` y el ejemplo del README para PowerShell |
| A1 — tests de #17 antes del componente | ¿Escenarios sin test? ¿Tests que no pueden fallar? | El caso de «1.5» podía pasar por el motivo equivocado (jsdom vacía el campo): se asigna el valor completo y se comprueba. Se agregó que los botones solo aparecen bloqueados en los límites. Las flechas del teclado y las medidas se comprobaron en navegador real (sección 2b) |
| A2 — implementación de #12 | ¿El candado es atómico? ¿Capas, reglas del CLAUDE.md, regresiones, tests frágiles? | Sin hallazgos altos. Se agregó una guarda en el repository (una `version` ausente se enviaría como NULL y parecería un 409) con su test, y la ejecución en vivo con `version` (sección 2a), porque la evidencia de la sección 2 era anterior a #12 |
| A1 — tests de #12 antes de implementar | ¿Falta algún escenario del contrato? ¿Algún test no puede fallar? ¿Son confiables los tests con procesos reales? | Se agregó el 409 para un cambio de solo precio (la mutación V4 pasaba en verde), la validación de `version` antes del 404, que `errores` tenga solo `version`, y que el 409 de «otro medicamento» se compruebe de verdad. Los tests concurrentes con reintentos pasaban con o sin candado: se dejaron como pruebas de robustez y se agregó una prueba con 3 procesos reales que usa una versión vieja |
| A1 — tests de #18 antes de implementar | ¿Escenarios sin test? ¿Tests que no pueden fallar o que fuerzan la estructura? ¿Riesgos funcionales sin cubrir? | Faltaban tres cosas graves: la cabecera `Content-Type: application/json` (sin ella el backend leería el cuerpo vacío y nadie podría comprar), un 201 con forma inesperada (no debe ofrecer reintentar: el pedido ya descontó stock y se crearía otro) y que el buscador no se mueva mientras se confirma (el resultado se perdería). También se decidió que tras un rechazo por stock solo se ofrezca volver a los resultados refrescados (con «Cambiar cantidad» la vecina reabriría el selector con el stock viejo), se protegió «Intentar de nuevo» contra el doble clic, se exigió que el selector desaparezca al abrir el resumen y que cada valor se compruebe dentro de su fila (el total estimado y el del backend valen lo mismo en varios tests) |
| A2 — implementación de #18 | ¿Carreras, pedidos dobles, estados inconsistentes, reglas del CLAUDE.md, choques con el PR #29? | Sin hallazgos que bloquearan. Se corrigió: «Volver a los resultados» repetía la búsqueda con lo que hubiera en el campo (ahora usa la última búsqueda hecha), el aviso de foco podía quedar pendiente si el refresco no traía resultados, el éxito no se anunciaba a lectores de pantalla (ahora hay una región de estado con el número de pedido), «Buscar» se veía activo mientras estaba bloqueado y quedaba una rama sin uso. Queda documentada la limitación del reintento tras un corte de red (sección 2e). Se comprobó con `git merge-tree` que esta rama integra sin conflictos de código con el PR #29 |

### Revisión con contexto limpio (G5)

Un subagente con Opus, que solo vio el diff y los criterios (no la conversación), revisó `dev` contra `main`. Cada hallazgo se verificó antes de actuar:

| Hallazgo | Verificado | Qué se hizo |
|---|---|---|
| Un precio `1e308` o un stock sobre el rango seguro se aceptaba (200), se guardaba como decimal y la compra devolvía `total: null` | Sí: reproducido | Tope de precio (10.000.000) y de stock (1.000.000) con `isSafeInteger`; 6 casos nuevos y los topes exactos comprobados; mutaciones N1–N3 |
| Cuerpo grande, dirección mal codificada o codificación no soportada respondían 500 | Sí: reproducido | El manejador de errores traduce cualquier 4xx del cliente (413, 415, 400); mutación N4 |
| El modelo de datos decía «la autorización va antes que los datos», pero un JSON roto sin token da 400 | Sí | Se precisó en `MODELO_DE_DATOS.md` |
| La tabla de `MODELO_DE_DATOS.md` seguía con `version` obligatoria | Sí | `version?` y nota de que la exige #12 |
| El selector no se reiniciaba al cambiar de medicamento | Sí: test en rojo antes del arreglo | `key` por código |
| Un test del selector comprobaba la etiqueta HTML y no el comportamiento | Sí | Ahora prueba la región en vivo (`role="status"`, `aria-live`) y su texto |
| El selector no está montado en ninguna pantalla | Sí: dependía de #8 | Resuelto: Coaffy lo conectó a la búsqueda en #26 (sección 2c) |
| Comparación del token con `===`, `CANTIDAD_MAXIMA` duplicada en front y back, el `PUT` edita medicamentos inactivos | Sí | Se aceptan como deuda conocida del prototipo (token simulado; máximo espejo comentado; inactivos irrelevantes en el Sprint 1) |

## 5. Nota sobre #12 (resuelta)

Con `AND version = ?` en el `UPDATE`, `changes === 0` significa «no existe» o «la versión cambió» (409). El repository los distingue dentro de la misma transacción (`medicamentosRepository.actualizarPrecioYStock`), así que un conflicto de versión nunca devuelve 404. El panel (#13) debe leer la `version` de cada medicamento (la devuelve el `GET` del backoffice) y enviarla en cada guardado.

## 6. Pendiente de completar

- ~~A3 antes del PR a `main` y verificación en clon limpio de `dev`~~: hechos (A3 con el advisor Opus y clon limpio de `origin/dev` el 2026-09-30).
- **#18 (confirmación del pedido) listo para revisión:** el Gherkin de US-15 se ejecuta completo desde la pantalla (sección 2e). Pasa a Done cuando su PR a `dev` se mergee. Al integrar #18 y #13 (PR de `feat/US-13-panel`), actualizar la línea «Riesgo del Sprint» de esta sección: ya no queda ninguna tarea abierta del Sprint 1.
- **#17 ya se puede cerrar:** el selector está conectado a la búsqueda (#26) y el flujo se verificó con teclado en navegador real (sección 2c). Pasa a Done cuando el PR `dev → main` se mergee. La confirmación del pedido es #18 (Vicenlol09) y no bloquea #17.
- **#14 ya se puede cerrar tras #12.** Hecho: cambio visible en la búsqueda, valores inválidos que dejan el anterior intacto, cambios mientras ocurren ventas y, con #12, la actualización con **datos viejos** (409; el `it.skip` se activó). Pasa a Done cuando el PR de #12 se mergee.
- **Riesgo del Sprint:** #12, #13 y #18 (Vicenlol09) siguen en Backlog. Sin #18 la demostración termina en «La confirmación del pedido estará disponible muy pronto»; sin #13 el Gherkin de US-13 no puede ejecutarse «en el panel de mantención».
