import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { SupplierDto } from '../../shared/models/api.models';
import { TERMS } from '../customers/customer.labels';

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const PHONE_RE = /^\+?[\d\s().\-/]{6,25}$/;
const optional = (re: RegExp, key: string) => (c: AbstractControl): ValidationErrors | null => (!c.value || re.test(String(c.value).trim()) ? null : { [key]: true });
const freeTermsRequired = (c: AbstractControl): ValidationErrors | null => (c.parent?.get('paymentPreset')?.value === 'free' && !String(c.value ?? '').trim() ? { required: true } : null);
/** Un fournisseur étranger est facturé dans une devise. */
const currencyRequired = (c: AbstractControl): ValidationErrors | null => (c.parent?.get('isForeign')?.value && !c.value ? { required: true } : null);

export function buildSupplierForm(fb: FormBuilder) {
  return fb.nonNullable.group({
    categoryId: [''], name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]], tradeName: ['', Validators.maxLength(150)], taxId: ['', Validators.maxLength(40)],
    address: fb.nonNullable.group({ street: ['', Validators.maxLength(200)], city: ['', Validators.maxLength(80)], postalCode: ['', Validators.maxLength(20)], country: ['Tunisie', Validators.maxLength(60)] }),
    phone: ['', optional(PHONE_RE, 'phone')], secondaryPhone: ['', optional(PHONE_RE, 'phone')], email: ['', Validators.email], website: ['', optional(URL_RE, 'url')],
    facebook: ['', optional(URL_RE, 'url')], linkedin: ['', optional(URL_RE, 'url')], instagram: ['', optional(URL_RE, 'url')], mapsUrl: ['', optional(URL_RE, 'url')],
    isForeign: [false], currency: ['', currencyRequired], leadTimeDays: [null as number | null, [Validators.min(0), Validators.max(1000)]],
    paymentPreset: ['0'], paymentTermsText: ['', [Validators.maxLength(500), freeTermsRequired]], paymentTermsCustom: [false], paymentDelayDays: [0, [Validators.min(0), Validators.max(365)]], paymentMethod: [''],
    discountPct: [0, [Validators.min(0), Validators.max(100)]], blockThreshold: [null as number | null, Validators.min(0)], notes: ['', Validators.maxLength(1000)],
  });
}
export type SupplierForm = ReturnType<typeof buildSupplierForm>;

const STANDARD_TERMS = /^(comptant|\d{1,3}\s*jours?)$/i;
/** Un texte libre (personnalisé ou hérité) s'ouvre dans le champ de saisie pour ne jamais être remplacé par un préréglage. */
function presetFor(days: number, terms: string | null, custom: boolean) {
  if (custom || (terms && !STANDARD_TERMS.test(terms.trim()))) return 'free';
  return TERMS.find((t) => t.days === days && (!terms || terms === t.label)) ? String(days) : 'custom';
}

export function patchSupplierForm(form: SupplierForm, s: SupplierDto, ref: ReferenceDataService) {
  const preset = presetFor(s.paymentDelayDays, s.paymentTerms, s.paymentTermsCustom);
  form.patchValue({
    categoryId: s.categoryId ?? '', name: s.name, tradeName: s.tradeName ?? '', taxId: s.taxId ?? '',
    address: { street: s.address.street ?? '', city: s.address.city ?? '', postalCode: s.address.postalCode ?? '', country: s.address.country ?? '' },
    phone: s.phoneInfo?.display ?? s.phone ?? '', secondaryPhone: s.secondaryPhoneInfo?.display ?? s.secondaryPhone ?? '', email: s.email ?? '', website: s.website ?? '',
    facebook: s.social.facebook ?? '', linkedin: s.social.linkedin ?? '', instagram: s.social.instagram ?? '', mapsUrl: s.mapsUrl ?? '',
    isForeign: s.isForeign, currency: s.currency ?? '', leadTimeDays: s.leadTimeDays, paymentPreset: preset, paymentTermsText: preset === 'free' ? s.paymentTerms ?? '' : '', paymentTermsCustom: s.paymentTermsCustom,
    paymentDelayDays: s.paymentDelayDays, paymentMethod: s.paymentMethod ?? '', discountPct: s.discountPct, blockThreshold: s.blockThresholdMinor == null ? null : ref.fromMinor(s.blockThresholdMinor), notes: s.notes ?? '',
  });
  form.controls.paymentTermsText.updateValueAndValidity(); form.controls.currency.updateValueAndValidity();
}

/** Préréglage (Comptant, 30, 60 jours), autre délai, ou conditions personnalisées en texte libre (jamais converties en échéances). */
export function applySupplierPreset(form: SupplierForm) {
  const p = form.controls.paymentPreset.value;
  if (p !== 'custom' && p !== 'free') form.controls.paymentDelayDays.setValue(Number(p));
  form.controls.paymentTermsCustom.setValue(p === 'free');
  form.controls.paymentTermsText.updateValueAndValidity();
}
const termsText = (preset: string, days: number) => (preset === 'custom' ? (days === 0 ? 'Comptant' : `${days} jours`) : (TERMS.find((t) => String(t.days) === preset)?.label ?? `${days} jours`));

/**
 * Corps de l'API. À la modification, un champ vidé est envoyé à null pour être effacé côté serveur.
 * Le seuil de blocage n'est envoyé que si l'utilisateur peut le voir (sinon la valeur enregistrée est conservée).
 */
export function supplierBody(form: SupplierForm, ref: ReferenceDataService, update: boolean, withAmounts: boolean) {
  const v = form.getRawValue(); const empty = update ? null : undefined;
  const s = (x: string) => (x.trim() ? x.trim() : empty);
  const f = (x: string) => (update ? x.trim() : x.trim() || undefined);
  const free = v.paymentPreset === 'free';
  const days = free && v.paymentTermsCustom ? 0 : Number(v.paymentDelayDays) || 0;
  const num = (x: number | null) => (x === null || (x as unknown) === '' ? null : Number(x));
  const threshold = num(v.blockThreshold); const lead = num(v.leadTimeDays);
  return {
    categoryId: v.categoryId || empty, name: v.name.trim(), tradeName: s(v.tradeName), taxId: s(v.taxId),
    address: { street: f(v.address.street), city: f(v.address.city), postalCode: f(v.address.postalCode), country: f(v.address.country) },
    phone: s(v.phone), secondaryPhone: s(v.secondaryPhone), email: s(v.email), website: s(v.website), social: { facebook: s(v.facebook), linkedin: s(v.linkedin), instagram: s(v.instagram) }, mapsUrl: s(v.mapsUrl),
    isForeign: v.isForeign, currency: v.isForeign ? v.currency : empty, leadTimeDays: lead ?? empty,
    paymentTerms: free ? v.paymentTermsText.trim() : termsText(v.paymentPreset, days), paymentTermsCustom: free && v.paymentTermsCustom, paymentDelayDays: days,
    paymentMethod: v.paymentMethod || empty, discountPct: Number(v.discountPct) || 0, notes: s(v.notes),
    ...(withAmounts && { blockThresholdMinor: threshold === null ? empty : ref.toMinor(threshold) }),
  };
}
