import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cerrarSesion, obtenerSesion, type Vecino } from './api';

// US-17 (#48). Quién ingresó con Neuro-Access, compartido por la cabecera, el ingreso y la compra.
// Fuera de un SesionProvider (por ejemplo, en tests de una sola pantalla) no hay vecino.
interface Sesion {
  vecino: Vecino | null;
  // Vuelve a preguntar al backend (después de ingresar).
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
}

const SesionContexto = createContext<Sesion>({
  vecino: null,
  recargar: async () => {},
  salir: async () => {},
});

export function SesionProvider({ children }: { children: ReactNode }) {
  const [vecino, setVecino] = useState<Vecino | null>(null);

  const recargar = useCallback(async () => {
    try {
      setVecino(await obtenerSesion());
    } catch {
      // Sin conexión no se sabe si hay sesión: se trata como no ingresado; buscar y comprar siguen funcionando.
      setVecino(null);
    }
  }, []);

  const salir = useCallback(async () => {
    try {
      await cerrarSesion();
    } finally {
      setVecino(null);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const valor = useMemo(() => ({ vecino, recargar, salir }), [vecino, recargar, salir]);
  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export function useSesion(): Sesion {
  return useContext(SesionContexto);
}
