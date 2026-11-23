import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ReportView } from './report-view';
import { ReportMeta, ReportsStore, presetRange } from './reports.store';

const META: ReportMeta = { key: 'sales-by-period', title: 'Ventes par période', description: 'CA par période', filters: ['period', 'groupBy', 'customerId'], statusOptions: null, columns: [{ key: 'period', label: 'Période' }, { key: 'htMinor', label: 'CA HT', type: 'money' }, { key: 'invoices', label: 'Factures', type: 'int' }] };
const RESULT = { key: META.key, title: META.title, description: '', columns: META.columns, rows: [{ period: '2026-10', htMinor: 150_000, invoices: 3 }, { period: '2026-11', htMinor: 2_000, invoices: 1 }], total: 2, page: 1, limit: 50, totals: { period: 'Total', htMinor: 152_000, invoices: 4 }, kpis: [{ label: 'Taux', value: 50, type: 'pct' }],
  chart: { type: 'bar', valueType: 'money', series: [{ label: 'CA HT', points: [{ label: '2026-10', value: 150_000 }, { label: '2026-11', value: 2_000 }] }] }, note: 'Net des avoirs.', truncated: false, generatedAt: '2026-11-22T10:00:00Z', tookMs: 12 };

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  TestBed.inject(ReportsStore).catalog.set([{ group: 'commercial', label: 'Commercial', reports: [META] }]);
  TestBed.inject(ReferenceDataService).data.set({ baseCurrency: 'TND', baseDecimals: 3, baseSymbol: 'DT', currencies: [{ code: 'TND', decimals: 3 }], vatRates: [] } as never);
  const f = TestBed.createComponent(ReportView); f.componentRef.setInput('key', META.key); f.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const next = (match: (u: string) => boolean = () => true) => http.expectOne((r) => r.url.endsWith('/reports/sales-by-period') && match(r.urlWithParams));
  return { f, http, next, el: f.nativeElement as HTMLElement };
}

describe('ReportView', () => {
  it('au chargement : période « cette année » et regroupement par mois envoyés à l’API ; résultats, totaux, KPI et graphique affichés', () => {
    const { f, next, el } = setup(); const r = next(); const y = presetRange('year');
    expect(r.request.params.get('from')).toBe(y.from); expect(r.request.params.get('to')).toBe(y.to); expect(r.request.params.get('groupBy')).toBe('month'); expect(r.request.params.get('page')).toBe('1');
    r.flush(RESULT); f.detectChanges();
    expect(el.querySelectorAll('table.t tbody tr')).toHaveLength(2); expect(el.querySelector('table.t tfoot')?.textContent).toContain('Total'); expect(el.querySelector('table.t tbody tr')?.textContent).toContain('150'); // montant formaté (devise de base)
    expect(el.querySelector('.kpi .v')?.textContent).toContain('50'); expect(el.querySelector('app-bar-chart svg')).toBeTruthy(); expect(el.textContent).toContain('Net des avoirs.');
    expect(el.querySelectorAll('th.r')).toHaveLength(2); // montants et entiers alignés à droite
  });
  it('un changement de filtre relance la requête avec les bons paramètres (période, regroupement, client) et revient à la page 1', () => {
    const { f, next, http } = setup(); next().flush(RESULT); f.detectChanges();
    f.componentInstance.setPreset('lastMonth'); const lm = presetRange('lastMonth'); const r1 = next((u) => u.includes(`from=${lm.from}`)); expect(r1.request.params.get('to')).toBe(lm.to); r1.flush(RESULT);
    f.componentInstance.set('groupBy', 'week'); const r2 = next((u) => u.includes('groupBy=week')); r2.flush(RESULT);
    f.componentInstance.set('customerId', '64b000000000000000000001'); const r3 = next((u) => u.includes('customerId=64b000000000000000000001')); expect(r3.request.params.get('page')).toBe('1'); r3.flush(RESULT);
    f.componentInstance.reset(); const r4 = next((u) => !u.includes('customerId')); r4.flush(RESULT); http.verify();
  });
  it('un filtre non déclaré par le rapport n’est jamais envoyé ; « période personnalisée » : dates saisies transmises', () => {
    const { f, next } = setup(); next().flush(RESULT);
    f.componentInstance.set('warehouseId', 'x'); const r = next(); expect(r.request.params.has('warehouseId')).toBe(false); r.flush(RESULT); // ce rapport ne déclare pas ce filtre
    f.componentInstance.setCustom('from', '2026-02-01'); const r2 = next((u) => u.includes('from=2026-02-01')); expect(f.componentInstance.f().preset).toBe('custom'); r2.flush(RESULT);
  });
  it('erreur serveur : message affiché, pas de tableau périmé', () => {
    const { f, next, el } = setup(); next().flush({ error: { code: 'VALIDATION_ERROR', message: 'La date de début doit précéder la date de fin' } }, { status: 422, statusText: 'Unprocessable' }); f.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('date de début');
  });
  it('rapport absent du catalogue (permissions) : message « introuvable ou non autorisé », aucune requête', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    TestBed.inject(ReportsStore).catalog.set([]); const f = TestBed.createComponent(ReportView); f.componentRef.setInput('key', 'treasury-by-account'); f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('introuvable ou non autorisé'); TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
