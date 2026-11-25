import { describe, expect, it } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { applyPreset, buildCustomerForm, customerBody } from './customer-form.model';

const ref = { toMinor: (n: number) => Math.round(n * 1000), fromMinor: (n: number) => n / 1000, decimals: () => 3, symbol: () => 'DT' } as unknown as ReferenceDataService;
const form = () => buildCustomerForm(new FormBuilder());

describe('formulaire client', () => {
  it('exige une raison sociale et valide e-mail, téléphone, URL et remise', () => {
    const f = form(); expect(f.valid).toBe(false);
    f.patchValue({ name: 'Société Exemple', email: 'pas-un-email', phone: 'abc', website: 'javascript:alert(1)', discountPct: 150 });
    expect(Object.keys(f.controls).filter((k) => (f.controls as Record<string, { invalid: boolean }>)[k]!.invalid).sort()).toEqual(['discountPct', 'email', 'phone', 'website']);
    f.patchValue({ email: 'a@b.tn', phone: '+216 71 000 000', website: 'https://exemple.tn', discountPct: 12.5 }); expect(f.valid).toBe(true);
    f.patchValue({ website: 'http://exemple.tn', mapsUrl: 'ftp://x' }); expect(f.controls.mapsUrl.invalid).toBe(true);
  });
  it('les préréglages de paiement fixent le délai ; « Personnalisé » conserve la saisie', () => {
    const f = form(); f.patchValue({ name: 'X1' });
    f.controls.paymentPreset.setValue('60'); applyPreset(f); expect(f.controls.paymentDelayDays.value).toBe(60);
    f.controls.paymentPreset.setValue('0'); applyPreset(f); expect(f.controls.paymentDelayDays.value).toBe(0);
    f.controls.paymentPreset.setValue('custom'); f.controls.paymentDelayDays.setValue(45); applyPreset(f); expect(f.controls.paymentDelayDays.value).toBe(45);
    expect(customerBody(f, ref, false).paymentTerms).toBe('45 jours'); f.controls.paymentPreset.setValue('30'); applyPreset(f); expect(customerBody(f, ref, false).paymentTerms).toBe('30 jours');
  });
  it('corps de l’API : montants en plus petite unité, champs vides ignorés à la création et effacés (null) à la modification', () => {
    const f = form(); f.patchValue({ name: ' Client ', creditLimit: 5000.5, tradeName: '', phone: '' });
    const create = customerBody(f, ref, false); expect(create).toMatchObject({ name: 'Client', creditLimitMinor: 5_000_500, tradeName: undefined, phone: undefined });
    const update = customerBody(f, ref, true); expect(update).toMatchObject({ tradeName: null, phone: null, creditLimitMinor: 5_000_500 });
    f.patchValue({ creditLimit: null }); expect(customerBody(f, ref, true).creditLimitMinor).toBeNull(); // plafond vide = illimité
  });
  it('un client Passager n’envoie jamais matricule, RC ni secteur', () => {
    const f = form(); f.patchValue({ type: 'walk_in', name: 'Passage', taxId: '123', registryNumber: 'RC', sector: 'x' });
    expect(customerBody(f, ref, false)).toMatchObject({ taxId: undefined, registryNumber: undefined, sector: undefined });
    expect(customerBody(f, ref, true)).toMatchObject({ taxId: null, registryNumber: null, sector: null });
  });
  it('adresse de livraison : envoyée seulement si elle diffère de la facturation', () => {
    const f = form(); f.patchValue({ name: 'Adr', shippingSameAsBilling: true, shippingAddress: { street: 'Dépôt', city: 'Sfax' } });
    expect('shippingAddress' in customerBody(f, ref, true)).toBe(false);
    f.patchValue({ shippingSameAsBilling: false }); expect((customerBody(f, ref, true) as { shippingAddress: { city: string } }).shippingAddress.city).toBe('Sfax');
  });
});
