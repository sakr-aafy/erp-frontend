import { describe, expect, it } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { Customer2 } from '../../shared/models/api.models';
import { applyPreset, buildCustomerForm, customerBody, patchCustomerForm } from './customer-form.model';

const ref = { toMinor: (n: number) => Math.round(n * 1000), fromMinor: (n: number) => n / 1000, decimals: () => 3, symbol: () => 'DT' } as unknown as ReferenceDataService;
const form = () => buildCustomerForm(new FormBuilder());
const client = (o: Partial<Customer2>) => ({ type: 'company', name: 'Client', tradeName: null, taxId: null, address: {}, phone: null, phoneInfo: null, secondaryPhone: null, secondaryPhoneInfo: null, email: null, website: null,
  social: { facebook: null, linkedin: null, instagram: null }, mapsUrl: null, creditLimitMinor: null, paymentTerms: null, paymentTermsCustom: false, paymentDelayDays: 0, paymentMethod: null, discountPct: 0,
  subjectToWithholding: false, stampExempt: false, notes: null, ...o }) as unknown as Customer2;

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
  it('une condition de la liste fixe son libellé et son délai ; sans délai, les échéances se saisissent sur la facture', () => {
    const f = form(); f.patchValue({ name: 'X1' });
    f.controls.paymentPreset.setValue('term:Paiement avant expédition'); applyPreset(f, { label: 'Paiement avant expédition', delayDays: null });
    expect(customerBody(f, ref, false)).toMatchObject({ paymentTerms: 'Paiement avant expédition', paymentTermsCustom: true, paymentDelayDays: 0 });
    f.controls.paymentPreset.setValue('term:Fin de mois'); applyPreset(f, { label: 'Fin de mois', delayDays: 45 });
    expect(customerBody(f, ref, false)).toMatchObject({ paymentTerms: 'Fin de mois', paymentTermsCustom: false, paymentDelayDays: 45 });
    f.controls.paymentPreset.setValue('90'); applyPreset(f); expect(customerBody(f, ref, false)).toMatchObject({ paymentTerms: '90 jours', paymentDelayDays: 90 });
  });
  it('corps de l’API : montants en plus petite unité, champs vides ignorés à la création et effacés (null) à la modification', () => {
    const f = form(); f.patchValue({ name: ' Client ', creditLimit: 5000.5, tradeName: '', phone: '' });
    const create = customerBody(f, ref, false); expect(create).toMatchObject({ name: 'Client', creditLimitMinor: 5_000_500, tradeName: undefined, phone: undefined });
    const update = customerBody(f, ref, true); expect(update).toMatchObject({ tradeName: null, phone: null, creditLimitMinor: 5_000_500 });
    f.patchValue({ creditLimit: null }); expect(customerBody(f, ref, true).creditLimitMinor).toBeNull(); // plafond vide = illimité
  });
  it('un client Passager n’envoie pas de matricule fiscal ; RC et secteur n’existent plus', () => {
    const f = form(); f.patchValue({ type: 'walk_in', name: 'Passage', taxId: '123' });
    expect(customerBody(f, ref, false)).toMatchObject({ taxId: undefined });
    expect(customerBody(f, ref, true)).toMatchObject({ taxId: null });
    for (const k of ['registryNumber', 'sector', 'shippingAddress', 'shippingSameAsBilling']) { expect(k in f.controls).toBe(false); expect(k in customerBody(f, ref, true)).toBe(false); }
  });
  it('nouveau client : retenue à la source activée, timbre non exonéré, modifiables', () => {
    const f = form(); f.patchValue({ name: 'Nouveau' });
    expect(customerBody(f, ref, false)).toMatchObject({ subjectToWithholding: true, stampExempt: false });
    f.patchValue({ subjectToWithholding: false, stampExempt: true }); expect(customerBody(f, ref, false)).toMatchObject({ subjectToWithholding: false, stampExempt: true });
  });
  it('un client existant conserve ses réglages fiscaux et ses numéros s’affichent au format lisible', () => {
    const f = form();
    patchCustomerForm(f, client({ subjectToWithholding: false, stampExempt: true, phone: '+21623108065', phoneInfo: { display: '+216 23 108 065', href: 'tel:+21623108065', valid: true } }), ref);
    expect(f.controls.subjectToWithholding.value).toBe(false); expect(f.controls.stampExempt.value).toBe(true); expect(f.controls.phone.value).toBe('+216 23 108 065');
  });
  it('conditions personnalisées : texte obligatoire, aucun délai déduit du texte', () => {
    const f = form(); f.patchValue({ name: 'Libre' }); f.controls.paymentPreset.setValue('30'); applyPreset(f);
    f.controls.paymentPreset.setValue('free'); applyPreset(f); expect(f.controls.paymentTermsText.invalid).toBe(true); expect(f.valid).toBe(false);
    f.controls.paymentTermsText.setValue(' 30 % à la commande et le solde avant la livraison ');
    expect(f.valid).toBe(true);
    expect(customerBody(f, ref, false)).toMatchObject({ paymentTerms: '30 % à la commande et le solde avant la livraison', paymentTermsCustom: true, paymentDelayDays: 0 });
    f.controls.paymentPreset.setValue('60'); applyPreset(f); expect(f.valid).toBe(true);
    expect(customerBody(f, ref, false)).toMatchObject({ paymentTerms: '60 jours', paymentTermsCustom: false, paymentDelayDays: 60 });
  });
  it('relecture : conditions personnalisées restaurées ; un ancien texte libre n’est pas remplacé', () => {
    const f = form();
    patchCustomerForm(f, client({ paymentTerms: 'Paiement selon contrat', paymentTermsCustom: true }), ref);
    expect(f.controls.paymentPreset.value).toBe('free'); expect(f.controls.paymentTermsText.value).toBe('Paiement selon contrat');
    patchCustomerForm(f, client({ paymentTerms: '30 jours fin de mois', paymentTermsCustom: false, paymentDelayDays: 30 }), ref);
    expect(customerBody(f, ref, true)).toMatchObject({ paymentTerms: '30 jours fin de mois', paymentTermsCustom: false, paymentDelayDays: 30 });
    patchCustomerForm(f, client({ paymentTerms: '30 jours', paymentDelayDays: 30 }), ref);
    expect(f.controls.paymentPreset.value).toBe('30');
  });
});
