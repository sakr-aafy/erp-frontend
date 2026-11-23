import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { passwordPolicy } from './password-rules';

describe('passwordPolicy', () => {
  const check = (v: string) => passwordPolicy(new FormControl(v));
  it('accepte un mot de passe conforme', () => expect(check('Str0ng#Passw0rd')).toBeNull());
  it('signale chaque règle manquante', () => {
    expect(check('short')).toMatchObject({ minlength: true, upper: true, digit: true, special: true });
    expect(check('alllowercase1!')).toMatchObject({ upper: true });
    expect(check('ALLUPPERCASE1!')).toMatchObject({ lower: true });
    expect(check('NoDigitsHere!!')).toMatchObject({ digit: true });
    expect(check('NoSpecial12345')).toMatchObject({ special: true });
  });
});
