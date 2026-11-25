import { AbstractControl, FormBuilder, FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ProductDto } from '../../shared/models/api.models';

export interface SupplierRef { id: string; name: string }
const NGP_RE = /^[0-9A-Za-z .-]{0,20}$/;
const pattern = (re: RegExp, key: string): ValidatorFn => (c: AbstractControl): ValidationErrors | null => (!c.value || re.test(String(c.value)) ? null : { [key]: true });
const intMin1: ValidatorFn = (c) => (c.value === null || c.value === '' || (Number.isInteger(Number(c.value)) && Number(c.value) >= 1) ? null : { parcel: true });

/** Volume d'un colis (m³) = L × l × h (mm) / 1 000 000 000 ; total = volume × colis seulement si les dimensions sont celles d'un colis. Le serveur recalcule toujours. */
export function volumes(f: { lengthMm: number | null; widthMm: number | null; heightMm: number | null; parcelCount: number | null; dimensionsPerParcel: boolean }) {
  const [l, w, h] = [f.lengthMm, f.widthMm, f.heightMm].map((x) => (x === null || (x as unknown) === '' ? NaN : Number(x)));
  if ([l, w, h].some((x) => !Number.isFinite(x))) return { unit: null as number | null, total: null as number | null, multiplied: false };
  const unit = Math.round((l! * w! * h!) / 1_000_000_000 * 1e9) / 1e9; const n = f.parcelCount ? Number(f.parcelCount) : 0;
  const multiplied = f.dimensionsPerParcel && n > 1;
  return { unit, total: multiplied ? Math.round(unit * n * 1e9) / 1e9 : unit, multiplied };
}

/** Règles croisées : poids brut ≥ poids net ; prix minimum de vente ≤ prix de vente. */
const crossRules: ValidatorFn = (g) => {
  const v = g.value as { netWeightKg: number | null; grossWeightKg: number | null; minSalePrice: number | null; salePrice: number | null };
  const e: ValidationErrors = {};
  if (v.netWeightKg !== null && v.grossWeightKg !== null && (v.netWeightKg as unknown) !== '' && (v.grossWeightKg as unknown) !== '' && Number(v.grossWeightKg) < Number(v.netWeightKg)) e['grossBelowNet'] = true;
  if (v.minSalePrice !== null && (v.minSalePrice as unknown) !== '' && v.salePrice !== null && Number(v.minSalePrice) > Number(v.salePrice)) e['minAboveSale'] = true;
  return Object.keys(e).length ? e : null;
};

export function buildProductForm(fb: FormBuilder, baseCurrency: string) {
  const dim = () => new FormControl<number | null>(null, [Validators.min(0), Validators.max(1e7)]);
  return fb.nonNullable.group({
    // 1. Général
    reference: ['', [Validators.required, Validators.maxLength(60)]], name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]], brand: ['', Validators.maxLength(80)], model: ['', Validators.maxLength(80)],
    familyId: [''], subId: [''], unitId: ['', Validators.required], kind: ['product' as 'product' | 'service'], description: ['', Validators.maxLength(2000)],
    // 2. Packaging
    lengthMm: dim(), widthMm: dim(), heightMm: dim(), netWeightKg: dim(), grossWeightKg: dim(), packType: [''], packTypeLabel: ['', Validators.maxLength(60)],
    parcelCount: new FormControl<number | null>(null, [intMin1, Validators.max(1e6)]), dimensionsPerParcel: [true],
    // 3. Prix
    purchaseCurrency: [baseCurrency], purchasePrice: new FormControl<number | null>(null, Validators.min(0)), purchaseForeign: new FormControl<number | null>(null, Validators.min(0)), estimatedCost: new FormControl<number | null>(null, Validators.min(0)),
    mainSupplier: new FormControl<SupplierRef | null>(null), salePrice: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]), vatRateCode: ['', Validators.required],
    minSalePrice: new FormControl<number | null>(null, Validators.min(0)), maxDiscountPct: new FormControl<number | null>(null, [Validators.min(0), Validators.max(100)]),
    // 4. Stock (seuil global et suivi par série ; réglages par entrepôt dans l'onglet Stock)
    minStock: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }), hasSerial: [false],
    // 5. Douane (la TVA n'y figure pas : source unique = code de TVA du groupe Prix)
    supplierHsCode: ['', pattern(NGP_RE, 'ngp')], tnHsCode: ['', pattern(NGP_RE, 'ngp')], ddPct: new FormControl<number | null>(null, [Validators.min(0), Validators.max(1000)]),
    fodecPct: new FormControl<number | null>(null, [Validators.min(0), Validators.max(1000)]), rpdPct: new FormControl<number | null>(null, [Validators.min(0), Validators.max(1000)]),
    originCountry: ['', Validators.maxLength(60)], provenanceCountry: ['', Validators.maxLength(60)], specialRegulation: ['', Validators.maxLength(500)],
  }, { validators: crossRules });
}
export type ProductForm = ReturnType<typeof buildProductForm>;

const n = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const t = (v: string) => v.trim();

export function patchProductForm(form: ProductForm, p: ProductDto, ref: ReferenceDataService) {
  const pk = p.packaging; const c = p.customs;
  form.patchValue({
    reference: p.reference, name: p.name, brand: p.brand ?? '', model: p.model ?? '', familyId: p.familyId ?? '', subId: p.subId ?? '', unitId: p.unitId, kind: p.kind, description: p.description ?? '',
    lengthMm: pk?.lengthMm ?? null, widthMm: pk?.widthMm ?? null, heightMm: pk?.heightMm ?? null, netWeightKg: pk?.netWeightKg ?? null, grossWeightKg: pk?.grossWeightKg ?? null, packType: pk?.type ?? '', packTypeLabel: pk?.typeLabel ?? '',
    parcelCount: pk?.parcelCount ?? null, dimensionsPerParcel: pk?.dimensionsPerParcel ?? true,
    purchaseCurrency: p.purchaseCurrency ?? ref.data()?.baseCurrency ?? 'TND', purchasePrice: p.purchasePriceMinor == null ? null : ref.fromMinor(p.purchasePriceMinor),
    purchaseForeign: p.purchasePriceForeignMinor == null || !p.purchaseCurrency ? null : p.purchasePriceForeignMinor / 10 ** ref.decimalsOf(p.purchaseCurrency),
    estimatedCost: p.estimatedCostMinor == null ? null : ref.fromMinor(p.estimatedCostMinor), mainSupplier: p.mainSupplierId ? { id: p.mainSupplierId, name: p.mainSupplierName ?? '' } : null,
    salePrice: ref.fromMinor(p.salePriceMinor), vatRateCode: p.vatRateCode, minSalePrice: p.minSalePriceMinor == null ? null : ref.fromMinor(p.minSalePriceMinor), maxDiscountPct: p.maxDiscountPct,
    minStock: p.minStock, hasSerial: p.hasSerial,
    supplierHsCode: c?.supplierHsCode ?? '', tnHsCode: c?.tnHsCode ?? '', ddPct: c?.ddPct ?? null, fodecPct: c?.fodecPct ?? null, rpdPct: c?.rpdPct ?? null, originCountry: c?.originCountry ?? '', provenanceCountry: c?.provenanceCountry ?? '', specialRegulation: c?.specialRegulation ?? '',
  }, { emitEvent: false });
  form.markAsPristine();
}

/** Un champ vidé est envoyé à null (effacé côté serveur) à la modification, ignoré à la création. */
const clear = (update: boolean) => (update ? null : undefined);

export function generalBody(f: ProductForm, update: boolean) {
  const v = f.getRawValue(); const e = clear(update);
  return { reference: t(v.reference), name: t(v.name), brand: t(v.brand) || e, model: t(v.model) || e, categoryId: v.subId || v.familyId || e, unitId: v.unitId, kind: v.kind, description: t(v.description) || (update ? '' : undefined) };
}
export function packagingBody(f: ProductForm, update: boolean) {
  const v = f.getRawValue(); const e = clear(update);
  return { lengthMm: n(v.lengthMm) ?? e, widthMm: n(v.widthMm) ?? e, heightMm: n(v.heightMm) ?? e, netWeightKg: n(v.netWeightKg) ?? e, grossWeightKg: n(v.grossWeightKg) ?? e,
    type: v.packType || e, typeLabel: v.packType === 'other' && t(v.packTypeLabel) ? t(v.packTypeLabel) : e, parcelCount: n(v.parcelCount) ?? e, dimensionsPerParcel: v.dimensionsPerParcel };
}
export function customsBody(f: ProductForm, update: boolean) {
  const v = f.getRawValue(); const e = clear(update);
  return { supplierHsCode: t(v.supplierHsCode) || e, tnHsCode: t(v.tnHsCode) || e, ddPct: n(v.ddPct) ?? e, fodecPct: n(v.fodecPct) ?? e, rpdPct: n(v.rpdPct) ?? e,
    originCountry: t(v.originCountry) || e, provenanceCountry: t(v.provenanceCountry) || e, specialRegulation: t(v.specialRegulation) || e };
}
/** Prix : `withPurchase` = l'utilisateur a le droit de voir et modifier les prix d'achat. */
export function pricesBody(f: ProductForm, ref: ReferenceDataService, update: boolean, withPurchase: boolean) {
  const v = f.getRawValue(); const e = clear(update); const base = ref.data()?.baseCurrency ?? 'TND';
  const out: Record<string, unknown> = { salePriceMinor: ref.toMinor(Number(v.salePrice) || 0), vatRateCode: v.vatRateCode, minSalePriceMinor: n(v.minSalePrice) === null ? e : ref.toMinor(Number(v.minSalePrice)), maxDiscountPct: n(v.maxDiscountPct) ?? e, mainSupplierId: v.mainSupplier?.id ?? e };
  if (withPurchase) {
    out['estimatedCostMinor'] = n(v.estimatedCost) === null ? e : ref.toMinor(Number(v.estimatedCost));
    if (v.purchaseCurrency && v.purchaseCurrency !== base) { out['purchaseCurrency'] = v.purchaseCurrency; out['purchasePriceForeignMinor'] = Math.round((Number(v.purchaseForeign) || 0) * 10 ** ref.decimalsOf(v.purchaseCurrency)); }
    else { out['purchaseCurrency'] = null; out['purchasePriceForeignMinor'] = null; out['purchasePriceMinor'] = ref.toMinor(Number(v.purchasePrice) || 0); }
  }
  return out;
}
export function stockBody(f: ProductForm) { const v = f.getRawValue(); return { minStock: Number(v.minStock) || 0, hasSerial: v.hasSerial }; }
/** Corps complet pour la création (les groupes vides ne sont pas envoyés). */
export function fullBody(f: ProductForm, ref: ReferenceDataService, withPurchase: boolean, withCustoms: boolean) {
  const pk = packagingBody(f, false); const cu = customsBody(f, false); const has = (o: object) => Object.values(o).some((x) => x !== undefined && x !== null && x !== '');
  const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));
  return { ...generalBody(f, false), ...pricesBody(f, ref, false, withPurchase), ...stockBody(f), ...(f.controls.kind.value === 'product' && has({ ...pk, dimensionsPerParcel: undefined }) && { packaging: strip(pk) }), ...(withCustoms && has(cu) && { customs: strip(cu) }) };
}
