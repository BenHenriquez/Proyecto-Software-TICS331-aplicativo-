import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectorCantidad, { CANTIDAD_MAXIMA } from './SelectorCantidad';

// #17 Pantalla de selección de cantidad (US-15): selector con total a la vista y accesible.
// El precio y el total reales los calcula el backend; el total que se ve aquí es informativo.
const amlodipino = { codigo: 'MED-003', nombre: 'Amlodipino 5 mg', precioUnitario: 1490, stock: 80 };

function mostrar(medicamento = amlodipino) {
  const onContinuar = vi.fn();
  const usuario = userEvent.setup();
  render(<SelectorCantidad medicamento={medicamento} onContinuar={onContinuar} />);

  return {
    usuario,
    onContinuar,
    campo: () => screen.getByRole('spinbutton', { name: 'Cantidad' }) as HTMLInputElement,
    menos: () => screen.getByRole('button', { name: 'Disminuir cantidad' }),
    mas: () => screen.getByRole('button', { name: 'Aumentar cantidad' }),
    continuar: () => screen.getByRole('button', { name: 'Continuar con el pedido' }) as HTMLButtonElement,
  };
}

describe('SelectorCantidad', () => {
  describe('escenario feliz: elegir cantidad y ver el total', () => {
    it('muestra el medicamento, parte en 1 y calcula el total con esa cantidad', () => {
      const { campo } = mostrar();

      expect(screen.getByText('Amlodipino 5 mg')).toBeTruthy();
      expect(campo().value).toBe('1');
      expect(screen.getByText('Total: $1.490')).toBeTruthy();
    });

    it('los botones solo aparecen bloqueados en los límites, no siempre', async () => {
      const { usuario, mas, menos } = mostrar();
      const bloqueado = (boton: HTMLElement) => boton.getAttribute('aria-disabled') === 'true';

      expect(bloqueado(menos())).toBe(true); // en 1 no se puede bajar
      expect(bloqueado(mas())).toBe(false);

      await usuario.click(mas());

      expect(bloqueado(menos())).toBe(false);
      expect(bloqueado(mas())).toBe(false);
    });

    it('«+» sube la cantidad y el total se recalcula', async () => {
      const { usuario, mas, campo } = mostrar();

      await usuario.click(mas());
      await usuario.click(mas());

      expect(campo().value).toBe('3');
      expect(screen.getByText('Total: $4.470')).toBeTruthy();
    });

    it('«−» baja la cantidad pero nunca por debajo de 1', async () => {
      const { usuario, mas, menos, campo } = mostrar();

      await usuario.click(mas());
      await usuario.click(menos());
      await usuario.click(menos());

      expect(campo().value).toBe('1');
      expect(screen.getByText('Total: $1.490')).toBeTruthy();
      expect(menos().getAttribute('aria-disabled')).toBe('true');
    });

    it('escribir una cantidad en el campo actualiza el total', async () => {
      const { usuario, campo } = mostrar();

      await usuario.clear(campo());
      await usuario.type(campo(), '5');

      expect(screen.getByText('Total: $7.450')).toBeTruthy();
    });

    it('«Continuar con el pedido» entrega la cantidad elegida', async () => {
      const { usuario, mas, continuar, onContinuar } = mostrar();

      await usuario.click(mas());
      await usuario.click(continuar());

      expect(onContinuar).toHaveBeenCalledTimes(1);
      expect(onContinuar).toHaveBeenCalledWith(2);
    });
  });

  describe('la cantidad máxima es el menor entre el stock y 20', () => {
    it('con mucho stock, el máximo es 20 y «+» se bloquea ahí', async () => {
      const { usuario, campo, mas } = mostrar({ ...amlodipino, stock: 50 });

      await usuario.clear(campo());
      await usuario.type(campo(), String(CANTIDAD_MAXIMA));
      await usuario.click(mas());

      expect(CANTIDAD_MAXIMA).toBe(20);
      expect(campo().value).toBe('20');
      expect(mas().getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByText('Puedes pedir hasta 20 unidades.')).toBeTruthy();
    });

    it('con poco stock, el máximo es el stock disponible', async () => {
      const { usuario, mas, campo } = mostrar({ ...amlodipino, stock: 3 });

      await usuario.click(mas());
      await usuario.click(mas());
      await usuario.click(mas());

      expect(campo().value).toBe('3');
      expect(mas().getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByText('Puedes pedir hasta 3 unidades.')).toBeTruthy();
    });

    it('con una sola unidad lo dice en singular y no deja subir', async () => {
      const { usuario, mas, campo } = mostrar({ ...amlodipino, stock: 1 });

      await usuario.click(mas());

      expect(campo().value).toBe('1');
      expect(screen.getByText('Puedes pedir 1 unidad.')).toBeTruthy();
    });
  });

  describe('escenario de error: cantidad inválida', () => {
    it.each([
      ['cero', '0'],
      ['mayor que el máximo', '25'],
      ['decimal', '1.5'],
    ])('con una cantidad %s avisa y no deja continuar', async (_caso, texto) => {
      const { usuario, campo, continuar, onContinuar } = mostrar();

      // Se asigna el valor completo de una vez: escribir «1.5» tecla a tecla pasa por «1.», que
      // jsdom vacía en un campo numérico, y el test pasaría por el motivo equivocado.
      fireEvent.change(campo(), { target: { value: texto } });

      expect(campo().value).toBe(texto);
      expect(screen.getByRole('alert').textContent).toBe('Elige una cantidad entre 1 y 20.');
      expect(screen.getByText('Total: —')).toBeTruthy();
      expect(continuar().disabled).toBe(true);
      await usuario.click(continuar());
      expect(onContinuar).not.toHaveBeenCalled();
    });

    it('con el campo vacío avisa y no deja continuar', async () => {
      const { usuario, campo, continuar } = mostrar();

      await usuario.clear(campo());

      expect(screen.getByRole('alert')).toBeTruthy();
      expect(continuar().disabled).toBe(true);
    });

    it('al corregir la cantidad el aviso desaparece y se puede continuar', async () => {
      const { usuario, campo, continuar } = mostrar();

      await usuario.clear(campo());
      await usuario.type(campo(), '0');
      expect(screen.getByRole('alert')).toBeTruthy();

      await usuario.clear(campo());
      await usuario.type(campo(), '4');

      expect(screen.queryByRole('alert')).toBeNull();
      expect(continuar().disabled).toBe(false);
      expect(screen.getByText('Total: $5.960')).toBeTruthy();
    });

    it('«+» y «−» vuelven a un valor válido desde uno inválido', async () => {
      const { usuario, campo, mas } = mostrar();

      await usuario.clear(campo());
      await usuario.type(campo(), '0');
      await usuario.click(mas());

      expect(campo().value).toBe('1');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('con poco stock el aviso indica el máximo real', async () => {
      const { usuario, campo } = mostrar({ ...amlodipino, stock: 3 });

      await usuario.clear(campo());
      await usuario.type(campo(), '4');

      expect(screen.getByRole('alert').textContent).toBe('Elige una cantidad entre 1 y 3.');
    });

    it('con una sola unidad el aviso lo dice en singular', async () => {
      const { usuario, campo } = mostrar({ ...amlodipino, stock: 1 });

      await usuario.clear(campo());
      await usuario.type(campo(), '2');

      expect(screen.getByRole('alert').textContent).toBe('Solo hay 1 unidad disponible.');
    });
  });

  describe('estado sin stock', () => {
    it('informa «Sin stock» y no ofrece selector ni compra', () => {
      mostrar({ ...amlodipino, stock: 0 });

      expect(screen.getByText('Sin stock')).toBeTruthy();
      expect(screen.getByText('Este medicamento no tiene stock disponible por ahora.')).toBeTruthy();
      expect(screen.queryByRole('spinbutton')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('uso solo con teclado', () => {
    it('Tab recorre «−», el campo, «+» y «Continuar» en ese orden', async () => {
      const { usuario } = mostrar();
      const nombreEnfocado = () => {
        const el = document.activeElement as HTMLElement;
        return el.getAttribute('aria-label') ?? el.textContent;
      };

      await usuario.tab();
      expect(nombreEnfocado()).toBe('Disminuir cantidad');
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('spinbutton', { name: 'Cantidad' }));
      await usuario.tab();
      expect(nombreEnfocado()).toBe('Aumentar cantidad');
      await usuario.tab();
      expect(nombreEnfocado()).toBe('Continuar con el pedido');
    });

    it('«+» con Enter sube la cantidad y el foco se queda en el botón aunque llegue al máximo', async () => {
      const { usuario, mas, campo } = mostrar({ ...amlodipino, stock: 2 });

      mas().focus();
      await usuario.keyboard('{Enter}');
      await usuario.keyboard('{Enter}');

      expect(campo().value).toBe('2');
      expect(document.activeElement).toBe(mas());
    });

    it('Enter sobre «Continuar con el pedido» entrega la cantidad', async () => {
      const { usuario, mas, continuar, onContinuar } = mostrar();

      await usuario.click(mas());
      continuar().focus();
      await usuario.keyboard('{Enter}');

      expect(onContinuar).toHaveBeenCalledWith(2);
    });
  });

  describe('accesibilidad', () => {
    it('el total se anuncia a lectores de pantalla sin interrumpir', () => {
      mostrar();

      const total = screen.getByText('Total: $1.490');
      expect(total.tagName).toBe('OUTPUT');
      expect(total.getAttribute('aria-live')).toBe('polite');
    });

    it('aclara que el total definitivo lo confirma la farmacia', () => {
      mostrar();

      expect(screen.getByText(/el total final lo confirma la farmacia/i)).toBeTruthy();
    });
  });
});
