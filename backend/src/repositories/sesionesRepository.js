// US-17 Ingreso con Neuro-Access (#45). Acceso a las tablas vecinos, intentos_ingreso y sesiones.
// Recibe y guarda solo hashes: los secretos en claro nunca llegan a la base.
export function crearSesionesRepository(db) {
  const insertarIntento = db.prepare(`
    INSERT INTO intentos_ingreso (llave_hash, secreto_hash, vence_en)
    VALUES (@llaveHash, @secretoHash, @venceEn)
  `);
  const intentoPorLlave = db.prepare('SELECT * FROM intentos_ingreso WHERE llave_hash = ?');
  const intentoPorSecreto = db.prepare('SELECT * FROM intentos_ingreso WHERE secreto_hash = ?');
  // La condición de estado va dentro del UPDATE: un mismo intento se aprueba o se usa una sola vez.
  const cambiarEstado = db.prepare(`
    UPDATE intentos_ingreso SET estado = @nuevo, vecino_id = COALESCE(@vecinoId, vecino_id)
    WHERE llave_hash = @llaveHash AND estado = @actual
  `);

  const vecinoPorIdentidad = db.prepare('SELECT * FROM vecinos WHERE identidad_id = ?');
  const insertarVecino = db.prepare(
    'INSERT INTO vecinos (identidad_id, nombre, creado_en) VALUES (@identidadId, @nombre, @creadoEn)'
  );
  const renombrarVecino = db.prepare('UPDATE vecinos SET nombre = @nombre WHERE id = @id');

  const insertarSesion = db.prepare(
    'INSERT INTO sesiones (token_hash, vecino_id, vence_en) VALUES (@tokenHash, @vecinoId, @venceEn)'
  );
  const sesionVigente = db.prepare(`
    SELECT v.id, v.nombre FROM sesiones s JOIN vecinos v ON v.id = s.vecino_id
    WHERE s.token_hash = ? AND s.vence_en > ?
  `);
  const borrarSesion = db.prepare('DELETE FROM sesiones WHERE token_hash = ?');

  // Aprobar = registrar al vecino (o actualizar su nombre) y marcar el intento, todo junto.
  const aprobar = db.transaction(({ llaveHash, identidadId, nombre, creadoEn }) => {
    let vecino = vecinoPorIdentidad.get(identidadId);
    if (vecino) renombrarVecino.run({ id: vecino.id, nombre });
    else vecino = { id: insertarVecino.run({ identidadId, nombre, creadoEn }).lastInsertRowid };

    const r = cambiarEstado.run({ llaveHash, actual: 'pendiente', nuevo: 'aprobado', vecinoId: vecino.id });
    if (r.changes === 0) throw new Error('intento_ya_resuelto'); // revierte el alta del vecino
    return Number(vecino.id);
  });

  // Usar = el intento aprobado se canjea por una sesión, una sola vez.
  const canjear = db.transaction(({ llaveHash, tokenHash, venceEn }) => {
    const intento = intentoPorLlave.get(llaveHash);
    const r = cambiarEstado.run({ llaveHash, actual: 'aprobado', nuevo: 'usado', vecinoId: null });
    if (r.changes === 0) return null;
    insertarSesion.run({ tokenHash, vecinoId: intento.vecino_id, venceEn });
    return intento.vecino_id;
  });

  return {
    crearIntento({ llaveHash, secretoHash, venceEn }) {
      insertarIntento.run({ llaveHash, secretoHash, venceEn });
    },

    buscarIntentoPorLlave(llaveHash) {
      return intentoPorLlave.get(llaveHash);
    },

    buscarIntentoPorSecreto(secretoHash) {
      return intentoPorSecreto.get(secretoHash);
    },

    // Devuelve el id del vecino, o null si el intento ya no estaba pendiente.
    aprobarIntento({ llaveHash, identidadId, nombre, creadoEn }) {
      try {
        return aprobar.immediate({ llaveHash, identidadId, nombre, creadoEn });
      } catch (err) {
        if (err.message === 'intento_ya_resuelto') return null;
        throw err;
      }
    },

    rechazarIntento(llaveHash) {
      return cambiarEstado.run({ llaveHash, actual: 'pendiente', nuevo: 'rechazado', vecinoId: null }).changes > 0;
    },

    // Devuelve el id del vecino si el intento aprobado se canjeó por la sesión, o null.
    canjearIntento({ llaveHash, tokenHash, venceEn }) {
      return canjear.immediate({ llaveHash, tokenHash, venceEn });
    },

    // { id, nombre } del vecino si la sesión existe y no ha vencido.
    buscarVecinoPorSesion(tokenHash, ahoraIso) {
      return sesionVigente.get(tokenHash, ahoraIso);
    },

    cerrarSesion(tokenHash) {
      borrarSesion.run(tokenHash);
    },
  };
}
