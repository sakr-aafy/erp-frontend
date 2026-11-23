import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Même politique que le backend (le backend reste l'autorité). */
export function passwordPolicy(c: AbstractControl): ValidationErrors | null {
  const v: string = c.value ?? '';
  const errors: Record<string, true> = {};
  if (v.length < 10) errors['minlength'] = true;
  if (!/[a-z]/.test(v)) errors['lower'] = true;
  if (!/[A-Z]/.test(v)) errors['upper'] = true;
  if (!/[0-9]/.test(v)) errors['digit'] = true;
  if (!/[^A-Za-z0-9]/.test(v)) errors['special'] = true;
  return Object.keys(errors).length ? errors : null;
}
export const PASSWORD_HINT = '10 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial';
