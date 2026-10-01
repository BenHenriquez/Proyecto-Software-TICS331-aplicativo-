import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from '../src/config.js';
import { sembrar } from '../src/repositories/seed.js';
import { crearApp } from '../src/app.js';

// #11 Endpoint de actualización (US-13, #2): PUT /api/backoffice/medicamentos/:codigo
// (MODELO_DE_DATOS.md §3). MED-001 parte con precio 1990, stock 120 y version 0.
const TOKEN = 'token-de-prueba';
const CODIGO = 'MED-001';

describe('PUT /api/backoffice/medicamentos/:codigo', () => {
  let db;
  let app;
  const fila = (codigo = CODIGO) =>
    db.prepare('SELECT nombre, precio_unitario, stock, version FROM medicamentos WHERE codigo = ?').get(codigo);
  // Por defecto envía el token correcto; `{ token: undefined }` significa "sin header" (no se usa
  // un valor por defecto de desestructuración porque reemplazaría el undefined por el token).
  // Como el panel (#12), envía la `version` que acaba de leer; un test la reemplaza escribiendo
  // `version` en el cuerpo (`version: undefined` = no se envía).
  const actualizar = (cuerpo, opciones = {}) => {
    const { codigo = CODIGO } = opciones;
    const token = 'token' in opciones ? opciones.token : TOKEN;
    const peticion = request(app).put(`/api/backoffice/medicamentos/${codigo}`);
    if (token !== undefined) peticion.set('x-backoffice-token', token);
    return peticion.send({ version: fila(codigo)?.version, ...cuerpo });
  };

  beforeEach(() => {
    ({ db } = sembrar({ rutaDb: ':memory:', rutaCsv: config.rutaSemilla }));
    app = crearApp({ db, tokenBackoffice: TOKEN });
  });

  describe('token simulado del backoffice', () => {
    it.each([
      ['no se envía', undefined],
      ['es incorrecto', 'otro-token'],
      ['está vacío', ''],
    ])('responde 401 y no cambia nada si el token %s', async (_caso, token) => {
      const antes = fila();
      const res = await actualizar({ precioUnitario: 2500 }, { token });

      expect(res.status).toBe(401);
      expect(res.body.motivo).toBe('no_autorizado');
      expect(typeof res.body.mensaje).toBe('string');
      expect(fila()).toEqual(antes);
    });

    it('la autorización se revisa antes que los datos: sin token gana el 401 aunque el cuerpo sea inválido', async () => {
      const invalido = await actualizar({ stock: -1 }, { token: undefined });
      const inexistente = await actualizar({ stock: 5 }, { codigo: 'MED-999', token: undefined });

      expect(invalido.status).toBe(401);
      expect(inexistente.status).toBe(401);
    });

    it('si el servidor no tiene token configurado, ningún encabezado autoriza', async () => {
      app = crearApp({ db, tokenBackoffice: '' });
      const antes = fila();

      for (const token of ['', 'cualquiera', undefined]) {
        const res = await actualizar({ precioUnitario: 2500 }, { token });
        expect(res.status).toBe(401);
      }
      expect(fila()).toEqual(antes);
    });
  });

  describe('escenario feliz: el cambio queda guardado', () => {
    it('actualiza el precio, lo persiste y sube la version', async () => {
      const res = await actualizar({ precioUnitario: 2500 });

      expect(res.status).toBe(200);
      expect(res.body.medicamento).toMatchObject({ codigo: CODIGO, precioUnitario: 2500, stock: 120, version: 1 });
      expect(fila()).toMatchObject({ precio_unitario: 2500, stock: 120, version: 1 });
    });

    it('actualiza el stock y lo persiste', async () => {
      const res = await actualizar({ stock: 35 });

      expect(res.status).toBe(200);
      expect(res.body.medicamento).toMatchObject({ stock: 35, precioUnitario: 1990, disponible: true, version: 1 });
      expect(fila()).toMatchObject({ precio_unitario: 1990, stock: 35 });
    });

    it('acepta stock 0 y lo marca como no disponible', async () => {
      const res = await actualizar({ stock: 0 });

      expect(res.status).toBe(200);
      expect(res.body.medicamento).toMatchObject({ stock: 0, disponible: false });
      expect(fila().stock).toBe(0);
    });

    it('acepta justo los topes (precio 10.000.000, stock 1.000.000) y los guarda como enteros', async () => {
      const res = await actualizar({ precioUnitario: 10_000_000, stock: 1_000_000 });

      expect(res.status).toBe(200);
      const tipos = db
        .prepare('SELECT typeof(precio_unitario) AS precio, typeof(stock) AS stock FROM medicamentos WHERE codigo = ?')
        .get(CODIGO);
      expect(tipos).toEqual({ precio: 'integer', stock: 'integer' });
    });

    it('actualiza precio y stock juntos con un solo aumento de version', async () => {
      const res = await actualizar({ precioUnitario: 2100, stock: 10 });

      expect(res.status).toBe(200);
      expect(fila()).toMatchObject({ precio_unitario: 2100, stock: 10, version: 1 });
    });

    it('cada cambio vuelve a subir la version', async () => {
      await actualizar({ stock: 50 });
      const res = await actualizar({ stock: 40 });

      expect(res.body.medicamento.version).toBe(2);
      expect(fila().version).toBe(2);
    });

    it('solo modifica el medicamento indicado: el resto del catálogo queda igual', async () => {
      const catalogo = () => db.prepare('SELECT * FROM medicamentos ORDER BY codigo').all();
      const otros = (filas) => filas.filter((f) => f.codigo !== CODIGO);
      const antes = catalogo();

      await actualizar({ precioUnitario: 2500, stock: 7 });
      const despues = catalogo();

      expect(despues).toHaveLength(antes.length);
      expect(otros(despues)).toEqual(otros(antes));
    });

    it('responde con el medicamento en el formato de la API', async () => {
      const res = await actualizar({ precioUnitario: 2500 });

      expect(Object.keys(res.body.medicamento).sort()).toEqual(
        ['codigo', 'disponible', 'nombre', 'precioUnitario', 'presentacion', 'principioActivo', 'stock', 'version'].sort()
      );
      expect(res.body.medicamento.nombre).toBe('Losartán 50 mg');
    });

    it('ignora campos que no se pueden editar desde el panel', async () => {
      // `version` no se edita: es el candado de #12 y solo sube por el propio cambio (ver abajo).
      const antes = fila();
      const res = await actualizar({ precioUnitario: 2500, nombre: 'Otro nombre', codigo: 'MED-999' });

      expect(res.status).toBe(200);
      expect(fila()).toMatchObject({ nombre: antes.nombre, precio_unitario: 2500, version: 1 });
      expect(fila('MED-999')).toBeUndefined();
    });
  });

  // "Aparece de inmediato" para la vecina: la búsqueda (#7) aún no existe, así que se comprueba con
  // la compra (POST /api/pedidos), que lee en vivo el precio y el stock. La búsqueda se cubre en #14.
  describe('el cambio se ve de inmediato en lo que consulta la vecina', () => {
    const comprar = (codigo, cantidad) => request(app).post('/api/pedidos').send({ codigo, cantidad });

    it('un precio nuevo se usa en el total de la siguiente compra', async () => {
      await actualizar({ precioUnitario: 2500 });
      const res = await comprar(CODIGO, 2);

      expect(res.status).toBe(201);
      expect(res.body.pedido).toMatchObject({ precioUnitario: 2500, total: 5000 });
    });

    it('dejar el stock en 0 hace que la siguiente compra se rechace por falta de stock', async () => {
      await actualizar({ stock: 0 });
      const res = await comprar(CODIGO, 1);

      expect(res.status).toBe(409);
      expect(res.body.motivo).toBe('sin_stock');
    });

    it('reponer stock de un medicamento agotado permite comprarlo', async () => {
      const agotado = 'MED-014';
      expect((await comprar(agotado, 1)).status).toBe(409);

      await actualizar({ stock: 1 }, { codigo: agotado });
      const res = await comprar(agotado, 1);

      expect(res.status).toBe(201);
    });
  });

  describe('escenario de error: valor inválido, se rechaza y se mantiene el anterior', () => {
    it.each([
      ['stock', 'negativo', -1],
      ['stock', 'decimal', 1.5],
      ['stock', 'texto', 'abc'],
      ['stock', 'texto numérico', '5'],
      ['stock', 'nulo', null],
      ['stock', 'sobre el tope de un millón', 1_000_001],
      ['stock', 'enorme', 1e300],
      ['stock', 'fuera del rango de enteros seguros', 2 ** 53],
      ['precioUnitario', 'sobre el tope de diez millones', 10_000_001],
      ['precioUnitario', 'enorme', 1e308],
      ['precioUnitario', 'fuera del rango de enteros seguros', 2 ** 53],
      ['precioUnitario', 'cero', 0],
      ['precioUnitario', 'negativo', -5],
      ['precioUnitario', 'decimal', 1.5],
      ['precioUnitario', 'vacío', ''],
      ['precioUnitario', 'texto', 'abc'],
      ['precioUnitario', 'texto numérico', '1990'],
      ['precioUnitario', 'nulo', null],
    ])('responde 400 si %s es %s y no guarda nada', async (campo, _caso, valor) => {
      const antes = fila();
      const res = await actualizar({ [campo]: valor });

      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('datos_invalidos');
      expect(typeof res.body.errores[campo]).toBe('string');
      expect(res.body.errores[campo].length).toBeGreaterThan(0);
      expect(fila()).toEqual(antes);
    });

    it('si un campo es inválido no guarda tampoco el válido', async () => {
      const antes = fila();
      const res = await actualizar({ precioUnitario: 2500, stock: -1 });

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.errores)).toEqual(['stock']);
      expect(fila()).toEqual(antes);
    });

    it('informa el motivo de cada campo inválido', async () => {
      const res = await actualizar({ precioUnitario: 0, stock: -3 });

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.errores).sort()).toEqual(['precioUnitario', 'stock']);
    });

    it.each([
      ['un cuerpo vacío', {}],
      ['un cuerpo sin precio ni stock', { nombre: 'Solo nombre' }],
    ])('responde 400 con %s', async (_caso, cuerpo) => {
      const antes = fila();
      const res = await actualizar(cuerpo);

      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('datos_invalidos');
      expect(res.body.errores.general).toBeTypeOf('string');
      expect(fila()).toEqual(antes);
    });

    it('responde 400 si no se envía cuerpo', async () => {
      const res = await request(app).put(`/api/backoffice/medicamentos/${CODIGO}`).set('x-backoffice-token', TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('datos_invalidos');
    });

    it('los mensajes son texto simple en español, sin códigos ni jerga técnica', async () => {
      const res = await actualizar({ precioUnitario: 'abc', stock: -1 });
      const textos = [res.body.mensaje, ...Object.values(res.body.errores)];

      for (const texto of textos) {
        expect(texto).toMatch(/^[A-ZÁÉÍÓÚ¿¡]/);
        expect(texto).toMatch(/[.!?]$/);
        expect(texto).not.toMatch(/undefined|null|NaN|error|exception|\d{3}/i);
        expect(texto).not.toMatch(/\b[A-Z_]{4,}\b/); // constantes tipo SIN_STOCK
      }
    });
  });

  describe('medicamento inexistente', () => {
    it.each([0, 5])('responde 404 no_existe aunque la version enviada sea %i (no es un conflicto)', async (version) => {
      const res = await actualizar({ stock: 5, version }, { codigo: 'MED-999' });

      expect(res.status).toBe(404);
      expect(res.body.motivo).toBe('no_existe');
      expect(typeof res.body.mensaje).toBe('string');
    });
  });

  // #12 Protección frente a ventas simultáneas (MODELO_DE_DATOS.md §5): el panel envía la `version`
  // que leyó y el UPDATE exige esa misma versión; si alguien (una venta) cambió el producto, 409.
  describe('candado de version frente a ventas simultáneas (#12)', () => {
    const MENSAJE_CONFLICTO = 'El stock cambió mientras editabas. Recarga e intenta de nuevo.';
    const comprar = (cantidad, codigo = CODIGO) => request(app).post('/api/pedidos').send({ codigo, cantidad });

    it('con la version que leyó guarda el cambio y sube la version en 1', async () => {
      const { version } = fila();
      const res = await actualizar({ stock: 50, version });

      expect(res.status).toBe(200);
      expect(res.body.medicamento).toMatchObject({ stock: 50, version: version + 1 });
      expect(fila()).toMatchObject({ stock: 50, version: version + 1 });
    });

    it('si una venta cambió el medicamento mientras editaba, responde 409 y no guarda nada', async () => {
      const { version } = fila(); // el panel lee: stock 120, version 0
      await comprar(2); // mientras edita se vende: stock 118, version 1
      const despuesDeLaVenta = fila();

      const res = await actualizar({ precioUnitario: 2500, stock: 150, version });

      expect(res.status).toBe(409);
      expect(res.body.motivo).toBe('version_cambiada');
      expect(res.body.mensaje).toBe(MENSAJE_CONFLICTO);
      expect(fila()).toEqual(despuesDeLaVenta); // ni el precio ni el stock, y la venta no se pisa
    });

    it('dos ediciones con la misma version: la primera se guarda y la segunda recibe 409', async () => {
      const { version } = fila();

      const primera = await actualizar({ stock: 50, version });
      const segunda = await actualizar({ stock: 80, version });

      expect(primera.status).toBe(200);
      expect(segunda.status).toBe(409);
      expect(fila()).toMatchObject({ stock: 50, version: version + 1 });
    });

    it('tras el 409, con la version nueva la misma edición se guarda', async () => {
      const { version } = fila();
      await comprar(2);
      expect((await actualizar({ stock: 150, version })).status).toBe(409);

      const res = await actualizar({ stock: 150 }); // el helper lee la version actual (la "recarga")

      expect(res.status).toBe(200);
      expect(fila()).toMatchObject({ stock: 150, version: 2 });
    });

    it('también un cambio de solo precio exige la version vigente (el candado no depende del campo editado)', async () => {
      const { version } = fila();
      await comprar(1);
      const despuesDeLaVenta = fila();

      const res = await actualizar({ precioUnitario: 2500, version });

      expect(res.status).toBe(409);
      expect(fila()).toEqual(despuesDeLaVenta);
    });

    it('una version futura (mayor que la actual) también se rechaza con 409', async () => {
      const { version } = fila();

      const futura = await actualizar({ stock: 50, version: version + 5 });

      expect(futura.status).toBe(409);
      expect(fila()).toMatchObject({ stock: 120, version });
    });

    it.each([
      ['no se envía', undefined],
      ['es negativa', -1],
      ['es decimal', 0.5],
      ['es texto', 'abc'],
      ['es texto numérico', '0'],
      ['es nula', null],
      ['está fuera del rango de enteros seguros', 2 ** 53],
    ])('responde 400 con el motivo en `version` si %s, y no guarda nada', async (_caso, version) => {
      const antes = fila();
      const res = await actualizar({ stock: 50, version });

      expect(res.status).toBe(400);
      expect(res.body.motivo).toBe('datos_invalidos');
      expect(Object.keys(res.body.errores)).toEqual(['version']); // solo el campo que falla
      expect(res.body.errores.version).toBeTypeOf('string');
      expect(fila()).toEqual(antes);
    });

    it('una version inválida se informa con 400 aunque el medicamento no exista (la validación va antes que la búsqueda)', async () => {
      const res = await actualizar({ stock: 5, version: undefined }, { codigo: 'MED-999' });

      expect(res.status).toBe(400);
      expect(res.body.errores.version).toBeTypeOf('string');
    });

    it('version e importes inválidos a la vez: se informan todos los campos', async () => {
      const res = await actualizar({ stock: -1, version: 'abc' });

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.errores).sort()).toEqual(['stock', 'version']);
    });

    it('un valor inválido se informa con 400 aunque la version sea vieja (la validación va antes que el candado)', async () => {
      const { version } = fila();
      await comprar(1);

      const res = await actualizar({ stock: -1, version });

      expect(res.status).toBe(400);
      expect(res.body.errores.stock).toBeTypeOf('string');
    });

    it('el conflicto afecta solo al medicamento editado: otro medicamento sigue editable con su version', async () => {
      const { version } = fila();
      await comprar(1);
      expect((await actualizar({ stock: 150, version })).status).toBe(409); // conflicto sobre MED-001

      const otro = await actualizar({ stock: 7 }, { codigo: 'MED-002' });

      expect(otro.status).toBe(200);
      expect(fila('MED-002').stock).toBe(7);
    });

    it('los mensajes del conflicto y de la version son texto simple en español', async () => {
      const { version } = fila();
      await comprar(1);
      const conflicto = await actualizar({ stock: 50, version });
      const sinVersion = await actualizar({ stock: 50, version: undefined });
      const textos = [conflicto.body.mensaje, sinVersion.body.errores.version];

      for (const texto of textos) {
        expect(texto).toMatch(/^[A-ZÁÉÍÓÚ¿¡]/);
        expect(texto).toMatch(/[.!?]$/);
        expect(texto).not.toMatch(/undefined|null|NaN|error|exception|\d{3}/i);
        expect(texto).not.toMatch(/\b[A-Z_]{4,}\b/);
      }
    });
  });
});
