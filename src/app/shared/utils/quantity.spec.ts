import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { formatDecimal, parseDecimal } from '../directives/decimal-input.directive';
import { discountError, discountValidator, quantityError, quantityValidator } from './quantity';

const check = (decimals: number, value: number | null, opts = {}) => { const c = new FormControl(value, quantityValidator(() => decimals, opts)); return c.valid ? '' : quantityError(c); };

describe('saisie décimale à la française', () => {
  it('accepte la virgule et le point, les espaces de milliers (saisie et collage) ; refuse le texte', () => {
    expect([parseDecimal('1,5'), parseDecimal('1.5'), parseDecimal(' 1 234,5 '), parseDecimal('1 000'), parseDecimal('12'), parseDecimal(',5')]).toEqual([1.5, 1.5, 1234.5, 1000, 12, 0.5]);
    expect(parseDecimal('')).toBeNull(); for (const bad of ['abc', '1,2,3', '1.2.3', '12kg']) expect(parseDecimal(bad), bad).toBeNaN();
    expect(formatDecimal(1.5)).toBe('1,5'); expect(formatDecimal(null)).toBe(''); expect(formatDecimal(5200)).toBe('5200');
  });
});

describe('précision des quantités selon l’unité', () => {
  it('pièce : 1 accepté, 1,3 refusé', () => { expect(check(0, 1)).toBe(''); expect(check(0, 10)).toBe(''); expect(check(0, 1.3)).toBe('Nombre entier'); });
  it('mètre et kilogramme : une décimale', () => {
    expect(check(1, 1.5)).toBe(''); expect(check(1, 1.55)).toBe('1 chiffre après la virgule'); expect(check(1, 2.7)).toBe(''); expect(check(1, 2.75)).toBe('1 chiffre après la virgule');
  });
  it('positive et requise ; zéro et vide admis sur option ; texte refusé', () => {
    expect(check(0, 0)).toBe('Quantité positive requise'); expect(check(0, -1)).toBe('Quantité positive requise'); expect(check(0, Number.NaN)).toBe('Quantité positive requise'); expect(check(0, null)).toBe('Quantité requise');
    expect(check(0, 0, { allowZero: true })).toBe(''); expect(check(0, null, { optional: true })).toBe('');
  });
  it('une quantité reprise d’un document antérieur reste valable, toute autre saisie suit l’unité', () => {
    expect(check(0, 1.3, { carried: () => 1.3 })).toBe(''); expect(check(0, 1.4, { carried: () => 1.3 })).toBe('Nombre entier');
  });
});

describe('remises en pourcentage', () => {
  const d = (v: number | null) => { const c = new FormControl(v, discountValidator); return c.valid ? '' : discountError(c); };
  it('0 à 100 avec un chiffre après la virgule au plus', () => {
    for (const ok of [0, 5, 5.5, 12.7, 100, null]) expect(d(ok), `${ok}`).toBe('');
    for (const bad of [5.55, 0.01]) expect(d(bad), `${bad}`).toBe('1 chiffre après la virgule');
    expect(d(101)).toBe('0 à 100 %'); expect(d(-1)).toBe('0 à 100 %'); expect(d(Number.NaN)).toBe('0 à 100 %');
  });
});
