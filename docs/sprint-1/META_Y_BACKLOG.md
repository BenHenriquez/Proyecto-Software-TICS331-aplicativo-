# Sprint 1 — Meta, backlog y criterios de aceptación

## 1.1 Meta

**Al terminar el Sprint 1 podemos demostrar que** una vecina busca un medicamento por nombre o principio activo, conoce su precio y disponibilidad y puede generar una compra/pedido utilizando datos sintéticos; si el medicamento no existe o no tiene stock, el sistema lo informa claramente.

Ciclo observable: buscar medicamento → ver precio/stock → elegir cantidad → confirmar compra → pedido sintético con total y estado inicial (`Solicitud creada`).

Se trabaja íntegramente con datos sintéticos. SAP, Tesorería y Webpay productivo quedan fuera del alcance de este Sprint.

## 1.2 Sprint backlog comprometido

| ID | Historia | Pts | Responsables | ¿DoR? | Estado al cierre |
|---|---|---|---|---|---|
| US-02 | Como vecina, quiero buscar un medicamento por nombre o principio activo para conocer su precio y disponibilidad. | 5 | Martín González + Vicente Pulgar | Sí | **Done** · aceptada el 01/10/2026 |
| US-13 | Como funcionaria de backoffice, quiero actualizar precio y stock para que la información que ve la vecina sea correcta. | 5 | Benjamín Espinoza + Benjamín Henríquez | Sí | **Done** · aceptada el 01/10/2026 |
| US-15 | Como vecina, quiero seleccionar un medicamento disponible, indicar cantidad y confirmar mi pedido para iniciar la compra sin ir presencialmente. | 8 | Vicente Concha + Martín González | Sí | **Done** · aceptada el 01/10/2026 |
| — | US-07 Accesibilidad con lector de pantalla — no comprometida | 8 | — | No (S2) | Backlog S2 |
| — | US-01 Bot de WhatsApp — fuera del alcance de S1 | 5 | — | No | Won't |

| | |
|---|---|
| Capacidad | 90 h (5 personas × 6 h semanales × 3 semanas) |
| Comprometido | 18 pts (5 + 5 + 8). US-15 en 8 pts es una estimación provisoria. |

**Cierre del Sprint 1.** En la Sprint Review del 01/10/2026, el sponsor del proyecto, **Gino Pietro Bencini Muñoz** (Farmacia Comunitaria de Peñalolén), revisó y aceptó los entregables de US-02, US-13 y US-15. Consta en el *Acta de Revisión y Aceptación de Sprint* N°1, firmada digitalmente el 05/10/2026 por el sponsor y por el Product Owner del equipo, Benjamín Espinoza H. El acta se guarda fuera de este repositorio público (tiene firmas). Las tres historias quedaron en Done en el tablero (#1, #2 y #3).

## 1.3 Criterios de aceptación

### US-02 · Consultar medicamento

**Escenario feliz:** Dado que el catálogo sintético contiene Losartán con stock disponible, cuando la vecina lo busca por nombre o principio activo, entonces el sistema muestra su nombre oficial, dosificación, precio unitario y disponibilidad.

**Escenario de error — sin coincidencias:** Dado que la vecina escribe un nombre que no existe en el catálogo, cuando ejecuta la búsqueda, entonces el sistema informa claramente que no encontró el medicamento, en vez de mostrar una planilla o una pantalla vacía.

**Escenario de error — sin stock:** Dado que un medicamento existe en el catálogo pero su stock es 0, cuando la vecina lo busca, entonces el sistema lo muestra indicando explícitamente «sin stock» y no ofrece la opción de comprarlo.

### US-13 · Mantener stock

**Escenario feliz:** Dado que la funcionaria de backoffice está en el panel de mantención, cuando actualiza el precio o el stock de un medicamento y confirma el cambio, entonces el nuevo valor queda persistido y aparece de inmediato en la búsqueda que ve la vecina.

**Escenario de error:** Dado que la funcionaria ingresa un valor inválido (stock negativo, precio vacío o no numérico), cuando intenta guardar, entonces el sistema rechaza el cambio, informa el motivo y mantiene el valor anterior sin modificar.

### US-15 · Realizar compra/pedido

**Escenario feliz:** Dado que Losartán tiene stock disponible, cuando la vecina selecciona una cantidad y confirma la compra, entonces el sistema crea un pedido con medicamento, cantidad, total y estado inicial, y descuenta esa cantidad del stock.

**Escenario de error:** Dado que el medicamento no tiene stock suficiente para la cantidad solicitada, cuando la vecina intenta confirmar la compra, entonces el sistema no crea el pedido y le informa claramente la indisponibilidad.

**Escenario de concurrencia — última unidad:**
Dado que existe 1 unidad disponible de Losartán
Y que dos vecinas están realizando una compra del mismo medicamento en paralelo
Cuando ambas intentan confirmar la compra de 1 unidad prácticamente al mismo tiempo
Entonces solo una de las dos compras debe ser confirmada
Y la otra debe ser rechazada indicando que el medicamento ya no tiene stock disponible
Y el stock final debe quedar en 0
Y el stock nunca puede quedar en −1
Y no deben generarse dos pedidos confirmados para una única unidad disponible.

**Escenario de concurrencia — cantidades parciales:**
Dado que quedan 2 unidades de un medicamento
Cuando una vecina intenta comprar 2 unidades y otra intenta comprar 1 al mismo tiempo
Entonces solo debe confirmarse una combinación de compras compatible con el stock disponible
Y en ningún caso el stock puede quedar negativo.

## Pendientes para dejar el tablero consistente

- Sub-issue #15: cambiar "Pendiente de pago" por **"Solicitud creada"**.
- US-14 (alerta con IA) queda fuera del Sprint 1.
