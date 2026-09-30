// Proceso independiente que intenta una compra con su propia conexión a SQLite.
// Uso: node compradorParalelo.js <rutaDb> <codigo> <cantidad> <inicioEpochMs>
// Todos los procesos esperan hasta el mismo instante para confirmar a la vez.
import { abrirDb } from '../../src/repositories/db.js';
import { crearPedidosRepository } from '../../src/repositories/pedidosRepository.js';

const [rutaDb, codigo, cantidad, inicio] = process.argv.slice(2);
const db = abrirDb(rutaDb);
const repo = crearPedidosRepository(db);

while (Date.now() < Number(inicio)) {
  // espera activa: arrancar todos en el mismo milisegundo
}

const r = repo.confirmarPedido({ codigo, cantidad: Number(cantidad) });
db.close();
process.stdout.write(JSON.stringify({ ok: r.ok, motivo: r.motivo ?? null, cantidad: Number(cantidad) }));
