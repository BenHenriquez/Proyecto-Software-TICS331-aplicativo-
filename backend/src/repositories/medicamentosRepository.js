// Acceso a la tabla medicamentos. La búsqueda (US-02) y la edición del backoffice (US-13) se agregan aquí.
export function crearMedicamentosRepository(db) {
  const insertar = db.prepare(`
    INSERT INTO medicamentos
      (codigo, nombre, principio_activo, presentacion, categoria,
       precio_unitario, stock, busqueda, activo, version)
    VALUES
      (@codigo, @nombre, @principio_activo, @presentacion, @categoria,
       @precio_unitario, @stock, @busqueda, @activo, 0)
  `);
  const insertarTodos = db.transaction((filas) => {
    for (const fila of filas) insertar.run(fila);
  });

  // Un solo UPDATE: nunca "leer, cambiar en JS y guardar". Un valor null significa "no cambiar".
  const actualizar = db.prepare(`
    UPDATE medicamentos
    SET precio_unitario = COALESCE(@precioUnitario, precio_unitario),
        stock = COALESCE(@stock, stock),
        version = version + 1
    WHERE codigo = @codigo
  `);
  const leer = db.prepare('SELECT * FROM medicamentos WHERE codigo = ?');
  const actualizarYLeer = db.transaction((datos) => {
    if (actualizar.run(datos).changes === 0) return undefined;
    return leer.get(datos.codigo);
  });

  return {
    insertarVarios(medicamentos) {
      insertarTodos(medicamentos);
    },

    contar() {
      return db.prepare('SELECT COUNT(*) AS n FROM medicamentos').get().n;
    },

    // US-02 (#7): cada palabra (ya normalizada por el servicio) debe aparecer en `busqueda`, en
    // cualquier orden. Se escapan % y _ para que se busquen como letras y no como comodines.
    buscar(palabras) {
      const condiciones = palabras.map(() => "busqueda LIKE ? ESCAPE '\\'").join(' AND ');
      const patrones = palabras.map((p) => `%${p.replace(/[\\%_]/g, '\\$&')}%`);
      return db
        .prepare(`SELECT * FROM medicamentos WHERE activo = 1 AND ${condiciones} ORDER BY busqueda, codigo`)
        .all(...patrones);
    },

    buscarPorCodigo(codigo) {
      return db.prepare('SELECT * FROM medicamentos WHERE codigo = ?').get(codigo);
    },

    // US-13 (#11): cambia precio y/o stock y sube la version. Devuelve la fila actualizada,
    // o undefined si el código no existe. Los valores ya vienen validados por el servicio.
    actualizarPrecioYStock({ codigo, precioUnitario = null, stock = null }) {
      return actualizarYLeer({ codigo, precioUnitario, stock });
    },
  };
}
