import { describe, expect, it } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { buildProductForm, customsBody, fullBody, generalBody, packagingBody, pricesBody, volumes } from './product-form.model';
import { STATUS_HELP, STATUS_LABEL, formatBytes, num } from './product.labels';

const ref = { toMinor: (n: number) => Math.round(n * 1000), fromMinor: (n: number) => n / 1000, decimals: () => 3, decimalsOf: (c: string) => (c === 'EUR' ? 2 : 3), data: () => ({ baseCurrency: 'TND' }) } as unknown as ReferenceDataService;
const form = () => buildProductForm(new FormBuilder(), 'TND');
const valid = () => { const f = form(); f.patchValue({ reference: 'MACH-1', name: 'Machine', unitId: 'u1', vatRateCode: 'T19', salePrice: 100 }); return f; };

describe('volume (m³) — formule du cahier', () => {
  it('(L × l × h) / 1 000 000 000 ; total multiplié seulement si les dimensions sont celles d’un colis', () => {
    expect(volumes({ lengthMm: 1200, widthMm: 800, heightMm: 900, parcelCount: null, dimensionsPerParcel: true })).toEqual({ unit: 0.864, total: 0.864, multiplied: false });
    expect(volumes({ lengthMm: 1200, widthMm: 800, heightMm: 900, parcelCount: 3, dimensionsPerParcel: true })).toEqual({ unit: 0.864, total: 2.592, multiplied: true });
    expect(volumes({ lengthMm: 1200, widthMm: 800, heightMm: 900, parcelCount: 3, dimensionsPerParcel: false })).toEqual({ unit: 0.864, total: 0.864, multiplied: false });
    expect(volumes({ lengthMm: 1200, widthMm: null, heightMm: 900, parcelCount: 3, dimensionsPerParcel: true }).unit).toBeNull();
  });
});

describe('formulaire article — validations', () => {
  it('exige code, désignation, unité et TVA ; valide dimensions, poids, colis, remise, NGP', () => {
    expect(form().valid).toBe(false); const f = valid(); expect(f.valid).toBe(true);
    f.patchValue({ lengthMm: -1, netWeightKg: -2, parcelCount: 0, maxDiscountPct: 120, tnHsCode: 'ab$c' });
    expect(Object.keys(f.controls).filter((k) => (f.controls as Record<string, { invalid: boolean }>)[k]!.invalid).sort()).toEqual(['lengthMm', 'maxDiscountPct', 'netWeightKg', 'parcelCount', 'tnHsCode']);
    f.patchValue({ lengthMm: 10, netWeightKg: 1, parcelCount: 2.5 }); expect(f.controls.parcelCount.invalid).toBe(true); f.patchValue({ parcelCount: 2, maxDiscountPct: 10, tnHsCode: '0084520' }); expect(f.valid).toBe(true);
  });
  it('règles croisées : poids brut ≥ net ; prix minimum ≤ prix de vente', () => {
    const f = valid(); f.patchValue({ netWeightKg: 10, grossWeightKg: 9 }); expect(f.hasError('grossBelowNet')).toBe(true); f.patchValue({ grossWeightKg: 10 }); expect(f.hasError('grossBelowNet')).toBe(false);
    f.patchValue({ minSalePrice: 120 }); expect(f.hasError('minAboveSale')).toBe(true); f.patchValue({ minSalePrice: 90 }); expect(f.hasError('minAboveSale')).toBe(false);
  });
});

describe('corps de l’API', () => {
  it('général : catégorie = sous-catégorie sinon famille ; champs vidés → null à la modification, ignorés à la création', () => {
    const f = valid(); f.patchValue({ familyId: 'F', subId: 'S', brand: '', description: '' });
    expect(generalBody(f, false)).toMatchObject({ categoryId: 'S', brand: undefined, description: undefined }); expect(generalBody(f, true)).toMatchObject({ categoryId: 'S', brand: null, description: '' });
    f.patchValue({ subId: '' }); expect(generalBody(f, true).categoryId).toBe('F'); f.patchValue({ familyId: '' }); expect(generalBody(f, true).categoryId).toBeNull();
  });
  it('prix : montants en plus petite unité ; devise étrangère = prix en devise (serveur convertit) ; devise de base = prix direct', () => {
    const f = valid(); f.patchValue({ purchasePrice: 60, salePrice: 100.5, estimatedCost: 65, minSalePrice: 90, maxDiscountPct: 5, mainSupplier: { id: 's1', name: 'F' } });
    expect(pricesBody(f, ref, false, true)).toMatchObject({ salePriceMinor: 100_500, vatRateCode: 'T19', minSalePriceMinor: 90_000, maxDiscountPct: 5, mainSupplierId: 's1', estimatedCostMinor: 65_000, purchaseCurrency: null, purchasePriceMinor: 60_000 });
    f.patchValue({ purchaseCurrency: 'EUR', purchaseForeign: 100 }); const eur = pricesBody(f, ref, true, true); expect(eur).toMatchObject({ purchaseCurrency: 'EUR', purchasePriceForeignMinor: 10_000 }); expect(eur).not.toHaveProperty('purchasePriceMinor');
    expect(pricesBody(f, ref, true, false)).not.toHaveProperty('estimatedCostMinor'); expect(pricesBody(f, ref, true, false)).not.toHaveProperty('purchaseCurrency'); // sans droit d'achat : jamais de prix d'achat envoyé
  });
  it('packaging et douane : groupes nettoyés ; NGP gardé en texte', () => {
    const f = valid(); f.patchValue({ lengthMm: 1200, widthMm: 800, heightMm: 900, netWeightKg: 850.5, parcelCount: 2, packType: 'other', packTypeLabel: 'Big bag', tnHsCode: '0084520', ddPct: 10 });
    expect(packagingBody(f, false)).toMatchObject({ lengthMm: 1200, netWeightKg: 850.5, type: 'other', typeLabel: 'Big bag', parcelCount: 2, grossWeightKg: undefined }); expect(packagingBody(f, true)).toMatchObject({ grossWeightKg: null });
    expect(customsBody(f, false)).toMatchObject({ tnHsCode: '0084520', ddPct: 10, fodecPct: undefined }); expect(typeof customsBody(f, false).tnHsCode).toBe('string');
  });
  it('création : un service n’envoie pas de packaging ; la douane n’est envoyée qu’avec le droit et si renseignée', () => {
    const f = valid(); f.patchValue({ lengthMm: 10, widthMm: 10, heightMm: 10, tnHsCode: '123' });
    const prod = fullBody(f, ref, true, true) as Record<string, unknown>; expect(prod).toHaveProperty('packaging'); expect(prod).toHaveProperty('customs');
    f.patchValue({ kind: 'service' }); expect(fullBody(f, ref, true, true)).not.toHaveProperty('packaging'); expect(fullBody(f, ref, true, false)).not.toHaveProperty('customs');
    expect(fullBody(valid(), ref, true, true)).not.toHaveProperty('customs'); // aucun champ douane renseigné
  });
});

describe('libellés', () => {
  it('quatre statuts expliqués ; formats', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['active', 'archived', 'blocked', 'inactive']); expect(Object.keys(STATUS_HELP)).toHaveLength(4);
    expect(formatBytes(2048)).toBe('2.0 Ko'); expect(num(0.864, 9)).toBe('0,864'); expect(num(null)).toBe('—');
  });
});
