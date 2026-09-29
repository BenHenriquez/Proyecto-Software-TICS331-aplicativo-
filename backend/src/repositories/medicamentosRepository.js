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

  return {
    insertarVarios(medicamentos) {
      insertarTodos(medicamentos);
    },

    contar() {
      return db.prepare('SELECT COUNT(*) AS n FROM medicamentos').get().n;
    },

    buscarPorCodigo(codigo) {
      return db.prepare('SELECT * FROM medicamentos WHERE codigo = ?').get(codigo);
    },
  };
}
