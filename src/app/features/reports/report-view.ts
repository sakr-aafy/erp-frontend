import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { catchError, of } from 'rxjs';
import { Api } from '../../core/services/api.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { BarChart } from '../../shared/components/bar-chart';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { Icon } from '../../shared/components/icon';
import { LineChart, LineSeries } from '../../shared/components/line-chart';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { EntityFilter } from './entity-filter';
import { GROUP_BY_OPTIONS, PERIOD_PRESETS, REASON_OPTIONS, ReportCol, ReportsStore, presetRange } from './reports.store';

interface Opt { value: string; label: string }
interface ReportResult { key: string; title: string; description: string; columns: ReportCol[]; rows: Record<string, unknown>[]; total: number; page: number; limit: number; totals: Record<string, unknown> | null;
  kpis: { label: string; value: number | string; type?: string }[]; chart: { type: 'bar' | 'line'; valueType: string; series: { label: string; points: { label: string; value: number }[] }[] } | null; note: string | null; truncated: boolean; generatedAt: string; tookMs: number }
const KEYS = ['preset', 'from', 'to', 'asOf', 'groupBy', 'customerId', 'supplierId', 'productId', 'categoryId', 'warehouseId', 'accountId', 'userId', 'status', 'currency', 'reason'] as const;

/** Page d'un rapport : filtres réellement connectés à l'API (état conservé dans l'URL), KPI, graphique, tableau paginé côté serveur, exports. */
@Component({
  selector: 'app-report-view',
  imports: [DatePipe, FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatPaginatorModule, MatSelectModule, PageHeader, Icon, EmptyState, Skeleton, ExportMenu, BarChart, LineChart, EntityFilter],
  template: `<div class="page">
    <app-page-header [title]="meta()?.title ?? 'Rapport'" [subtitle]="meta()?.description ?? ''"><a mat-stroked-button routerLink="/reports"><app-icon name="arrow_back" />Tous les rapports</a>
      @if (meta()) {<app-export-menu [path]="'/reports/' + key() + '/export'" [params]="params()" />}</app-page-header>
    @if (meta(); as m) {
    <div class="card filters" role="search" aria-label="Filtres du rapport">
      @if (has('period')) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Période</mat-label><mat-select [ngModel]="f().preset" (ngModelChange)="setPreset($event)">@for (p of presets; track p.value) {<mat-option [value]="p.value">{{ p.label }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Du</mat-label><input matInput type="date" [ngModel]="f().from" (ngModelChange)="setCustom('from', $event)" [max]="f().to || null" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Au</mat-label><input matInput type="date" [ngModel]="f().to" (ngModelChange)="setCustom('to', $event)" [min]="f().from || null" /></mat-form-field>
      }
      @if (has('asOf')) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Situation au</mat-label><input matInput type="date" [ngModel]="f().asOf" (ngModelChange)="set('asOf', $event)" /></mat-form-field>}
      @if (has('groupBy')) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Regrouper par</mat-label><mat-select [ngModel]="f().groupBy || 'month'" (ngModelChange)="set('groupBy', $event)">@for (g of groupBy; track g.value) {<mat-option [value]="g.value">{{ g.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (has('customerId')) {<app-entity-filter kind="customer" label="Client" [value]="f().customerId" (changed)="set('customerId', $event)" />}
      @if (has('supplierId')) {<app-entity-filter kind="supplier" label="Fournisseur" [value]="f().supplierId" (changed)="set('supplierId', $event)" />}
      @if (has('productId')) {<app-entity-filter kind="product" label="Article" [value]="f().productId" (changed)="set('productId', $event)" />}
      @if (has('categoryId') && categories().length) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Catégorie</mat-label><mat-select [ngModel]="f().categoryId" (ngModelChange)="set('categoryId', $event)"><mat-option value="">Toutes</mat-option>@for (o of categories(); track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (has('warehouseId') && warehouses().length) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Magasin</mat-label><mat-select [ngModel]="f().warehouseId" (ngModelChange)="set('warehouseId', $event)"><mat-option value="">Tous</mat-option>@for (o of warehouses(); track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (has('accountId') && accounts().length) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Compte</mat-label><mat-select [ngModel]="f().accountId" (ngModelChange)="set('accountId', $event)"><mat-option value="">Tous</mat-option>@for (o of accounts(); track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (has('userId') && users().length) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Utilisateur</mat-label><mat-select [ngModel]="f().userId" (ngModelChange)="set('userId', $event)"><mat-option value="">Tous</mat-option>@for (o of users(); track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (has('status') && m.statusOptions) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label><mat-select [ngModel]="f().status" (ngModelChange)="set('status', $event)"><mat-option value="">Tous</mat-option>@for (o of m.statusOptions; track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (has('currency') && currencies().length) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Devise</mat-label><mat-select [ngModel]="f().currency" (ngModelChange)="set('currency', $event)"><mat-option value="">Toutes</mat-option>@for (o of currencies(); track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (has('reason')) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Motif</mat-label><mat-select [ngModel]="f().reason" (ngModelChange)="set('reason', $event)"><mat-option value="">Tous</mat-option>@for (o of reasons; track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}</mat-select></mat-form-field>}
      @if (activeFilters()) {<button mat-button type="button" (click)="reset()"><app-icon name="close" />Réinitialiser</button>}
    </div>
    @if (error()) {<div class="card warn" role="alert">{{ error() }}</div>}
    @if (loading() && !res()) {<div class="card"><app-skeleton [count]="6" /></div>}
    @else if (res(); as r) {
      @if (r.kpis.length) {<div class="kpis">@for (k of r.kpis; track k.label) {<div class="card kpi"><div class="l">{{ k.label }}</div><div class="v">{{ kpi(k) }}</div></div>}</div>}
      @if (r.chart && hasChartData()) {<div class="card" style="margin-bottom:16px"><h3>{{ r.chart.series.length === 1 ? r.chart.series[0]!.label : 'Évolution' }}</h3>
        @if (r.chart.type === 'bar') {<app-bar-chart [data]="barData()" [format]="fmt(r.chart.valueType)" [short]="short(r.chart.valueType)" [ariaLabel]="r.title" [legendLabels]="{ primary: r.chart.series[0]!.label }" />}
        @else {<app-line-chart [series]="lineData()" [format]="fmt(r.chart.valueType)" [short]="short(r.chart.valueType)" [ariaLabel]="r.title" />}</div>}
      <div class="card flush">
        @if (!r.rows.length) {<app-empty-state icon="search" message="Aucune donnée pour ces filtres." />} @else {
        <div class="table-wrap"><table class="t">
          <thead><tr>@for (c of r.columns; track c.key) {<th [class.r]="right(c)">{{ c.label }}</th>}</tr></thead>
          <tbody>@for (row of r.rows; track $index) {<tr>@for (c of r.columns; track c.key) {<td [class.r]="right(c)" [attr.data-label]="c.label">{{ cell(c, row[c.key]) }}</td>}</tr>}</tbody>
          @if (r.totals) {<tfoot><tr>@for (c of r.columns; track c.key) {<td [class.r]="right(c)">{{ r.totals[c.key] === undefined ? '' : cell(c, r.totals[c.key]) }}</td>}</tr></tfoot>}
        </table></div>
        <mat-paginator [length]="r.total" [pageSize]="r.limit" [pageIndex]="r.page - 1" [pageSizeOptions]="[25, 50, 100, 200]" (page)="onPage($event)" />}
      </div>
      @if (r.note) {<p class="muted note"><app-icon name="info" /> {{ r.note }}</p>}
      @if (r.truncated) {<p class="muted note"><app-icon name="warning" /> Résultat limité aux 20 000 premières lignes : affinez les filtres.</p>}
      <p class="muted meta">Calculé le {{ r.generatedAt | date: 'dd/MM/yyyy HH:mm:ss' }} en {{ r.tookMs }} ms · {{ num0(r.total) }} ligne(s)</p>
    }} @else if (catalogLoaded()) {<div class="card"><app-empty-state icon="shield" message="Rapport introuvable ou non autorisé avec vos permissions." /></div>}
  </div>`,
  styles: `.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px}.filters mat-form-field,.filters app-entity-filter{width:200px}.filters app-entity-filter{display:block}
    tfoot td{font-weight:600;background:var(--surface-2);border-top:1px solid var(--border-strong);padding:10px 12px}.note{display:flex;gap:6px;align-items:center;margin:12px 0 0;font-size:13px}.meta{font-size:12px;margin:8px 0 0}
    @media (max-width:720px){.filters mat-form-field,.filters app-entity-filter{width:100%}}`,
})
export class ReportView {
  key = input.required<string>();
  private api = inject(Api); private router = inject(Router); private toast = inject(ToastService); private ref = inject(ReferenceDataService); private store = inject(ReportsStore);
  presets = PERIOD_PRESETS; groupBy = GROUP_BY_OPTIONS; reasons = REASON_OPTIONS;
  meta = computed(() => this.store.find(this.key())); catalogLoaded = computed(() => this.store.catalog() !== null);
  f = signal<Record<(typeof KEYS)[number], string>>(Object.fromEntries(KEYS.map((k) => [k, ''])) as never);
  res = signal<ReportResult | null>(null); loading = signal(false); error = signal(''); page = signal(1); limit = signal(50);
  categories = signal<Opt[]>([]); warehouses = signal<Opt[]>([]); accounts = signal<Opt[]>([]); users = signal<Opt[]>([]);
  currencies = computed<Opt[]>(() => (this.ref.data()?.currencies ?? []).filter((c) => c.code !== this.ref.data()?.baseCurrency).map((c) => ({ value: c.code, label: c.code })));
  has = (k: string) => !!this.meta()?.filters.includes(k);
  activeFilters = computed(() => KEYS.some((k) => k !== 'preset' && k !== 'groupBy' && !!this.f()[k]) && true);
  /** Paramètres réellement envoyés à l'API (et à l'export). */
  params = computed(() => { const f = this.f(); const o: Record<string, string> = {}; for (const k of KEYS) if (k !== 'preset' && f[k] && this.has(k === 'from' || k === 'to' ? 'period' : k)) o[k] = f[k]; if (this.has('groupBy')) o['groupBy'] = f.groupBy || 'month'; return o; });
  barData = computed(() => (this.res()?.chart?.series[0]?.points ?? []).map((p) => ({ label: p.label, value: p.value })));
  lineData = computed<LineSeries[]>(() => (this.res()?.chart?.series ?? []).map((s, i) => ({ ...s, tone: i === 0 ? 'primary' as const : 'accent' as const })));
  hasChartData = computed(() => (this.res()?.chart?.series ?? []).some((s) => s.points.some((p) => p.value !== 0)));

  ngOnInit() {
    const q = this.router.parseUrl(this.router.url).queryParams; const init = { ...this.f() };
    for (const k of KEYS) if (typeof q[k] === 'string') init[k] = q[k] as string;
    const store = this.store;
    const start = () => {
      const m = this.meta(); if (!m) return;
      if (m.filters.includes('period') && !init.preset) { init.preset = init.from || init.to ? 'custom' : 'year'; if (init.preset === 'year') Object.assign(init, presetRange('year')); }
      if (m.filters.includes('groupBy') && !init.groupBy) init.groupBy = 'month';
      this.f.set(init); this.loadOptions(m.filters); this.run();
    };
    if (store.catalog()) start(); else store.load().subscribe({ next: start, error: (e) => this.toast.error(errorMessage(e)) });
  }
  private loadOptions(filters: string[]) {
    const opt = <T>(path: string, map: (r: T) => Opt, set: (o: Opt[]) => void) => this.api.get(path).pipe(catchError(() => of([]))).subscribe((r) => set(((Array.isArray(r) ? r : r.items) as T[]).map(map)));
    if (filters.includes('categoryId')) opt<{ id: string; name: string }>('/product-categories', (c) => ({ value: c.id, label: c.name }), (o) => this.categories.set(o));
    if (filters.includes('warehouseId')) opt<{ id: string; code: string; name: string }>('/warehouses', (w) => ({ value: w.id, label: `${w.code} — ${w.name}` }), (o) => this.warehouses.set(o));
    if (filters.includes('accountId')) opt<{ id: string; code: string; name: string }>('/treasury/accounts', (a) => ({ value: a.id, label: `${a.code} — ${a.name}` }), (o) => this.accounts.set(o));
    if (filters.includes('userId')) opt<{ id: string; name: string }>('/users?limit=100', (u) => ({ value: u.id, label: u.name }), (o) => this.users.set(o));
  }
  set(k: (typeof KEYS)[number], v: string) { this.f.update((f) => ({ ...f, [k]: v ?? '' })); this.page.set(1); this.run(); }
  setPreset(p: string) { const r = presetRange(p); this.f.update((f) => ({ ...f, preset: p, ...(p !== 'custom' ? r : {}) })); this.page.set(1); this.run(); }
  setCustom(k: 'from' | 'to', v: string) { this.f.update((f) => ({ ...f, [k]: v ?? '', preset: 'custom' })); this.page.set(1); this.run(); }
  reset() { const m = this.meta(); const f = Object.fromEntries(KEYS.map((k) => [k, ''])) as Record<(typeof KEYS)[number], string>; if (m?.filters.includes('period')) { f.preset = 'year'; Object.assign(f, presetRange('year')); } if (m?.filters.includes('groupBy')) f.groupBy = 'month'; this.f.set(f); this.page.set(1); this.run(); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex + 1); this.limit.set(e.pageSize); this.run(false); }
  private run(syncUrl = true) {
    this.loading.set(true); this.error.set('');
    if (syncUrl) { const f = this.f(); const qp: Record<string, string> = {}; for (const k of KEYS) if (f[k]) qp[k] = f[k]; this.router.navigate([], { queryParams: qp, replaceUrl: true }); }
    this.api.get<ReportResult>(`/reports/${this.key()}`, { ...this.params(), page: this.page(), limit: this.limit() }).subscribe({ next: (r) => { this.res.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
  right = (c: ReportCol) => c.type === 'money' || c.type === 'qty' || c.type === 'int' || c.type === 'pct';
  num0 = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  private num = (v: number, max = 3) => v.toLocaleString('fr-FR', { maximumFractionDigits: max });
  cell(c: ReportCol, v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    switch (c.type) { case 'money': return this.ref.format(Number(v)); case 'qty': return this.num(Number(v)); case 'int': return this.num(Number(v), 0); case 'pct': return `${this.num(Number(v), 1)} %`;
      case 'date': return new Date(String(v)).toLocaleDateString('fr-FR', { timeZone: 'UTC' }); default: return String(v); }
  }
  kpi(k: { value: number | string; type?: string }): string { return this.cell({ key: '', label: '', type: k.type as never }, k.value); }
  fmt = (t: string) => (n: number) => (t === 'money' ? this.ref.format(n) : t === 'pct' ? `${this.num(n, 1)} %` : this.num(n, t === 'int' ? 2 : 3));
  short = (t: string) => (n: number) => { if (t !== 'money') return this.num(n, 1); const v = this.ref.fromMinor(n); const a = Math.abs(v); return a >= 1e6 ? `${this.num(v / 1e6, 1)} M` : a >= 1e3 ? `${this.num(v / 1e3, a >= 1e4 ? 0 : 1)} k` : this.num(v, 0); };
}
