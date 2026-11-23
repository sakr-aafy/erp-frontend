import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { ReferenceDataService } from './reference-data.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

const setup = (decimals: number) => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const svc = TestBed.inject(ReferenceDataService);
  svc.load$().subscribe();
  TestBed.inject(HttpTestingController).expectOne('/api/v1/settings/reference').flush({ baseCurrency: 'TND', baseDecimals: decimals, baseSymbol: 'DT', currencies: [], vatRates: [{ code: 'T1', regime: 'taxable', ratePct: 7 }] });
  return svc;
};

describe('ReferenceDataService', () => {
  it('convertit les montants selon la précision de la devise (3 décimales)', () => {
    const s = setup(3);
    expect(s.toMinor(12.345)).toBe(12345); expect(s.toMinor(0.1 + 0.2)).toBe(300); expect(s.fromMinor(12345)).toBe(12.345); expect(s.toMinor(null)).toBe(0);
    expect(s.vatRates()).toHaveLength(1);
  });
  it('respecte une précision configurable (2 décimales)', () => {
    const s = setup(2);
    expect(s.toMinor(12.345)).toBe(1235); expect(s.fromMinor(1235)).toBe(12.35);
  });
  it('formate avec le symbole et gère null', () => {
    const s = setup(3);
    expect(s.format(1500000)).toMatch(/^1\D500,000 DT$/); expect(s.format(null)).toBe('—');
    expect(TestBed.runInInjectionContext(() => new MoneyPipe().transform(2500))).toMatch(/2,500 DT$/);
  });
});
