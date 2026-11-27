import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Customer2 } from '../../shared/models/api.models';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { discountValidator } from '../../shared/utils/quantity';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const PHONE_RE = /^\+?[\d\s().\-/]{6,25}$/;
/** Champ facultatif : valide s'il est vide, sinon doit respecter le motif. */
const optional = (re: RegExp, key: string) => (c: AbstractControl): ValidationErrors | null => (!c.value || re.test(String(c.value).trim()) ? null : { [key]: true });

/** Conditions personnalisées : le texte est alors obligatoire. */
const freeTermsRequired = (c: AbstractControl): ValidationErrors | null => (c.parent?.get('paymentPreset')?.value === 'free' && !String(c.value ?? '').trim() ? { required: true } : null);

export function buildCustomerForm(fb: FormBuilder) {
  const addr = () => fb.nonNullable.group({ street: ['', Validators.maxLength(200)], city: ['', Validators.maxLength(80)], postalCode: ['', Validators.maxLength(20)], country: ['Tunisie', Validators.maxLength(60)] });
  return fb.nonNullable.group({
    type: ['company' as 'company' | 'walk_in'],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]], tradeName: ['', Validators.maxLength(150)], taxId: ['', Validators.maxLength(40)],
    address: addr(),
    phone: ['', optional(PHONE_RE, 'phone')], secondaryPhone: ['', optional(PHONE_RE, 'phone')], email: ['', Validators.email], website: ['', optional(URL_RE, 'url')],
    facebook: ['', optional(URL_RE, 'url')], linkedin: ['', optional(URL_RE, 'url')], instagram: ['', optional(URL_RE, 'url')], mapsUrl: ['', optional(URL_RE, 'url')],
    creditLimit: [null as number | null, Validators.min(0)], paymentPreset: ['0'], paymentTermsText: ['', [Validators.maxLength(500), freeTermsRequired]], paymentTermsCustom: [false], paymentDelayDays: [0, [Validators.min(0), Validators.max(365)]], paymentMethod: [''],
    discountPct: [0, discountValidator], // Valeurs fiscales par défaut d'un nouveau client : assujetti à la retenue, non exonéré du timbre
    subjectToWithholding: [true], stampExempt: [false], notes: ['', Validators.maxLength(1000)],
  });
}
export type CustomerForm = ReturnType<typeof buildCustomerForm>;

const STANDARD_TERMS = /^(comptant|\d{1,3}\s*jours?)$/i;
/** Un texte libre (personnalisé ou hérité) s'ouvre dans le champ de saisie pour ne jamais être remplacé par un préréglage. */
function presetFor(days: number, terms: string | null, custom: boolean) {
  if (custom || (terms && !STANDARD_TERMS.test(terms.trim()))) return 'free';
  return !terms || terms === daysLabel(days) ? String(days) : 'custom';
}

export function patchCustomerForm(form: CustomerForm, c: Customer2, ref: ReferenceDataService) {
  const preset = presetFor(c.paymentDelayDays, c.paymentTerms, c.paymentTermsCustom);
  form.patchValue({
    type: c.type, name: c.name, tradeName: c.tradeName ?? '', taxId: c.taxId ?? '',
    address: { street: c.address.street ?? '', city: c.address.city ?? '', postalCode: c.address.postalCode ?? '', country: c.address.country ?? '' },
    phone: c.phoneInfo?.display ?? c.phone ?? '', secondaryPhone: c.secondaryPhoneInfo?.display ?? c.secondaryPhone ?? '', email: c.email ?? '', website: c.website ?? '', facebook: c.social.facebook ?? '', linkedin: c.social.linkedin ?? '', instagram: c.social.instagram ?? '', mapsUrl: c.mapsUrl ?? '',
    creditLimit: c.creditLimitMinor == null ? null : ref.fromMinor(c.creditLimitMinor), paymentPreset: preset, paymentTermsText: preset === 'free' ? c.paymentTerms ?? '' : '', paymentTermsCustom: c.paymentTermsCustom, paymentDelayDays: c.paymentDelayDays, paymentMethod: c.paymentMethod ?? '',
    discountPct: c.discountPct, subjectToWithholding: c.subjectToWithholding, stampExempt: c.stampExempt, notes: c.notes ?? '',
  });
  form.controls.paymentTermsText.updateValueAndValidity();
}

/** Condition administrable choisie dans la liste (les délais « N jours » gardent leur valeur numérique). */
export const TERM_PREFIX = 'term:';
export interface TermChoice { label: string; delayDays: number | null }
export const termValue = (t: TermChoice) => (t.delayDays !== null && t.label === daysLabel(t.delayDays) ? String(t.delayDays) : `${TERM_PREFIX}${t.label}`);
export const daysLabel = (days: number) => (days === 0 ? 'Comptant' : `${days} jours`);

/**
 * Choix des conditions de paiement : une condition de la liste fixe son délai (aucun pour une description : les échéances se
 * saisissent sur la facture) ; « Autre délai » laisse saisir le nombre de jours ; « Texte libre » ouvre une saisie.
 */
export function applyPreset(form: CustomerForm, term?: TermChoice) {
  const p = form.controls.paymentPreset.value;
  if (p.startsWith(TERM_PREFIX)) { form.controls.paymentDelayDays.setValue(term?.delayDays ?? 0); form.controls.paymentTermsCustom.setValue(!term || term.delayDays === null); }
  else { if (p !== 'custom' && p !== 'free') form.controls.paymentDelayDays.setValue(Number(p)); form.controls.paymentTermsCustom.setValue(p === 'free'); }
  form.controls.paymentTermsText.updateValueAndValidity();
}
const termsText = (preset: string, days: number) => (preset.startsWith(TERM_PREFIX) ? preset.slice(TERM_PREFIX.length) : daysLabel(preset === 'custom' ? days : Number(preset)));

/** Corps de l'API. À la modification, un champ vidé est envoyé à null pour être effacé côté serveur. */
export function customerBody(form: CustomerForm, ref: ReferenceDataService, update: boolean) {
  const v = form.getRawValue(); const empty = update ? null : undefined; const walkIn = v.type === 'walk_in';
  const s = (x: string) => (x.trim() ? x.trim() : empty);
  const f = (x: string) => (update ? x.trim() : x.trim() || undefined); // modification : '' efface la valeur
  const addr = (a: { street: string; city: string; postalCode: string; country: string }) => ({ street: f(a.street), city: f(a.city), postalCode: f(a.postalCode), country: f(a.country) });
  const free = v.paymentPreset === 'free';
  const days = (free || v.paymentPreset.startsWith(TERM_PREFIX)) && v.paymentTermsCustom ? 0 : Number(v.paymentDelayDays) || 0;
  return {
    type: v.type, name: v.name.trim(), tradeName: s(v.tradeName),
    // Les champs d'entreprise sont masqués pour un client Passager : leur éventuelle valeur saisie avant le changement de type n'est pas envoyée
    taxId: walkIn ? empty : s(v.taxId),
    address: addr(v.address),
    phone: s(v.phone), secondaryPhone: s(v.secondaryPhone), email: s(v.email), website: s(v.website), social: { facebook: s(v.facebook), linkedin: s(v.linkedin), instagram: s(v.instagram) }, mapsUrl: s(v.mapsUrl),
    creditLimitMinor: v.creditLimit === null || (v.creditLimit as unknown) === '' ? null : ref.toMinor(Number(v.creditLimit)), paymentTerms: free ? v.paymentTermsText.trim() : termsText(v.paymentPreset, days), paymentTermsCustom: (free || v.paymentPreset.startsWith(TERM_PREFIX)) && v.paymentTermsCustom, paymentDelayDays: days,
    paymentMethod: v.paymentMethod || (update ? null : undefined), discountPct: Number(v.discountPct) || 0, subjectToWithholding: v.subjectToWithholding, stampExempt: v.stampExempt, notes: s(v.notes),
  };
}
