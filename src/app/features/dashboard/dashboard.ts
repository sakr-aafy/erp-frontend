import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../core/services/api.service';
import { errorMessage } from '../../core/services/api';
import { AuthService } from '../../core/authentication/auth.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { BarChart } from '../../shared/components/bar-chart';
import { EmptyState } from '../../shared/components/empty-state';
import { Icon } from '../../shared/components/icon';
import { LineChart } from '../../shared/components/line-chart';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { PERIOD_PRESETS, presetRange } from '../reports/reports.store';

interface Cmp { current: number; previous: number; deltaPct: number | null }
interface Dash {
  period: { from: string; to: string; previousFrom: string; previousTo: string; days: number; granularity: string }; generatedAt: string;
  sales?: { revenueHt: Cmp; revenueTtc: Cmp; invoices: Cmp; creditNotes: Cmp; series: { granularity: string; current: { label: string; value: number }[]; previous: { label: string; value: number }[] };
    unpaid: { count: number; dueMinor: number; overdueMinor: number }; receivablesMinor: number; topCustomers: { name: string; htMinor: number }[]; topProducts: { name: string; htMinor: number; qty: number }[] };
  margin?: { amount: Cmp; pct: number | null; note: string };
  purchases?: { purchasesHt: Cmp; purchasesTtc: Cmp; invoices: Cmp; payablesMinor: number; pendingOrders: number };
  expenses?: { total: Cmp };
  treasury?: { totalMinor: number; bankMinor: number; cashMinor: number; accounts: { id: string; name: string; type: string; balanceMinor: number }[] };
  stock?: { valueMinor: number; lowCount: number; outCount: number; alerts: { reference: string; name: string; qty: number; minStock: number; status: string }[] };
  activity?: { id: string; user: string | null; action: string; resource: string; at: string; success: boolean }[];
}
interface Card { label: string; value: string; icon: string; route: string; delta?: number | null; accent?: boolean; hint?: string }
const ACTIONS: Record<string, string> = { create: 'Création', update: 'Modification', delete: 'Suppression', validate: 'Validation', cancel: 'Annulation', login: 'Connexion', logout: 'Déconnexion', export: 'Export', submit: 'Soumission',
  reject: 'Rejet', reconcile: 'Réconciliation', send: 'Envoi', archive: 'Archivage', activate: 'Activation', deactivate: 'Désactivation', 'upload-attachment': 'Justificatif ajouté' };
const PRESETS = PERIOD_PRESETS.filter((p) => ['month', 'lastMonth', 'last30', 'quarter', 'year', 'custom'].includes(p.value));

/** Tableau de bord : tout provient de `GET /reports/dashboard` ; chaque bloc n'existe que si l'utilisateur a les permissions du module source. */
@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, FormsModule, RouterLink, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule, PageHeader, Icon, BarChart, LineChart, EmptyState, Skeleton],
  template: `
    <div class="page">
      <app-page-header [title]="'Bonjour, ' + firstName()" [subtitle]="todayLabel">
        @for (q of quick(); track q.route) {<a mat-stroked-button [routerLink]="q.route"><app-icon [name]="q.icon" />{{ q.label }}</a>}
        @if (auth.has('reports:view')) {<a mat-flat-button color="primary" routerLink="/reports"><app-icon name="table_view" />Rapports</a>}
      </app-page-header>

      <div class="periodbar">
        <mat-button-toggle-group [value]="preset()" (change)="setPreset($event.value)" aria-label="Période" hideSingleSelectionIndicator>@for (p of presets; track p.value) {<mat-button-toggle [value]="p.value">{{ p.label }}</mat-button-toggle>}</mat-button-toggle-group>
        @if (preset() === 'custom') {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Du</mat-label><input matInput type="date" [ngModel]="from()" (ngModelChange)="setDates($event, to())" [max]="to() || null" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Au</mat-label><input matInput type="date" [ngModel]="to()" (ngModelChange)="setDates(from(), $event)" [min]="from() || null" /></mat-form-field>}
        @if (d(); as x) {<span class="muted per">{{ x.period.from | date: 'dd/MM/yyyy' }} → {{ x.period.to | date: 'dd/MM/yyyy' }} <span class="vs">· comparée à {{ x.period.previousFrom | date: 'dd/MM' }} → {{ x.period.previousTo | date: 'dd/MM/yyyy' }}</span></span>}
      </div>

      @if (error()) {<div class="card warn" role="alert">{{ error() }}</div>}
      @if (loading() && !d()) {<div class="card"><app-skeleton [count]="4" /></div>}
      @if (d(); as x) {
        @if (cards().length) {
          <div class="kpis">@for (k of cards(); track k.label) {
            <a class="card kpi" [class.accent]="k.accent" [routerLink]="k.route"><div class="ico"><app-icon [name]="k.icon" /></div><div class="l">{{ k.label }}</div><div class="v">{{ k.value }}</div>
              @if (k.delta !== undefined) {<div class="hint" [class.up]="(k.delta ?? 0) > 0" [class.down]="(k.delta ?? 0) < 0"><app-icon [name]="(k.delta ?? 0) >= 0 ? 'arrow_up' : 'arrow_down'" />{{ k.delta === null ? 'Pas de période précédente comparable' : signed(k.delta) + ' vs période précédente' }}</div>}
              @else if (k.hint) {<div class="hint">{{ k.hint }}</div>}</a>}</div>
        }
        <div class="grid2">
          @if (x.sales; as s) {
            <section class="card wide"><header><h3>Évolution des ventes HT</h3><span class="muted">par {{ gran(s.series.granularity) }} · net des avoirs</span></header>
              <app-line-chart [series]="salesSeries()" [format]="ref.format.bind(ref)" [short]="compact" ariaLabel="Évolution du chiffre d’affaires HT : période courante et période précédente" /></section>
            <section class="card"><header><h3>Meilleurs clients</h3><a routerLink="/reports/sales-by-customer" class="more">Détail <app-icon name="arrow_forward" /></a></header>
              @if (s.topCustomers.length) {<app-bar-chart [data]="topCustomers()" [format]="ref.format.bind(ref)" [short]="compact" ariaLabel="Chiffre d’affaires HT par client" [legendLabels]="{ primary: 'CA HT' }" />}@else {<app-empty-state icon="groups" message="Aucune vente sur la période." />}</section>
            <section class="card"><header><h3>Meilleurs produits</h3><a routerLink="/reports/sales-by-product" class="more">Détail <app-icon name="arrow_forward" /></a></header>
              @if (s.topProducts.length) {<ul class="list">@for (p of s.topProducts; track p.name) {<li><div class="nm">{{ p.name }}<span class="muted"> · {{ p.qty }} u.</span></div><span class="amt">{{ ref.format(p.htMinor) }}</span></li>}</ul>}@else {<app-empty-state icon="inventory_2" message="Aucune vente sur la période." />}</section>
          }
          @if (x.stock; as st) {
            <section class="card"><header><h3>Alertes de stock</h3><a routerLink="/stock" class="more">Stock <app-icon name="arrow_forward" /></a></header>
              @if (!st.alerts.length) {<app-empty-state icon="check_circle" message="Aucun article sous son seuil." />} @else {
                <ul class="list">@for (a of st.alerts; track a.reference) {<li><div class="nm"><strong>{{ a.reference }}</strong><span class="muted"> · {{ a.name }}</span></div><span class="chip" [class.warn]="a.status === 'low'" [class.danger]="a.status === 'out'">{{ a.status === 'out' ? 'Rupture' : a.qty + ' / ' + a.minStock }}</span></li>}</ul>}</section>
          }
          @if (x.treasury; as t) {
            <section class="card"><header><h3>Trésorerie</h3><a routerLink="/treasury" class="more">Comptes <app-icon name="arrow_forward" /></a></header>
              @if (!t.accounts.length) {<app-empty-state icon="account_balance" message="Aucun compte de trésorerie." />} @else {
                <ul class="list">@for (a of t.accounts; track a.id) {<li><div class="nm"><strong>{{ a.name }}</strong><span class="muted"> · {{ a.type === 'bank' ? 'Banque' : 'Caisse' }}</span></div><span class="amt" [class.neg]="a.balanceMinor < 0">{{ ref.format(a.balanceMinor) }}</span></li>}</ul>}</section>
          }
          @if (x.activity; as act) {
            <section class="card wide"><header><h3>Activité récente</h3><a routerLink="/audit" class="more">Journal d’audit <app-icon name="arrow_forward" /></a></header>
              @if (!act.length) {<app-empty-state icon="history" message="Aucune activité enregistrée." />} @else {
                <ul class="list act">@for (e of act; track e.id) {<li><span class="dot" [class.fail]="!e.success"></span><div><strong>{{ e.user || 'Système' }}</strong> — {{ action(e.action) }} <span class="muted">{{ e.resource }}</span></div><span class="muted time">{{ e.at | date: 'dd/MM HH:mm' }}</span></li>}</ul>}</section>
          }
        </div>
        @if (!cards().length && !x.activity) {<div class="card"><app-empty-state icon="shield" message="Aucun indicateur disponible avec vos permissions actuelles." /></div>}
        <p class="muted stamp">Données calculées le {{ x.generatedAt | date: 'dd/MM/yyyy HH:mm' }}@if (x.margin) { · {{ x.margin.note }}}</p>
      }
    </div>`,
  styles: `.periodbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px}.periodbar mat-form-field{width:160px}.per{font-size:13px}.vs{opacity:.85}
    mat-button-toggle-group{--mat-button-toggle-height:38px;border-radius:8px;background:var(--surface);flex-wrap:wrap}.stamp{font-size:12px;margin:16px 0 0}
    .kpis{grid-template-columns:repeat(auto-fit,minmax(224px,1fr))}.kpi{position:relative;text-decoration:none;color:inherit;display:block;padding:16px 18px}.kpi .v{font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpi .ico{position:absolute;right:14px;top:14px;color:var(--brand);background:var(--brand-50);width:34px;height:34px;border-radius:9px;display:grid;place-items:center}
    .kpi.accent .ico{background:var(--accent-100);color:var(--accent-ink)}.hint{margin-top:6px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:4px}.hint app-icon{--icon-size:.85rem}.hint.up{color:var(--brand)}.hint.down{color:var(--accent-ink)}
    .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:16px}.wide{grid-column:1/-1}
    header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;gap:12px}header h3{margin:0}.more{font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-weight:500}
    .list{list-style:none;margin:0;padding:0}.list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}.list li:last-child{border-bottom:0}.nm{min-width:0;overflow:hidden;text-overflow:ellipsis}
    .amt{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}.amt.neg{color:var(--danger)}.act li{justify-content:flex-start}.act .time{margin-left:auto;font-size:12px;white-space:nowrap}.dot{width:8px;height:8px;border-radius:50%;background:var(--brand);flex:none}.dot.fail{background:var(--danger)}`,
})
export class Dashboard {
  private api = inject(Api); auth = inject(AuthService); ref = inject(ReferenceDataService);
  presets = PRESETS; todayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).replace(/^./, (c) => c.toUpperCase());
  preset = signal('month'); from = signal(presetRange('month').from); to = signal(presetRange('month').to);
  d = signal<Dash | null>(null); loading = signal(true); error = signal('');
  firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0] ?? '');
  signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  action = (a: string) => ACTIONS[a] ?? a;
  gran = (g: string) => ({ day: 'jour', week: 'semaine', month: 'mois' })[g] ?? g;
  compact = (minor: number) => { const v = this.ref.fromMinor(minor); const a = Math.abs(v); const f = (n: number, d: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: d }); return a >= 1e6 ? `${f(v / 1e6, 1)} M` : a >= 1e3 ? `${f(v / 1e3, a >= 1e4 ? 0 : 1)} k` : f(v, 0); };
  salesSeries = computed(() => { const s = this.d()?.sales?.series; if (!s) return []; return [{ label: 'Période', points: s.current, tone: 'primary' as const }, { label: 'Période précédente', points: s.previous, tone: 'muted' as const }]; });
  topCustomers = computed(() => (this.d()?.sales?.topCustomers ?? []).map((c) => ({ label: c.name, value: c.htMinor })));
  quick = computed(() => [{ label: 'Nouvelle facture', icon: 'add', route: '/invoices/new', perm: 'invoices:create' }, { label: 'Nouveau devis', icon: 'request_quote', route: '/quotations/new', perm: 'quotations:create' }, { label: 'Nouvelle dépense', icon: 'payments', route: '/expenses/new', perm: 'expenses:create' }]
    .filter((q) => this.auth.has(q.perm)).slice(0, 2));
  cards = computed<Card[]>(() => {
    const x = this.d(); if (!x) return []; const f = (n: number) => this.ref.format(n); const k: Card[] = [];
    if (x.sales) { const s = x.sales;
      k.push({ label: 'Chiffre d’affaires HT', value: f(s.revenueHt.current), icon: 'receipt', route: '/reports/sales-by-period', delta: s.revenueHt.deltaPct, accent: true });
      k.push({ label: 'Ventes TTC', value: f(s.revenueTtc.current), icon: 'receipt_long', route: '/reports/sales-by-period', delta: s.revenueTtc.deltaPct });
      k.push({ label: 'Factures validées', value: String(s.invoices.current), icon: 'verified', route: '/invoices', delta: s.invoices.deltaPct, hint: s.creditNotes.current ? `${s.creditNotes.current} avoir(s)` : undefined });
      k.push({ label: 'Factures impayées', value: String(s.unpaid.count), icon: 'warning', route: '/reports/invoices-status', hint: `${f(s.unpaid.dueMinor)} dus${s.unpaid.overdueMinor ? ' · dont ' + f(s.unpaid.overdueMinor) + ' échus' : ''}`, accent: s.unpaid.overdueMinor > 0 });
      k.push({ label: 'Créances clients', value: f(s.receivablesMinor), icon: 'groups', route: '/reports/receivables-aging' }); }
    if (x.margin) k.push({ label: 'Marge estimée', value: f(x.margin.amount.current), icon: 'calculate', route: '/reports/sales-by-product', delta: x.margin.amount.deltaPct, hint: x.margin.pct === null ? undefined : `${x.margin.pct.toLocaleString('fr-FR')} % du CA couvert` });
    if (x.purchases) { k.push({ label: 'Achats HT', value: f(x.purchases.purchasesHt.current), icon: 'shopping_cart', route: '/reports/purchases-by-period', delta: x.purchases.purchasesHt.deltaPct });
      k.push({ label: 'Dettes fournisseurs', value: f(x.purchases.payablesMinor), icon: 'local_shipping', route: '/reports/payables-aging', hint: `${x.purchases.pendingOrders} commande(s) en attente` }); }
    if (x.expenses) k.push({ label: 'Dépenses', value: f(x.expenses.total.current), icon: 'payments', route: '/reports/expenses-by-category', delta: x.expenses.total.deltaPct });
    if (x.treasury) k.push({ label: 'Trésorerie', value: f(x.treasury.totalMinor), icon: 'account_balance', route: '/treasury', hint: `Banques ${f(x.treasury.bankMinor)} · Caisses ${f(x.treasury.cashMinor)}` });
    if (x.stock) { k.push({ label: 'Valeur du stock', value: f(x.stock.valueMinor), icon: 'inventory', route: '/reports/stock-valuation' });
      k.push({ label: 'Stock faible / ruptures', value: `${x.stock.lowCount} / ${x.stock.outCount}`, icon: 'warning', route: '/stock', accent: x.stock.lowCount + x.stock.outCount > 0, hint: 'articles sous seuil / en rupture' }); }
    return k;
  });
  ngOnInit() { this.load(); }
  setPreset(p: string) { this.preset.set(p); if (p !== 'custom') { const r = presetRange(p); this.from.set(r.from); this.to.set(r.to); this.load(); } }
  setDates(f: string, t: string) { this.from.set(f); this.to.set(t); if (f && t && f <= t) this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.get<Dash>('/reports/dashboard', { from: this.from(), to: this.to() }).subscribe({ next: (r) => { this.d.set(r); this.loading.set(false); }, error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}
