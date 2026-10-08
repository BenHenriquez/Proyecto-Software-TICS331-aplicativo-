import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// US-16 Carrito (#42). Guarda lo que la vecina eligió: solo código, nombre, precio de referencia y
// cantidad. El precio y el total reales los calcula siempre el backend (regla 1): aquí se usan
// únicamente para mostrar un total estimado.
export interface ItemCarrito {
  codigo: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
}

// Espejos de CANTIDAD_MAXIMA e ITEMS_MAXIMOS en backend/src/services/pedidosService.js. El backend
// sigue siendo la fuente de verdad: aquí solo evitamos armar un carrito que igual será rechazado.
export const CANTIDAD_MAXIMA_POR_MEDICAMENTO = 20;
export const MEDICAMENTOS_MAXIMOS = 10;

const CLAVE_ALMACEN = 'farmacia.carrito';

export type ResultadoAgregar =
  // `cantidad` es la que quedó en el carrito; `recortada` indica que se pidió más de lo permitido.
  | { ok: true; cantidad: number; recortada: boolean }
  | { ok: false; motivo: 'carrito_lleno' };

export interface Carrito {
  items: ItemCarrito[];
  // Unidades en total (para el aviso del menú) y total estimado (solo informativo).
  unidades: number;
  totalEstimado: number;
  agregar: (medicamento: Omit<ItemCarrito, 'cantidad'>, cantidad: number) => ResultadoAgregar;
  cambiarCantidad: (codigo: string, cantidad: number) => void;
  quitar: (codigo: string) => void;
  vaciar: () => void;
}

const CarritoContexto = createContext<Carrito | null>(null);

function esItem(valor: unknown): valor is ItemCarrito {
  if (valor === null || typeof valor !== 'object') return false;
  const v = valor as Record<string, unknown>;
  return (
    typeof v.codigo === 'string' &&
    v.codigo !== '' &&
    typeof v.nombre === 'string' &&
    Number.isInteger(v.precioUnitario) &&
    (v.precioUnitario as number) > 0 &&
    Number.isInteger(v.cantidad) &&
    (v.cantidad as number) >= 1 &&
    (v.cantidad as number) <= CANTIDAD_MAXIMA_POR_MEDICAMENTO
  );
}

// El almacenamiento del navegador puede no existir o venir alterado: ante cualquier duda, carrito vacío.
function leerGuardado(): ItemCarrito[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_ALMACEN);
    const datos: unknown = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(datos)) return [];
    const vistos = new Set<string>();
    const items = datos.filter((d): d is ItemCarrito => {
      if (!esItem(d) || vistos.has(d.codigo)) return false;
      vistos.add(d.codigo);
      return true;
    });
    return items.slice(0, MEDICAMENTOS_MAXIMOS);
  } catch {
    return [];
  }
}

function guardar(items: ItemCarrito[]) {
  try {
    window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(items));
  } catch {
    // Sin almacenamiento el carrito sigue funcionando mientras la página esté abierta.
  }
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>(leerGuardado);

  useEffect(() => guardar(items), [items]);

  const agregar = useCallback<Carrito['agregar']>(
    (medicamento, cantidad) => {
      const existente = items.find((i) => i.codigo === medicamento.codigo);
      if (!existente && items.length >= MEDICAMENTOS_MAXIMOS) return { ok: false, motivo: 'carrito_lleno' };

      const pedida = (existente?.cantidad ?? 0) + cantidad;
      const final = Math.min(pedida, CANTIDAD_MAXIMA_POR_MEDICAMENTO);
      // El precio se actualiza al que se vio en esta búsqueda, que es el más reciente.
      setItems((actuales) =>
        existente
          ? actuales.map((i) => (i.codigo === medicamento.codigo ? { ...i, ...medicamento, cantidad: final } : i))
          : [...actuales, { ...medicamento, cantidad: final }],
      );
      return { ok: true, cantidad: final, recortada: pedida > final };
    },
    [items],
  );

  const cambiarCantidad = useCallback((codigo: string, cantidad: number) => {
    const valida = Math.min(Math.max(Math.trunc(cantidad), 1), CANTIDAD_MAXIMA_POR_MEDICAMENTO);
    setItems((actuales) => actuales.map((i) => (i.codigo === codigo ? { ...i, cantidad: valida } : i)));
  }, []);

  const quitar = useCallback((codigo: string) => {
    setItems((actuales) => actuales.filter((i) => i.codigo !== codigo));
  }, []);

  const vaciar = useCallback(() => setItems([]), []);

  const valor = useMemo<Carrito>(
    () => ({
      items,
      unidades: items.reduce((suma, i) => suma + i.cantidad, 0),
      totalEstimado: items.reduce((suma, i) => suma + i.cantidad * i.precioUnitario, 0),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
    }),
    [items, agregar, cambiarCantidad, quitar, vaciar],
  );

  return <CarritoContexto.Provider value={valor}>{children}</CarritoContexto.Provider>;
}

// Para las pantallas del carrito: sin proveedor es un error de armado de la app.
export function useCarrito(): Carrito {
  const carrito = useContext(CarritoContexto);
  if (!carrito) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>.');
  return carrito;
}

// Para componentes que funcionan con o sin carrito (el buscador, el menú): sin proveedor devuelve null
// y simplemente no ofrecen «Agregar al carrito».
export function useCarritoOpcional(): Carrito | null {
  return useContext(CarritoContexto);
}
