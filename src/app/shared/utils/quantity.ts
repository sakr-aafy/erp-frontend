import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Précision d'une quantité : le serveur applique les mêmes règles (l'unité de l'article fait foi). */
export const MAX_DECIMALS = 3;
export const hasPrecision = (v: number, decimals: number) => Math.abs(v * 10 ** decimals - Math.round(v * 10 ** decimals)) < 1e-6;
export const precisionMessage = (decimals: number) => (decimals === 0 ? 'Nombre entier' : decimals === 1 ? '1 chiffre après la virgule' : `${decimals} chiffres après la virgule au plus`);

/** Quantité saisie : requise, positive (ou nulle avec `allowZero`), au nombre de décimales de l'unité. */
export function quantityValidator(decimals: () => number, opts: { allowZero?: boolean; optional?: boolean; carried?: () => number | null | undefined } = {}): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value as number | null | string;
    if (v === null || v === '') return opts.optional ? null : { required: true };
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || (n === 0 && !opts.allowZero)) return { positive: true };
    const carried = opts.carried?.();
    if (carried !== null && carried !== undefined && Math.abs(carried - n) < 1e-9) return null; // quantité reprise d'un document antérieur
    const d = decimals();
    return hasPrecision(n, d) ? null : { precision: d };
  };
}
export const quantityError = (c: AbstractControl): string => {
  const e = c.errors; if (!e) return '';
  return e['precision'] !== undefined ? precisionMessage(e['precision'] as number) : e['required'] ? 'Quantité requise' : 'Quantité positive requise';
};
/** Remise en pourcentage : 0 à 100, un chiffre après la virgule au plus. */
export const discountValidator: ValidatorFn = (c) => {
  if (c.value === null || c.value === '') return null;
  const n = Number(c.value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { range: true };
  return hasPrecision(n, 1) ? null : { precision: 1 };
};
export const discountError = (c: AbstractControl) => (c.errors?.['precision'] !== undefined ? '1 chiffre après la virgule' : c.errors ? '0 à 100 %' : '');
