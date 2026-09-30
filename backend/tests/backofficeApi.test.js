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
  const actualizar = (cuerpo, opciones = {}) => {
    const { codigo = CODIGO } = opciones;
    const token = 'token' in opciones ? opciones.token : TOKEN;
    const peticion = request(app).put(`/api/backoffice/medicamentos/${codigo}`);
    if (token !== undefined) peticion.set('x-backoffice-token', token);
    return peticion.send(cuerpo);
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

    it('responde con el medicamento en el formato de la API', async () => {
      const res = await actualizar({ precioUnitario: 2500 });

      expect(Object.keys(res.body.medicamento).sort()).toEqual(
        ['codigo', 'disponible', 'nombre', 'precioUnitario', 'presentacion', 'principioActivo', 'stock', 'version'].sort()
      );
      expect(res.body.medicamento.nombre).toBe('Losartán 50 mg');
    });

    it('ignora campos que no se pueden editar desde el panel', async () => {
      // `version` no se prueba aquí: es el candado de #12 (ventas simultáneas) y lo define esa tarea.
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
    it('responde 404 no_existe', async () => {
      const res = await actualizar({ stock: 5 }, { codigo: 'MED-999' });

      expect(res.status).toBe(404);
      expect(res.body.motivo).toBe('no_existe');
      expect(typeof res.body.mensaje).toBe('string');
    });
  });
});
