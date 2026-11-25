import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Customer2 } from '../../shared/models/api.models';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { TERMS } from './customer.labels';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const PHONE_RE = /^\+?[\d\s().\-/]{6,25}$/;
/** Champ facultatif : valide s'il est vide, sinon doit respecter le motif. */
const optional = (re: RegExp, key: string) => (c: AbstractControl): ValidationErrors | null => (!c.value || re.test(String(c.value).trim()) ? null : { [key]: true });

export function buildCustomerForm(fb: FormBuilder) {
  const addr = () => fb.nonNullable.group({ street: ['', Validators.maxLength(200)], city: ['', Validators.maxLength(80)], postalCode: ['', Validators.maxLength(20)], country: ['Tunisie', Validators.maxLength(60)] });
  return fb.nonNullable.group({
    type: ['company' as 'company' | 'walk_in'],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]], tradeName: ['', Validators.maxLength(150)], taxId: ['', Validators.maxLength(40)],
    registryNumber: ['', Validators.maxLength(60)], sector: ['', Validators.maxLength(100)],
    address: addr(), shippingSameAsBilling: [true], shippingAddress: addr(),
    phone: ['', optional(PHONE_RE, 'phone')], secondaryPhone: ['', optional(PHONE_RE, 'phone')], email: ['', Validators.email], website: ['', optional(URL_RE, 'url')],
    facebook: ['', optional(URL_RE, 'url')], linkedin: ['', optional(URL_RE, 'url')], instagram: ['', optional(URL_RE, 'url')], mapsUrl: ['', optional(URL_RE, 'url')],
    creditLimit: [null as number | null, Validators.min(0)], paymentPreset: ['0'], paymentDelayDays: [0, [Validators.min(0), Validators.max(365)]], paymentMethod: [''],
    discountPct: [0, [Validators.min(0), Validators.max(100)]], subjectToWithholding: [false], stampExempt: [false], notes: ['', Validators.maxLength(1000)],
  });
}
export type CustomerForm = ReturnType<typeof buildCustomerForm>;

const presetFor = (days: number, terms: string | null) => (TERMS.find((t) => t.days === days && (!terms || terms === t.label)) ? String(days) : 'custom');

export function patchCustomerForm(form: CustomerForm, c: Customer2, ref: ReferenceDataService) {
  form.patchValue({
    type: c.type, name: c.name, tradeName: c.tradeName ?? '', taxId: c.taxId ?? '', registryNumber: c.registryNumber ?? '', sector: c.sector ?? '',
    address: { street: c.address.street ?? '', city: c.address.city ?? '', postalCode: c.address.postalCode ?? '', country: c.address.country ?? '' },
    shippingSameAsBilling: c.shippingSameAsBilling, shippingAddress: { street: c.shippingAddress.street ?? '', city: c.shippingAddress.city ?? '', postalCode: c.shippingAddress.postalCode ?? '', country: c.shippingAddress.country ?? '' },
    phone: c.phone ?? '', secondaryPhone: c.secondaryPhone ?? '', email: c.email ?? '', website: c.website ?? '', facebook: c.social.facebook ?? '', linkedin: c.social.linkedin ?? '', instagram: c.social.instagram ?? '', mapsUrl: c.mapsUrl ?? '',
    creditLimit: c.creditLimitMinor == null ? null : ref.fromMinor(c.creditLimitMinor), paymentPreset: presetFor(c.paymentDelayDays, c.paymentTerms), paymentDelayDays: c.paymentDelayDays, paymentMethod: c.paymentMethod ?? '',
    discountPct: c.discountPct, subjectToWithholding: c.subjectToWithholding, stampExempt: c.stampExempt, notes: c.notes ?? '',
  });
}

/** Conditions de paiement : un préréglage (Comptant, 30, 60 jours) fixe le délai ; « Personnalisé » laisse saisir le nombre de jours. */
export function applyPreset(form: CustomerForm) {
  const p = form.controls.paymentPreset.value;
  if (p !== 'custom') form.controls.paymentDelayDays.setValue(Number(p));
}
const termsText = (preset: string, days: number) => (preset === 'custom' ? (days === 0 ? 'Comptant' : `${days} jours`) : (TERMS.find((t) => String(t.days) === preset)?.label ?? `${days} jours`));

/** Corps de l'API. À la modification, un champ vidé est envoyé à null pour être effacé côté serveur. */
export function customerBody(form: CustomerForm, ref: ReferenceDataService, update: boolean) {
  const v = form.getRawValue(); const empty = update ? null : undefined; const walkIn = v.type === 'walk_in';
  const s = (x: string) => (x.trim() ? x.trim() : empty);
  const f = (x: string) => (update ? x.trim() : x.trim() || undefined); // modification : '' efface la valeur
  const addr = (a: { street: string; city: string; postalCode: string; country: string }) => ({ street: f(a.street), city: f(a.city), postalCode: f(a.postalCode), country: f(a.country) });
  const days = Number(v.paymentDelayDays) || 0;
  return {
    type: v.type, name: v.name.trim(), tradeName: s(v.tradeName),
    // Les champs d'entreprise sont masqués pour un client Passager : leur éventuelle valeur saisie avant le changement de type n'est pas envoyée
    taxId: walkIn ? empty : s(v.taxId), registryNumber: walkIn ? empty : s(v.registryNumber), sector: walkIn ? empty : s(v.sector),
    address: addr(v.address), shippingSameAsBilling: v.shippingSameAsBilling, ...(!v.shippingSameAsBilling && { shippingAddress: addr(v.shippingAddress) }),
    phone: s(v.phone), secondaryPhone: s(v.secondaryPhone), email: s(v.email), website: s(v.website), social: { facebook: s(v.facebook), linkedin: s(v.linkedin), instagram: s(v.instagram) }, mapsUrl: s(v.mapsUrl),
    creditLimitMinor: v.creditLimit === null || (v.creditLimit as unknown) === '' ? null : ref.toMinor(Number(v.creditLimit)), paymentTerms: termsText(v.paymentPreset, days), paymentDelayDays: days,
    paymentMethod: v.paymentMethod || (update ? null : undefined), discountPct: Number(v.discountPct) || 0, subjectToWithholding: v.subjectToWithholding, stampExempt: v.stampExempt, notes: s(v.notes),
  };
}
