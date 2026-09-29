# ADR-01 · Backend propio (Node + SQLite) en el Sprint 1; Praxsuite en el Sprint 2

**Estado:** Propuesta · pendiente de confirmación de los ayudantes (Max y Matías)
**Fecha:** 2026-09-29
**Decidió:** Equipo BBMVV

## Contexto

- La meta del Sprint 1 exige un ciclo completo de compra con una **prueba de concurrencia**: dos compras de la última unidad nunca pueden confirmarse ambas.
- Praxsuite fue evaluado como backend. Su documentación indica que los nodos de escritura **no son transaccionales** por sí solos, y no hemos podido verificar si su actualización por filtro es atómica.
- El chat de Prax declaró no poder ejecutar acciones en el workspace; las capacidades del MCP aún no están confirmadas.
- La Sprint Review es el 2 de octubre y la evaluación exige evidencia en GitHub (commits, PRs, README reproducible, UML que calce con el código).

## Opciones

1. **Praxsuite desde ya.** Pro: plataforma del curso. Contra: atomicidad no verificada, capacidades del MCP desconocidas, poco código en el repo.
2. **Monolito Node + Express + SQLite en el repo (elegida).** Pro: atomicidad garantizada con una sola sentencia SQL, todo queda como código revisable, se levanta con un comando. Contra: habrá que migrar la capa de datos en el Sprint 2.
3. **Microservicios.** Descartada: un equipo, sin necesidad de escala; sería un monolito distribuido.

## Decisión

Opción 2, con capas `routes → services → repositories`. Solo los repositories tocan SQLite.

## Consecuencias

- La prueba de concurrencia se resuelve con `UPDATE ... WHERE stock >= ?` dentro de una transacción.
- En el Sprint 2 se reemplazan los repositories por implementaciones sobre Praxsuite; front, rutas y servicios no cambian (principio de inversión de dependencias).
- Si los ayudantes indican que Praxsuite es obligatorio desde el Sprint 1, este ADR se revisa y se reemplaza.
