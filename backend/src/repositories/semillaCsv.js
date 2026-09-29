import fs from 'node:fs';

// Lee la semilla sintética. El CSV no usa comillas ni comas dentro de los campos.
export function leerSemillaCsv(rutaCsv) {
  const texto = fs.readFileSync(rutaCsv, 'utf8').replace(/^﻿/, '');
  const [encabezado, ...lineas] = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  const columnas = encabezado.split(',').map((c) => c.trim());

  return lineas.map((linea) => {
    const valores = linea.split(',').map((v) => v.trim());
    const fila = Object.fromEntries(columnas.map((c, i) => [c, valores[i]]));
    return {
      ...fila,
      precio_unitario: Number(fila.precio_unitario),
      stock: Number(fila.stock),
      activo: Number(fila.activo ?? 1),
    };
  });
}
