# Diagramas UML — FARMAC-IA

Los diagramas están en PlantUML (`.puml`), cada uno con su imagen (`.png`). Usan los mismos nombres que el código: si cambia el nombre de una función, un archivo o un endpoint, hay que actualizar el `.puml` y volver a generar la imagen en el mismo PR.

| Diagrama | Qué muestra |
|---|---|
| [componentes-sprint1](componentes-sprint1.puml) | Componentes del Sprint 1 (US-02, US-13 y US-15) más el carrito (US-16). US-17 va aparte. |
| [componentes-us17](componentes-us17.puml) | Lo que la US-17 agrega o cambia sobre el Sprint 1. |
| [secuencia-us17-ingreso](secuencia-us17-ingreso.puml) | Paso a paso del ingreso con QR de Neuro-Access. |

**Componentes del Sprint 1.** Muestra el navegador (React), el servidor (Express) y la base SQLite, con las capas `routes → services → repositories`, de las que solo los repositories tocan SQLite. Los colores separan la búsqueda de medicamentos (US-02), el panel de mantención de precio y stock (US-13) y la compra atómica (US-15). En verde agua está el carrito (US-16): la pantalla `Carrito`, el `CarritoProvider` del front y la tabla `pedido_items`.

**Componentes de US-17.** Muestra en morado lo nuevo y en amarillo lo modificado para que el vecino ingrese con su app Neuro-Access: la pantalla Ingresar, Mis pedidos, la sesión compartida en el front (`SesionProvider`), las rutas y el servicio de sesión, los dos proveedores de identidad (el Neuron de TAG y el simulado) y las tablas `vecinos`, `intentos_ingreso` y `sesiones`. En rosado están los externos: el Neuron público `lab.tagroot.io`, la app del vecino y el túnel que deja llegar el aviso del Neuron al backend durante el desarrollo.

**Secuencia del ingreso (US-17).** Muestra cómo el backend pide el QR al Neuron con un secreto que nunca llega al navegador, cómo el front pregunta cada 2 segundos si el vecino ya aprobó, cómo se valida el aviso del Neuron (secreto de un solo uso, 5 minutos, identidad aprobada) y cómo el intento aprobado se canjea una sola vez por una sesión en cookie httpOnly. También muestra qué pasa si el código vence.

## Cómo regenerar las imágenes

Con la extensión PlantUML de VS Code (`jebbs.plantuml`), abre el `.puml` y exporta a PNG. También se puede usar el `plantuml.jar` que trae la extensión, sin enviar nada a internet:

```bash
java -jar <ruta-a-la-extension>/plantuml.jar -charset UTF-8 -tpng docs/uml/*.puml
```

`componentes-us17.puml` usa `!pragma layout smetana`, así que no necesita Graphviz instalado. `componentes-sprint1.puml` no lo usa: para regenerarlo sin Graphviz, usa la extensión de VS Code o agrega esa línea.
