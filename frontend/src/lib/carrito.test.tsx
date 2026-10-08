import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CarritoProvider, MEDICAMENTOS_MAXIMOS, useCarrito, useCarritoOpcional, type Carrito } from './carrito';

// US-16 Carrito (#42): el estado del carrito en el navegador. El precio guardado es solo de referencia:
// el pedido real lo calcula el backend.
const CLAVE = 'farmacia.carrito';
const losartan = { codigo: 'MED-001', nombre: 'Losartán 50 mg', precioUnitario: 1990 };
const amlodipino = { codigo: 'MED-003', nombre: 'Amlodipino 5 mg', precioUnitario: 1490 };

const envoltorio = ({ children }: { children: ReactNode }) => <CarritoProvider>{children}</CarritoProvider>;
const montar = () => renderHook(() => useCarrito(), { wrapper: envoltorio });
const guardado = () => JSON.parse(window.localStorage.getItem(CLAVE) ?? 'null');

beforeEach(() => {
  window.localStorage.clear();
});

describe('carrito', () => {
  it('empieza vacío', () => {
    const { result } = montar();
    expect(result.current.items).toEqual([]);
    expect(result.current.unidades).toBe(0);
    expect(result.current.totalEstimado).toBe(0);
  });

  it('agrega un medicamento y calcula unidades y total estimado', () => {
    const { result } = montar();

    act(() => {
      result.current.agregar(losartan, 2);
      result.current.agregar(amlodipino, 1);
    });

    expect(result.current.items.map((i) => [i.codigo, i.cantidad])).toEqual([
      ['MED-001', 2],
      ['MED-003', 1],
    ]);
    expect(result.current.unidades).toBe(3);
    expect(result.current.totalEstimado).toBe(2 * 1990 + 1490);
  });

  it('si agrega el mismo medicamento, suma la cantidad en vez de repetirlo', () => {
    const { result } = montar();

    act(() => void result.current.agregar(losartan, 2));
    let r: ReturnType<Carrito['agregar']> | undefined;
    act(() => {
      r = result.current.agregar(losartan, 3);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidad).toBe(5);
    expect(r).toEqual({ ok: true, cantidad: 5, recortada: false });
  });

  it('no pasa de 20 unidades por medicamento y avisa que recortó', () => {
    const { result } = montar();

    act(() => void result.current.agregar(losartan, 18));
    let r: ReturnType<Carrito['agregar']> | undefined;
    act(() => {
      r = result.current.agregar(losartan, 5);
    });

    expect(result.current.items[0].cantidad).toBe(20);
    expect(r).toEqual({ ok: true, cantidad: 20, recortada: true });
  });

  it(`no admite más de ${MEDICAMENTOS_MAXIMOS} medicamentos distintos, pero sí sumar a uno que ya está`, () => {
    const { result } = montar();
    act(() => {
      for (let i = 1; i <= MEDICAMENTOS_MAXIMOS; i++) {
        result.current.agregar({ codigo: `MED-${i}`, nombre: `Medicamento ${i}`, precioUnitario: 1000 }, 1);
      }
    });
    expect(result.current.items).toHaveLength(MEDICAMENTOS_MAXIMOS);

    let lleno: ReturnType<Carrito['agregar']> | undefined;
    let repetido: ReturnType<Carrito['agregar']> | undefined;
    act(() => {
      lleno = result.current.agregar({ codigo: 'MED-99', nombre: 'Otro', precioUnitario: 1000 }, 1);
      repetido = result.current.agregar({ codigo: 'MED-1', nombre: 'Medicamento 1', precioUnitario: 1000 }, 1);
    });

    expect(lleno).toEqual({ ok: false, motivo: 'carrito_lleno' });
    expect(repetido?.ok).toBe(true);
    expect(result.current.items).toHaveLength(MEDICAMENTOS_MAXIMOS);
  });

  it('actualiza el precio de referencia al que vio en la última búsqueda', () => {
    const { result } = montar();
    act(() => void result.current.agregar(losartan, 1));
    act(() => void result.current.agregar({ ...losartan, precioUnitario: 2100 }, 1));
    expect(result.current.items[0]).toMatchObject({ cantidad: 2, precioUnitario: 2100 });
  });

  it('cambia la cantidad dentro de 1 y 20', () => {
    const { result } = montar();
    act(() => void result.current.agregar(losartan, 2));

    act(() => result.current.cambiarCantidad('MED-001', 7));
    expect(result.current.items[0].cantidad).toBe(7);
    act(() => result.current.cambiarCantidad('MED-001', 0));
    expect(result.current.items[0].cantidad).toBe(1);
    act(() => result.current.cambiarCantidad('MED-001', 99));
    expect(result.current.items[0].cantidad).toBe(20);
  });

  it('quita un medicamento sin tocar los demás, y vacía el carrito', () => {
    const { result } = montar();
    act(() => {
      result.current.agregar(losartan, 1);
      result.current.agregar(amlodipino, 1);
    });

    act(() => result.current.quitar('MED-001'));
    expect(result.current.items.map((i) => i.codigo)).toEqual(['MED-003']);

    act(() => result.current.vaciar());
    expect(result.current.items).toEqual([]);
  });

  describe('se conserva al recargar la página', () => {
    it('guarda el carrito en el navegador y lo recupera', () => {
      const primero = montar();
      act(() => void primero.result.current.agregar(losartan, 3));
      expect(guardado()).toEqual([{ ...losartan, cantidad: 3 }]);
      primero.unmount();

      const segundo = montar();
      expect(segundo.result.current.items).toEqual([{ ...losartan, cantidad: 3 }]);
    });

    it('lo guardado nunca incluye precios finales ni totales: solo lo que la vecina eligió', () => {
      const { result } = montar();
      act(() => void result.current.agregar(losartan, 2));
      expect(Object.keys(guardado()[0]).sort()).toEqual(['cantidad', 'codigo', 'nombre', 'precioUnitario']);
    });

    it.each([
      ['texto que no es JSON', 'esto no es json'],
      ['un objeto en vez de una lista', '{"codigo":"MED-001"}'],
      ['una lista de números', '[1,2,3]'],
    ])('si lo guardado es %s, empieza con el carrito vacío', (_caso, crudo) => {
      window.localStorage.setItem(CLAVE, crudo);
      expect(montar().result.current.items).toEqual([]);
    });

    it('descarta ítems alterados o repetidos y conserva los válidos', () => {
      window.localStorage.setItem(
        CLAVE,
        JSON.stringify([
          { ...losartan, cantidad: 2 },
          { ...losartan, cantidad: 9 }, // repetido
          { codigo: 'MED-002', nombre: 'Otro', precioUnitario: 1000, cantidad: 0 }, // cantidad inválida
          { codigo: 'MED-004', nombre: 'Otro', precioUnitario: -5, cantidad: 1 }, // precio inválido
          { codigo: 'MED-005', nombre: 'Otro', precioUnitario: 1000, cantidad: 21 }, // sobre el máximo
          { ...amlodipino, cantidad: 1 },
        ]),
      );
      expect(montar().result.current.items).toEqual([
        { ...losartan, cantidad: 2 },
        { ...amlodipino, cantidad: 1 },
      ]);
    });

    it('si el navegador no deja leer ni guardar, el carrito igual funciona mientras la página esté abierta', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('bloqueado');
        },
      });
      try {
        const { result } = montar();
        act(() => void result.current.agregar(losartan, 2));
        expect(result.current.items).toHaveLength(1);
      } finally {
        Object.defineProperty(window, 'localStorage', original);
      }
    });
  });

  describe('uso sin proveedor', () => {
    it('useCarritoOpcional devuelve null para que el buscador y el menú funcionen sin carrito', () => {
      const { result } = renderHook(() => useCarritoOpcional());
      expect(result.current).toBeNull();
    });

    it('useCarrito avisa con un error claro si falta el proveedor', () => {
      const silenciar = (e: ErrorEvent) => e.preventDefault();
      window.addEventListener('error', silenciar);
      try {
        expect(() => render(<Sonda />)).toThrow(/CarritoProvider/);
      } finally {
        window.removeEventListener('error', silenciar);
      }
    });
  });
});

function Sonda() {
  useCarrito();
  return null;
}
