# Product Backlog v1 — FARMAC-IA (TICS331 · Equipo BBMVV)

> Fuente: planilla `Planilla_Inception_TICS331_2026-2` (US-01 a US-12), más las historias que el equipo ya trabaja en el Sprint 1 (US-13, US-14, US-15) y dos historias nuevas (US-16, US-17).
> El ID es el mismo del tablero. Escala de puntos: 1, 2, 3, 5, 8, 13. Todos los datos del prototipo son sintéticos.
>
> Este archivo es el backlog del **producto**. El compromiso del Sprint 1 está en `docs/sprint-1/META_Y_BACKLOG.md`.

Leyenda de estado: **Ready** (cumple la Definition of Ready) · **Backlog** (sin sprint asignado) · **Por definir** (falta decisión del equipo / PO).

## 1. Resumen

| ID | Historia (resumen) | Actor | MoSCoW | Pts | Sprint | Estado |
|---|---|---|---|---|---|---|
| US-01 | Consultar por WhatsApp stock, precio y estado del pedido de delivery | Vecino | Should | 5 | Sprint 1 (en la planilla); fuera del alcance de S1 según `META_Y_BACKLOG.md` | Ready |
| US-02 | Buscar un medicamento por nombre o principio activo | Vecino | Must | 5 | Sprint 1 | Ready |
| US-03 | Pagar por Webpay con validación en tiempo real | Vecino | Must | 8 | Sprint 2 | Ready |
| US-04 | Ver en la web el estado actualizado del pedido a domicilio | Vecino | Must | 3 | Sprint 3 | Ready |
| US-05 | Pronóstico de demanda con el historial 2021-2025 | Bodega | Should | 13 | Backlog | Backlog |
| US-06 | Alerta de medicamentos por vencer en bodega | Farmacéutica | Should | 5 | Sprint 1 (en la planilla) | Ready |
| US-07 | Sitio compatible con lectores de pantalla (WCAG 2.1 AA) | Vecino | Must | 8 | Sprint 2 | Ready |
| US-08 | Validación automática de pagos en línea | Tesorería | Must | 5 | Sprint 2 | Ready |
| US-09 | Ruta optimizada automática para el repartidor | Despacho | Must | 8 | Backlog | Backlog |
| US-10 | Rebajar inventario y actualizar despacho al confirmar una venta | Farmacia | Should | 5 | Sprint 1 (en la planilla) | Ready |
| US-11 | Retiro de medicamentos por un cuidador registrado | Cuidador | Must | 5 | Sprint 2 | Ready |
| US-12 | Escanear el pedido antes de entregarlo | Despacho | Should | 3 | Backlog | Backlog |
| US-13 | Mantener stock: actualizar precio y stock (backoffice) | Funcionaria de backoffice | — | 5 | Sprint 1 | Ready |
| US-14 | Alerta con IA | — | — | — | Fuera del Sprint 1 | Backlog |
| US-15 | Realizar compra/pedido | Vecina | — | 8 | Sprint 1 | Ready |
| US-16 | Carrito de compras con varios medicamentos y un solo pedido | Vecino | Must | 3 | Por definir | Implementada (PR #50); falta aceptación del PO |
| US-17 | Ingresar con un QR de Neuro-Access y ver mis pedidos | Vecino | Must | 8 | Por definir | Implementada (PR #57); falta aceptación del PO |

Notas sobre la tabla:

- US-13, US-14 y US-15 no figuran en la planilla de Inception; vienen del tablero y de `docs/sprint-1/META_Y_BACKLOG.md`. Su MoSCoW no está definido en esas fuentes; hay que confirmarlo.
- US-14 solo se conoce por el título «alerta con IA» (`META_Y_BACKLOG.md`). Falta su historia.
- La planilla asigna US-01, US-06 y US-10 al Sprint 1, pero el Sprint 1 comprometido es US-02, US-13 y US-15 (18 pts). **Decisión pendiente:** reasignar sprint a US-01, US-06 y US-10 en la planilla, o dejarlas fuera del Sprint 1 como en `META_Y_BACKLOG.md`.
- US-16 (Must, 3 pts) y US-17 (Must, 8 pts) se estimaron después de implementarlas (estimación retroactiva del 2026-10-08). Falta asignarles sprint.

## 2. Detalle de las historias

### US-01 · Consultar por WhatsApp (Should · 5 pts)

**Historia:** Como vecino inscrito en la Farmacia Comunitaria, quiero consultar por WhatsApp si hay stock de un medicamento, su precio y el estado de mi pedido de delivery, para no depender de que un funcionario me responda manualmente y obtener información al instante.

**Criterios (Given/When/Then):** Dado que un vecino inicia una conversación en el canal de WhatsApp de la Farmacia Comunitaria, cuando el asistente virtual solicita su identificación e ingresa su RUT, entonces el sistema debe verificar en la base de datos de inscritos que el usuario esté activo en el catastro municipal. Y si no está registrado, el bot debe informarle amablemente que no figura inscrito y proporcionarle el enlace al formulario web para registrarse en línea.

**Notas / RNF / dependencia:** Privacidad de datos (GDPR / Ley 19.628). Depende de la API de WhatsApp Business y de la base de datos de inscritos municipales.

### US-02 · Buscar un medicamento (Must · 5 pts)

**Historia:** Como vecino (incluyendo adultos mayores) que visita el sitio web de la farmacia, quiero buscar un medicamento por nombre o principio activo en un buscador simple, para encontrar rápidamente si está disponible sin tener que revisar un archivo Excel estático.

**Criterios (Given/When/Then):** Dado que el vecino visita el sitio web de la farmacia y accede al buscador, cuando escribe el nombre comercial o el principio activo del producto (ej. Losartán, Pregabalina, Melatonina), entonces el sistema debe conectarse a la base de inventario en tiempo real y responder con:
- Nombre oficial y dosificación del fármaco.
- Disponibilidad de stock (ej. «Disponible» o «Sin stock / Quiebre temporal»).
- Precio unitario vigente al vecino.

Y si no hay coincidencias exactas, debe sugerir principios activos o presentaciones similares disponibles.

**Notas / RNF / dependencia:** Accesibilidad web (adulto mayor). Interfaz ultra simplificada. Depende de la base de datos de inventario en tiempo real.

> Los criterios del Sprint 1 (escenario feliz, sin coincidencias y sin stock) están en `docs/sprint-1/META_Y_BACKLOG.md`.

### US-03 · Pagar por Webpay (Must · 8 pts)

**Historia:** Como vecino que realiza un pedido en línea, quiero pagar directamente por Webpay y que mi pago se valide en tiempo real, para que mi pedido pase a preparación de inmediato sin esperar días la validación manual de Tesorería.

**Criterios (Given/When/Then):** Dado que el vecino está en la pasarela de pago del sitio web, cuando procesa el pago de forma exitosa a través de Webpay Transbank, entonces el sistema debe validar el pago en tiempo real, emitir el comprobante y cambiar el estado del pedido automáticamente a «Validación de pago».

**Notas / RNF / dependencia:** Integración con API Webpay Plus (Transbank). Dependencia crítica con US-08 (Validación en Tesorería).

### US-04 · Seguimiento del pedido en la web (Must · 3 pts)

**Historia:** Como vecino que solicitó despacho a domicilio, quiero ver en la web el estado actualizado de mi pedido (Validación de pago, En preparación, En ruta, Entregado), para saber cuándo llegará mi pedido sin tener que preguntar por WhatsApp.

**Criterios (Given/When/Then):** Dado que el vecino tiene una orden de compra con despacho a domicilio en curso, cuando ingresa a la sección de seguimiento web e introduce su RUT o número de ticket/boleta, entonces el sistema debe retornar el estado exacto del pedido sincronizado con el flujo logístico: «Validación de pago», «En preparación», «En ruta» (indicando fecha estimada o rango horario) o «Entregado».

**Notas / RNF / dependencia:** Depende de la actualización logística de US-10 y del módulo de despacho.

### US-05 · Pronóstico de demanda (Should · 13 pts)

**Historia:** Como encargado de bodega/compras de la Cormup, quiero contar con un modelo de pronóstico de demanda basado en el historial 2021-2025, para anticipar la estacionalidad de consumo de pacientes crónicos y evitar quiebres de stock.

**Criterios (Given/When/Then):** Dado que el encargado de bodega ingresa al módulo de compras de la Cormup, cuando selecciona un fármaco crónico y el periodo a proyectar, entonces el sistema debe procesar los datos históricos (2021-2025) y desplegar un gráfico de proyección mensual con un margen de error inferior al 15 %, alertando sobre meses con alta estacionalidad.

**Notas / RNF / dependencia:** Algoritmo de series de tiempo (ej. Prophet o ARIMA). Se requiere calidad y limpieza de los datos históricos.

### US-06 · Alerta de vencimiento (Should · 5 pts)

**Historia:** Como farmacéutico, quiero que el sistema me alerte cuando un medicamento está por vencer en bodega, para priorizar su dispensación antes de que se pierda o ya descartarlo.

**Criterios (Given/When/Then):** Dado que existen lotes de medicamentos en bodega, cuando falten menos de 60 días para la fecha de vencimiento, entonces el sistema debe generar una alerta diaria visual en el panel del farmacéutico y enviar un correo con el listado de lotes críticos para priorizar su dispensación FEFO (First Expired, First Out).

**Notas / RNF / dependencia:** Módulo de gestión de lotes. Umbral de días configurable (ej. 30, 60, 90).

### US-07 · Lectores de pantalla (Must · 8 pts)

**Historia:** Como persona ciega, quiero que el sitio web sea compatible con lectores de pantalla (screen readers), para poder navegar y hacer pedidos de forma independiente.

**Criterios (Given/When/Then):** Dado que un usuario ciego utiliza un lector de pantalla (como NVDA o JAWS), cuando navega por el catálogo, buscador y procesa un pedido, entonces todos los elementos interactivos, campos de formulario e imágenes deben poseer etiquetas ARIA correspondientes, descripciones alt y orden de tabulación lógico según el estándar WCAG 2.1 AA.

**Notas / RNF / dependencia:** RNF: cumplimiento del estándar de accesibilidad WCAG 2.1 Nivel AA.

### US-08 · Validación automática de pagos (Must · 5 pts)

**Historia:** Como funcionario de Tesorería, quiero que validen los pagos automáticamente en línea, para eliminar el estado que hoy demora días.

**Criterios (Given/When/Then):** Dado que un pago ingresa de forma correcta por el portal en línea, cuando el webhook de la pasarela de pagos notifica la transacción exitosa, entonces el sistema debe marcar el pedido como «Pagado» en el ERP interno, generar la conciliación bancaria automatizada y notificar a Tesorería, eliminando la validación manual.

**Notas / RNF / dependencia:** Habilitador clave para la automatización total del flujo. Vinculado fuertemente con US-03.

### US-09 · Ruta optimizada para el repartidor (Must · 8 pts)

**Historia:** Como repartidor (delivery), quiero recibir una ruta optimizada automáticamente según la ubicación de los pedidos del día, para reducir tiempos de viaje y entregar más pedidos por turno.

**Criterios (Given/When/Then), Escenario 1: generación de hoja de ruta optimizada.** Dado que se inicia el turno de reparto con un listado de pedidos aprobados, cuando el despachador selecciona los pedidos asignados a su vehículo y solicita optimizar, entonces el sistema debe calcular mediante geolocalización la ruta óptima de entrega secuencial, minimizando kilómetros y entregando un mapa interactivo con indicaciones giro a giro.

**Notas / RNF / dependencia:** Integración con API de mapas (Google Maps API / Mapbox). Algoritmo de ruteo vehicular (VRP).

### US-10 · Rebajar inventario al confirmar una venta (Should · 5 pts)

**Historia:** Como personal de farmacia, quiero que el sistema rebaje el inventario y actualice el estado del despacho automáticamente al confirmar una venta, para dedicar mi tiempo al fraccionamiento clínico en vez de actualizar todo a mano.

**Criterios (Given/When/Then):** Dado que el personal confirma la facturación/venta de un medicamento, cuando se emite la boleta electrónica, entonces el sistema debe restar inmediatamente las unidades del inventario físico disponible en bodega central y actualizar el estado del despacho a «En preparación».

**Notas / RNF / dependencia:** Consistencia transaccional de la base de datos (concurrencia de stock en ventas simultáneas).

### US-11 · Retiro por un cuidador (Must · 5 pts)

**Historia:** Como cuidador de un adulto mayor, quiero poder retirar los medicamentos de la persona que cuido registrándome como su cuidador, para no depender de que ella se acerque personalmente a la farmacia a buscarlos.

**Criterios (Given/When/Then):** Dado que un cuidador asiste a retirar medicamentos en nombre de un tercero, cuando presenta su cédula de identidad y el sistema verifica que está previamente vinculado y validado como cuidador en la ficha del paciente crónico, entonces el sistema debe permitir la entrega registrando la firma/huella digital del cuidador y emitiendo el comprobante correspondiente.

**Notas / RNF / dependencia:** Requiere un módulo previo de vinculación legal/médica de tutores/cuidadores en la ficha del paciente.

### US-12 · Escanear el pedido antes de entregarlo (Should · 3 pts)

**Historia:** Como repartidor, quiero escanear el pedido antes de entregarlo, para no equivocarme de medicamento y que lleguen menos entregas mal hechas.

**Criterios (Given/When/Then):** Dado que el repartidor se encuentra en el domicilio del vecino, cuando escanea el código QR de la etiqueta del paquete utilizando la app móvil, entonces el sistema debe validar si coincide con el RUT/Pedido de destino. Si es correcto, habilita la entrega; si no coincide, emite una alerta sonora y visual de error impidiendo cerrar el despacho.

**Notas / RNF / dependencia:** Uso de cámara de smartphone en app móvil de reparto. Código de barras o QR en etiquetas de empaque.

### US-13 · Mantener stock (Sprint 1 · 5 pts)

**Historia:** Como funcionaria de backoffice, quiero actualizar precio y stock para que la información que ve la vecina sea correcta.

**Criterios:** ver `docs/sprint-1/META_Y_BACKLOG.md` §1.3 (escenario feliz y de error). Implementada en el Sprint 1; evidencia en `docs/sprint-1/TRAZABILIDAD.md`.

### US-14 · Alerta con IA (fuera del Sprint 1)

**Historia:** *Por completar.* En `META_Y_BACKLOG.md` solo figura como «alerta con IA», fuera del Sprint 1.

### US-15 · Realizar compra/pedido (Sprint 1 · 8 pts)

**Historia:** Como vecina, quiero seleccionar un medicamento disponible, indicar cantidad y confirmar mi pedido para iniciar la compra sin ir presencialmente.

**Criterios:** ver `docs/sprint-1/META_Y_BACKLOG.md` §1.3 (feliz, error por stock y dos escenarios de concurrencia). Implementada en el Sprint 1 para **un solo medicamento por pedido**; US-16 la extiende.

### US-16 · Carrito de compras

**Historia:** Como vecino que utiliza el sitio web de la farmacia, quiero tener un carrito de compras de todos los medicamentos que seleccione, para tener solo un pedido.

**MoSCoW / puntos / sprint:** Must · 3 pts · sprint por definir. **Implementada** en el PR #50 (sub-issues #51 a #56).

**Criterios (Given/When/Then), los del issue #42:**

- **Escenario feliz.** Dado que la vecina agregó al carrito dos medicamentos con stock disponible, cuando confirma el carrito, entonces el sistema crea **un solo pedido** con los dos medicamentos, el total calculado y el estado `Solicitud creada`, y descuenta el stock de cada uno.
- **Escenario de error — sin stock.** Dado que uno de los medicamentos del carrito ya no tiene stock suficiente, cuando la vecina confirma, entonces el sistema no crea el pedido, indica cuál medicamento no está disponible y mantiene el stock de todos sin cambios.

**Notas / dependencias:**
- El pedido pasó a tener ítems: tabla `pedido_items` (ver `docs/arquitectura/MODELO_DE_DATOS.md` y `docs/uml/`).
- Debe respetar la regla de compra atómica: el descuento de todos los ítems y el pedido van en la misma transacción.
- El precio y el total se calculan siempre en el backend.

### US-17 · Ingreso con QR de Neuro-Access

**Historia:** Como vecino que usa el sitio de FarmacIA, quiero ingresar escaneando un QR con mi app Neuro-Access, para no tener que crear usuario ni recordar contraseñas y que mis pedidos queden a mi nombre.

**MoSCoW / puntos / sprint:** Must · 8 pts · sprint por definir. **Implementada** en el PR #57 (sub-issues #44 a #49).

**Criterios (Given/When/Then), los mismos del issue #43:**

- **Ingreso feliz.** Dado que el vecino tiene Neuro-Access con su identidad aprobada, cuando escanea el QR de la pantalla «Ingresar» y aprueba la solicitud en la app, entonces el sitio lo saluda por su nombre sin pedirle usuario ni clave.
- **QR vencido.** Dado que pasaron 5 minutos sin que se apruebe el QR, cuando el vecino vuelve a la pantalla, entonces no se inicia sesión y el sitio le ofrece generar un código nuevo, en español simple.
- **Pedido a su nombre.** Dado que el vecino ingresó, cuando confirma un pedido, entonces el pedido queda asociado a él y aparece en «Mis pedidos» con número, medicamento, total y estado. Si no ingresó, puede comprar igual que antes.
- **Salir.** Dado que el vecino ingresó, cuando presiona «Salir», entonces la sesión termina y «Mis pedidos» vuelve a pedir el ingreso.

**Notas / RNF / dependencias:**
- Quick Login de Trust Anchor Group (Neuro-Access / Neuro-Ledger), con proveedor simulado para tests y demo. Detalle técnico en `docs/sprint-2/NEURO_ACCESS_NOTAS.md` y en `docs/uml/`.
- Privacidad (Ley 19.628, repositorio público): de la identidad solo se guarda su Id y el nombre de pila; nunca RUT, teléfono ni correo.
- Comprar no exige sesión. Con sesión, también los pedidos del carrito (US-16) quedan a nombre del vecino.

## 3. Pendientes de la planilla

La planilla de Inception trae vacías las secciones siguientes; este archivo no las inventa:

- **Desempate WSJF** (opcional): valor, urgencia, riesgo, tamaño y orden.
- **RNF que cruzan el backlog** (mínimo 3, ISO 25010): RNF-01 Usabilidad, RNF-02 Seguridad / privacidad y RNF-03 Fiabilidad, sin requerimiento medible, cómo se nota en el MVP ni relación con los Must.

Si el equipo quiere, se pueden redactar como siguiente paso, usando lo que ya existe en el Sprint 1 (letra ≥ 18 px y navegación por teclado, token simulado, stock nunca negativo).
