import { describe, expect, it } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { buildProductForm, customsBody, fullBody, generalBody, packagingBody, pricesBody, volumeM3 } from './product-form.model';
import { STATUS_HELP, STATUS_LABEL, formatBytes, num } from './product.labels';

const ref = { toMinor: (n: number) => Math.round(n * 1000), fromMinor: (n: number) => n / 1000, decimals: () => 3, decimalsOf: (c: string) => (c === 'EUR' ? 2 : 3), data: () => ({ baseCurrency: 'TND' }) } as unknown as ReferenceDataService;
const form = () => buildProductForm(new FormBuilder(), 'TND');
const valid = () => { const f = form(); f.patchValue({ reference: 'MACH-1', name: 'Machine', unitId: 'u1', vatRateCode: 'T19', salePrice: 100 }); return f; };

describe('volume (m³) — formule du document', () => {
  it('(L × l × h) / 1 000 000 000, sans nombre de colis ; null si incomplet', () => {
    expect(volumeM3({ lengthMm: 910, widthMm: 382, heightMm: 710 })).toBe(0.2468102);
    expect(volumeM3({ lengthMm: 1200, widthMm: 800, heightMm: 900 })).toBe(0.864);
    expect(volumeM3({ lengthMm: 1250.5, widthMm: 800, heightMm: 900.25 })).toBe(0.9006101);
    expect(volumeM3({ lengthMm: 1200, widthMm: null, heightMm: 900 })).toBeNull(); expect(volumeM3({ lengthMm: -1, widthMm: 1, heightMm: 1 })).toBeNull();
  });
});

describe('formulaire article — validations', () => {
  it('exige code, désignation, unité et TVA ; valide dimensions, poids, remise, NGP ; marque, modèle et colis supprimés', () => {
    expect(form().valid).toBe(false); const f = valid(); expect(f.valid).toBe(true);
    f.patchValue({ lengthMm: -1, netWeightKg: -2, maxDiscountPct: 120, tnHsCode: 'ab$c' });
    expect(Object.keys(f.controls).filter((k) => (f.controls as Record<string, { invalid: boolean }>)[k]!.invalid).sort()).toEqual(['lengthMm', 'maxDiscountPct', 'netWeightKg', 'tnHsCode']);
    f.patchValue({ lengthMm: 10, netWeightKg: 1, maxDiscountPct: 10, tnHsCode: '0084520' }); expect(f.valid).toBe(true);
    for (const k of ['brand', 'model', 'parcelCount', 'dimensionsPerParcel']) expect(k in f.controls).toBe(false);
  });
  it('règles croisées : poids brut ≥ net ; prix minimum ≤ prix de vente', () => {
    const f = valid(); f.patchValue({ netWeightKg: 10, grossWeightKg: 9 }); expect(f.hasError('grossBelowNet')).toBe(true); f.patchValue({ grossWeightKg: 10 }); expect(f.hasError('grossBelowNet')).toBe(false);
    f.patchValue({ minSalePrice: 120 }); expect(f.hasError('minAboveSale')).toBe(true); f.patchValue({ minSalePrice: 90 }); expect(f.hasError('minAboveSale')).toBe(false);
  });
});

describe('corps de l’API', () => {
  it('général : catégorie et sous-catégorie séparées ; champs vidés → null à la modification, ignorés à la création', () => {
    const f = valid(); f.patchValue({ familyId: 'F', subId: 'S', description: '' });
    expect(generalBody(f, false)).toMatchObject({ categoryId: 'F', subCategoryId: 'S', description: undefined }); expect(generalBody(f, true)).toMatchObject({ categoryId: 'F', subCategoryId: 'S', description: '' });
    f.patchValue({ subId: '' }); expect(generalBody(f, true)).toMatchObject({ categoryId: 'F', subCategoryId: null }); f.patchValue({ familyId: '', subId: 'S' }); expect(generalBody(f, true)).toMatchObject({ categoryId: null, subCategoryId: null });
    expect(generalBody(f, true)).not.toHaveProperty('brand');
  });
  it('prix : montants en plus petite unité ; devise étrangère = prix en devise seul (jamais de contre-valeur envoyée)', () => {
    const f = valid(); f.patchValue({ purchasePrice: 60, salePrice: 100.5, estimatedCost: 65, minSalePrice: 90, maxDiscountPct: 5, mainSupplier: { id: 's1', name: 'F' } });
    expect(pricesBody(f, ref, false, true)).toMatchObject({ salePriceMinor: 100_500, vatRateCode: 'T19', minSalePriceMinor: 90_000, maxDiscountPct: 5, mainSupplierId: 's1', estimatedCostMinor: 65_000, purchaseCurrency: null, purchasePriceMinor: 60_000 });
    f.patchValue({ purchaseCurrency: 'EUR', purchaseForeign: 100 }); const eur = pricesBody(f, ref, true, true); expect(eur).toMatchObject({ purchaseCurrency: 'EUR', purchasePriceForeignMinor: 10_000 }); expect(eur).not.toHaveProperty('purchasePriceMinor');
    expect(pricesBody(f, ref, true, false)).not.toHaveProperty('estimatedCostMinor'); expect(pricesBody(f, ref, true, false)).not.toHaveProperty('purchaseCurrency'); // sans droit d'achat : jamais de prix d'achat envoyé
  });
  it('dimensions et douane : groupes nettoyés ; NGP gardé en texte ; confirmation seulement à la modification', () => {
    const f = valid(); f.patchValue({ lengthMm: 1200, widthMm: 800, heightMm: 900, netWeightKg: 850.5, packType: 'other', packTypeLabel: 'Big bag', tnHsCode: '0084520', ddPct: 10 });
    expect(packagingBody(f, false)).toMatchObject({ lengthMm: 1200, netWeightKg: 850.5, type: 'other', typeLabel: 'Big bag', grossWeightKg: undefined }); expect(packagingBody(f, true)).toMatchObject({ grossWeightKg: null });
    expect(packagingBody(f, true)).not.toHaveProperty('confirmDimensions'); f.patchValue({ confirmDimensions: true }); expect(packagingBody(f, true)).toMatchObject({ confirmDimensions: true }); expect(packagingBody(f, false)).not.toHaveProperty('confirmDimensions');
    expect(customsBody(f, false)).toMatchObject({ tnHsCode: '0084520', ddPct: 10, fodecPct: undefined }); expect(typeof customsBody(f, false).tnHsCode).toBe('string');
  });
  it('création : un service n’envoie pas de dimensions ; la douane n’est envoyée qu’avec le droit et si renseignée', () => {
    const f = valid(); f.patchValue({ lengthMm: 10, widthMm: 10, heightMm: 10, tnHsCode: '123' });
    const prod = fullBody(f, ref, true, true) as Record<string, unknown>; expect(prod).toHaveProperty('packaging'); expect(prod).toHaveProperty('customs');
    f.patchValue({ kind: 'service' }); expect(fullBody(f, ref, true, true)).not.toHaveProperty('packaging'); expect(fullBody(f, ref, true, false)).not.toHaveProperty('customs');
    expect(fullBody(valid(), ref, true, true)).not.toHaveProperty('customs'); // aucun champ douane renseigné
    expect(fullBody(valid(), ref, true, true)).not.toHaveProperty('packaging');
  });
});

describe('libellés', () => {
  it('quatre statuts expliqués ; formats', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['active', 'archived', 'blocked', 'inactive']); expect(Object.keys(STATUS_HELP)).toHaveLength(4);
    expect(formatBytes(2048)).toBe('2.0 Ko'); expect(num(0.864, 9)).toBe('0,864'); expect(num(null)).toBe('—');
  });
});
