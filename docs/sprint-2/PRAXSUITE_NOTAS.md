# Praxsuite — notas para el Sprint 2

> **No usar en el Sprint 1.** Este documento guarda lo aprendido para migrar el backend a Praxsuite más adelante (ver ADR-01).

## Qué es

Backend-as-a-service: tablas (Postgres gestionado), autenticación, archivos, módulo de Apps y automatizaciones expuestas como endpoints. Documentación pública: https://learn.praxsuite.com/docs/

## Lo que ya sabemos

- **El chat de Prax no ejecuta acciones:** solo responde con texto. Para construir, usar Claude Code con el MCP de Praxsuite o el portal a mano.
- **Claves:** `pk_live_` es pública (el SDK la obtiene solo); `sk_live_` es secreta y nunca va en el front, en el repo ni en un chat.
- **Endpoints:** siempre POST. Un GET lo consume el gateway como verificación de webhook.
- **Nodos Script:** las columnas llegan con guion bajo (`Precio_Unitario`); las salidas se consumen como string (usar `JSON.stringify`).
- **Columnas Status:** llegan a las automatizaciones como id de opción, no como texto.
- **Escrituras no transaccionales:** los nodos de escritura no son "todo o nada" por sí solos. `Table Restore` reemplaza la tabla completa: nunca usarlo para deshacer una compra.
- **Regla de oro de la plataforma:** todo lo que tiene valor (stock, pedidos, precios) se escribe desde una automatización, nunca desde el navegador.

## Preguntas pendientes antes de migrar

1. ¿`Update Rows` por filtro es una sola sentencia atómica? ¿Informa cuántas filas actualizó?
2. ¿Dos ejecuciones simultáneas del mismo endpoint corren en paralelo o en cola?
3. ¿Existe actualización relativa (`stock = stock - 2`) sin leer antes?
4. ¿Cómo se exige usuario autenticado con un rol en un endpoint?
5. ¿Qué herramientas expone el MCP (`mcp__praxsuite__*`) y cuáles permiten crear tablas y automatizaciones?
6. ¿Las Apps de Praxsuite se pueden exportar o versionar fuera del portal?

## Plan de migración

Reemplazar solo los `repositories` del backend por implementaciones que llamen a Praxsuite. La compra se valida de nuevo con la misma prueba de concurrencia del Sprint 1 antes de aceptar la migración.
