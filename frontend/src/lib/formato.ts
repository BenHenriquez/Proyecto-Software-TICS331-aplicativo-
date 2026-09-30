// Precios en pesos chilenos, como los lee la vecina: "$1.490". Solo para mostrar;
// el precio y el total reales los calcula siempre el backend.
const formateadorPesos = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

export function formatoPesos(monto: number): string {
  return formateadorPesos.format(monto);
}
