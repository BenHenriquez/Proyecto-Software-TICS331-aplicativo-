import { describe, expect, it } from 'vitest';
import { formatoPesos } from './formato';

describe('formatoPesos', () => {
  it.each([
    [990, '$990'],
    [1490, '$1.490'],
    [2980, '$2.980'],
    [120000, '$120.000'],
  ])('muestra %i como %s', (monto, esperado) => {
    expect(formatoPesos(monto)).toBe(esperado);
  });
});
