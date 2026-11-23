import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { Api } from '../../core/services/api.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { PageHeader } from '../../shared/components/page-header';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

const JOURNAL: Record<string, string> = { sales: 'Ventes', purchases: 'Achats', cash: 'Caisse', bank: 'Banque' };
const SOURCE: Record<string, string> = { invoice: 'Facture', creditNote: 'Avoir', purchaseInvoice: 'Facture d’achat', payment: 'Encaissement', supplierPayment: 'Règlement fournisseur', expense: 'Dépense', treasuryTransfer: 'Virement' };
const BUCKETS = [{ k: 'notDue', l: 'Non échu' }, { k: 'd1_30', l: '1–30 j' }, { k: 'd31_60', l: '31–60 j' }, { k: 'd61_90', l: '61–90 j' }, { k: 'd90plus', l: '> 90 j' }];
const css = `.filters{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:12px 0}.filters mat-form-field{width:190px}.r{text-align:right}.neg{color:var(--danger)}
  table.t{width:100%;border-collapse:collapse;min-width:640px}.t th{text-align:left;padding:8px;border-bottom:1px solid var(--erp-border,var(--border));font-size:13px;color:var(--erp-muted,var(--muted))}.t td{padding:8px;border-bottom:1px solid var(--erp-border,var(--border));vertical-align:top}
  .t th.r,.t td.r{text-align:right}.click{cursor:pointer}.click:hover{background:var(--brand-50)}.sub{background:var(--surface-2)}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}.kpi{padding:12px 14px}.kpi .v{font-size:18px;font-weight:600}.kpi .l{font-size:12px;color:var(--erp-muted,var(--muted))}
  .tabbody{padding-top:8px}.ok{color:var(--brand)}.cfg{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0 16px;margin-top:12px}`;

/** Comptabilité de base : journaux, créances / dettes, contrôles et reprise, paramétrage des comptes. */
@Component({
  selector: 'app-accounting',
  imports: [DatePipe, FormsModule, RouterLink, MatTabsModule, MatPaginatorModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, PageHeader, EmptyState, ExportMenu, MoneyPipe],
  template: `<div class="page"><app-page-header title="Comptabilité" subtitle="Comptabilité de base : écritures automatiques (ventes, achats, caisse, banque) issues des documents validés, suivi des créances et des dettes — pas de comptabilité générale complète">
      <a mat-stroked-button routerLink="/treasury"><app-icon name="account_balance" />Trésorerie</a></app-page-header>
    <mat-tab-group animationDuration="0ms" [(selectedIndex)]="tab" (selectedIndexChange)="onTab($event)">
      <mat-tab label="Journaux"><div class="tabbody card">
        <div class="filters"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Journal</mat-label><mat-select [(ngModel)]="jf.journal" (selectionChange)="reloadJ()"><mat-option value="">Tous</mat-option>@for (j of journals; track j.k) {<mat-option [value]="j.k">{{ j.l }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Du</mat-label><input matInput type="date" [(ngModel)]="jf.from" (change)="reloadJ()" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Au</mat-label><input matInput type="date" [(ngModel)]="jf.to" (change)="reloadJ()" /></mat-form-field>
          <app-export-menu path="/accounting/entries/export" [params]="{ journal: jf.journal, from: jf.from, to: jf.to }" /></div>
        @if (cent()) {<div class="kpis">@for (j of cent().journals; track j.journal) {<div class="card kpi"><div class="l">{{ jl(j.journal) }} — {{ j.entries }} écriture(s)</div><div class="v">{{ j.debitMinor | money }}</div></div>}</div>}
        @if (!entries().length) {<app-empty-state icon="menu_book" message="Aucune écriture. Elles sont générées automatiquement à la validation des factures, règlements et dépenses." />} @else {
        <div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Journal</th><th>N°</th><th>Libellé</th><th>Source</th><th class="r">Montant</th></tr></thead><tbody>
          @for (e of entries(); track e.id) {<tr class="click" (click)="open.set(open() === e.id ? '' : e.id)"><td>{{ e.date | date: 'dd/MM/yyyy' : 'UTC' }}</td><td>{{ jl(e.journal) }}</td><td>{{ e.number }}</td><td>{{ e.label }}@if (e.reversal) {<span class="chip off" style="margin-left:6px">Contre-passation</span>}</td><td>{{ sl(e.source?.type) }} {{ e.source?.number }}</td><td class="r">{{ e.totalMinor | money }}</td></tr>
            @if (open() === e.id) {<tr class="sub"><td colspan="6"><table class="t" style="min-width:0"><thead><tr><th>Compte</th><th>Libellé</th><th class="r">Débit</th><th class="r">Crédit</th></tr></thead><tbody>
              @for (l of e.lines; track $index) {<tr><td>{{ l.accountCode || l.roleLabel }}@if (l.accountCode) { <span class="muted">({{ l.roleLabel }})</span>}</td><td>{{ l.label }}</td><td class="r">{{ l.debitMinor ? (l.debitMinor | money) : '' }}</td><td class="r">{{ l.creditMinor ? (l.creditMinor | money) : '' }}</td></tr>}</tbody></table></td></tr>}}</tbody></table></div>}
        <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" (page)="onPage($event)" hidePageSize /></div></mat-tab>
      <mat-tab label="Créances clients"><div class="tabbody card">
        <div class="filters"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Situation au</mat-label><input matInput type="date" [(ngModel)]="asOf" (change)="loadAging()" /></mat-form-field></div>
        @if (rec()) {<div class="kpis"><div class="card kpi"><div class="l">Total à encaisser</div><div class="v">{{ rec().totalMinor | money }}</div></div>@for (b of buckets; track b.k) {<div class="card kpi"><div class="l">{{ b.l }}</div><div class="v" [class.neg]="b.k !== 'notDue' && rec().buckets[b.k] > 0">{{ rec().buckets[b.k] | money }}</div></div>}</div>
          @if (!rec().customers.length) {<app-empty-state icon="request_quote" message="Aucune créance ouverte." />} @else {<div class="table-wrap"><table class="t"><thead><tr><th>Client</th>@for (b of buckets; track b.k) {<th class="r">{{ b.l }}</th>}<th class="r">Total</th></tr></thead><tbody>
            @for (c of rec().customers; track c.customerId) {<tr class="click" (click)="openC.set(openC() === c.customerId ? '' : c.customerId)"><td><strong>{{ c.name }}</strong></td>@for (b of buckets; track b.k) {<td class="r">{{ c.buckets[b.k] ? (c.buckets[b.k] | money) : '' }}</td>}<td class="r"><strong>{{ c.totalMinor | money }}</strong></td></tr>
              @if (openC() === c.customerId) {<tr class="sub"><td [attr.colspan]="buckets.length + 2">@for (i of c.invoices; track i.id) {<div><a [routerLink]="['/invoices', i.id]">{{ i.number }}</a> — échéance {{ i.dueDate | date: 'dd/MM/yyyy' : 'UTC' }} — reste {{ i.openMinor | money }}@if (i.lateDays) { <span class="neg">({{ i.lateDays }} j de retard)</span>}</div>}</td></tr>}}</tbody></table></div>}
          @if (rec().customerCount > rec().customers.length) {<p class="muted">{{ rec().customers.length }} clients les plus débiteurs affichés sur {{ rec().customerCount }} — le rapport « Créances clients » donne la liste complète et exportable.</p>}
          <p class="muted">Soldes clients (fiches) : {{ rec().customerBalancesMinor | money }}@if (rec().customerBalancesMinor === rec().totalMinor) { <span class="ok">— cohérent avec les créances ouvertes</span>}</p>}</div></mat-tab>
      <mat-tab label="Dettes fournisseurs"><div class="tabbody card">
        <div class="filters"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Situation au</mat-label><input matInput type="date" [(ngModel)]="asOf" (change)="loadAging()" /></mat-form-field></div>
        @if (pay()) {<div class="kpis"><div class="card kpi"><div class="l">Total à payer</div><div class="v">{{ pay().totalMinor | money }}</div></div>@for (b of buckets; track b.k) {<div class="card kpi"><div class="l">{{ b.l }}</div><div class="v" [class.neg]="b.k !== 'notDue' && pay().buckets[b.k] > 0">{{ pay().buckets[b.k] | money }}</div></div>}</div>
          @if (!pay().suppliers.length) {<app-empty-state icon="local_shipping" message="Aucune dette ouverte." />} @else {<div class="table-wrap"><table class="t"><thead><tr><th>Fournisseur</th>@for (b of buckets; track b.k) {<th class="r">{{ b.l }}</th>}<th class="r">Total</th></tr></thead><tbody>
            @for (s of pay().suppliers; track s.supplierId) {<tr class="click" (click)="openS.set(openS() === s.supplierId ? '' : s.supplierId)"><td><strong>{{ s.name }}</strong></td>@for (b of buckets; track b.k) {<td class="r">{{ s.buckets[b.k] ? (s.buckets[b.k] | money) : '' }}</td>}<td class="r"><strong>{{ s.totalMinor | money }}</strong></td></tr>
              @if (openS() === s.supplierId) {<tr class="sub"><td [attr.colspan]="buckets.length + 2">@for (i of s.invoices; track i.id) {<div><a [routerLink]="['/purchase-invoices', i.id]">{{ i.number }}</a> ({{ i.supplierInvoiceNumber }}) — échéance {{ i.dueDate | date: 'dd/MM/yyyy' : 'UTC' }} — reste {{ i.openMinor | money }}@if (i.lateDays) { <span class="neg">({{ i.lateDays }} j de retard)</span>}</div>}</td></tr>}}</tbody></table></div>}
          @if (pay().supplierCount > pay().suppliers.length) {<p class="muted">{{ pay().suppliers.length }} fournisseurs les plus créditeurs affichés sur {{ pay().supplierCount }} — voir le rapport « Dettes fournisseurs ».</p>}
          <p class="muted">Soldes fournisseurs (fiches) : {{ pay().supplierBalancesMinor | money }}@if (pay().supplierBalancesMinor === pay().totalMinor) { <span class="ok">— cohérent avec les dettes ouvertes</span>}</p>}</div></mat-tab>
      @if (auth.has('accounting:validate')) {<mat-tab label="Contrôles et reprise"><div class="tabbody card">
        <p class="muted">Chaque événement financier est journalisé et idempotent : jamais deux écritures pour un même événement. La réconciliation rejoue les documents validés dont l’écriture ou le mouvement manque (ex. documents antérieurs), puis contrôle les soldes.</p>
        <div class="filters"><button mat-flat-button color="primary" (click)="reconcile()" [disabled]="busy()"><app-icon name="rule" />Réconcilier</button><button mat-stroked-button (click)="loadChecks()"><app-icon name="refresh" />Contrôler</button></div>
        @if (report()) {<div class="card" style="margin-bottom:12px"><strong>Réconciliation :</strong> {{ report().replayed.length }} document(s) rejoué(s), {{ report().failed.length }} échec(s).@for (f of report().failed; track $index) {<div class="neg">{{ f.number }} : {{ f.error }}</div>}</div>}
        @if (check()) {<div class="card" style="margin-bottom:12px" [style.border-color]="check().consistent ? 'var(--brand-200)' : 'var(--danger-200)'"><strong>Cohérence comptable :</strong> {{ check().consistent ? 'Σ débits = Σ crédits, soldes clients / fournisseurs / comptes cohérents avec les écritures' : check().issues.length + ' anomalie(s)' }} — débits {{ check().totals.debitMinor | money }} / crédits {{ check().totals.creditMinor | money }}
          @for (i of check().issues; track $index) {<div class="neg">• {{ i.message }}</div>}</div>}
        @if (tcheck()) {<div class="card" style="margin-bottom:12px" [style.border-color]="tcheck().consistent ? 'var(--brand-200)' : 'var(--danger-200)'"><strong>Soldes de trésorerie :</strong> {{ tcheck().consistent ? 'chaque compte = ouverture + Σ mouvements (' + tcheck().accountsChecked + ' compte(s))' : tcheck().mismatches.length + ' écart(s)' }}
          @for (m of tcheck().mismatches; track m.accountId) {<div class="neg">• {{ m.code }} : solde {{ m.balanceMinor | money }} ≠ attendu {{ m.expectedMinor | money }}</div>}</div>}
        <h3 style="margin:12px 0 4px">Événements financiers en échec</h3>
        @if (!failed().length) {<p class="muted">Aucun événement en échec.</p>} @else {<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Événement</th><th>Erreur</th><th></th></tr></thead><tbody>
          @for (e of failed(); track e.id) {<tr><td>{{ e.at | date: 'dd/MM/yyyy HH:mm' }}</td><td>{{ e.event }}<br><span class="muted">{{ e.documentNumber }} · {{ e.handler }} · {{ e.attempts }} tentative(s)</span></td><td class="neg">{{ e.error }}</td><td><button mat-stroked-button color="primary" (click)="retry(e)">Rejouer</button></td></tr>}</tbody></table></div>}</div></mat-tab>}
      <mat-tab label="Paramétrage"><div class="tabbody card">
        <p class="muted">Les codes comptables ne sont jamais imposés : saisissez ceux de votre plan comptable (à valider avec votre comptable). Ils s’appliquent aux écritures créées ensuite ; les écritures passées ne sont pas modifiées.</p>
        @if (cfg()) {<div class="cfg">@for (r of cfg().roles; track r.role) {<mat-form-field appearance="outline"><mat-label>{{ r.label }}</mat-label><input matInput [ngModel]="codes()[r.role] ?? ''" (ngModelChange)="setCode(r.role, $event)" [disabled]="!auth.has('accounting:update')" /></mat-form-field>}</div>
          <mat-slide-toggle [checked]="cfg().allowExpenseSelfValidation" (change)="setSelf($event.checked)" [disabled]="!auth.has('accounting:update')">Autoriser le créateur d’une dépense à la valider (désactivé = séparation des tâches)</mat-slide-toggle>
          @if (auth.has('accounting:update')) {<div style="margin-top:16px"><button mat-flat-button color="primary" (click)="saveCfg()">Enregistrer le paramétrage</button></div>}}</div></mat-tab>
    </mat-tab-group></div>`,
  styles: css,
})
export class Accounting {
  private api = inject(Api); private toast = inject(ToastService); auth = inject(AuthService);
  journals = Object.entries(JOURNAL).map(([k, l]) => ({ k, l })); buckets = BUCKETS; jl = (j: string) => JOURNAL[j] ?? j; sl = (t?: string) => (t ? SOURCE[t] ?? t : '');
  tab = 0; jf = { journal: '', from: '', to: '' }; entries = signal<any[]>([]); total = signal(0); page = signal(0); open = signal(''); cent = signal<any>(null);  
  asOf = ''; rec = signal<any>(null); pay = signal<any>(null); openC = signal(''); openS = signal(''); check = signal<any>(null); tcheck = signal<any>(null); report = signal<any>(null); failed = signal<any[]>([]); busy = signal(false);  
  cfg = signal<any>(null); codes = signal<Record<string, string>>({}); canCfg = computed(() => this.auth.has('accounting:update'));  
  ngOnInit() { this.loadJ(); this.loadAging(); this.loadCfg(); }
  onTab(i: number) { if (i === 3 && this.auth.has('accounting:validate')) this.loadChecks(); }
  reloadJ() { this.page.set(0); this.loadJ(); }
  loadJ() { this.api.get('/accounting/entries', { page: this.page() + 1, limit: 20, ...this.jf }).subscribe({ next: (r) => { this.entries.set(r.items); this.total.set(r.total); }, error: (e) => this.toast.error(errorMessage(e)) }); this.api.get('/accounting/centralizer', { from: this.jf.from, to: this.jf.to }).subscribe((c) => this.cent.set(c)); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.loadJ(); }
  loadAging() { this.api.get('/accounting/receivables', { asOf: this.asOf }).subscribe((r) => this.rec.set(r)); this.api.get('/accounting/payables', { asOf: this.asOf }).subscribe((r) => this.pay.set(r)); }
  loadChecks() { this.api.get('/accounting/consistency').subscribe((c) => this.check.set(c)); this.api.get('/treasury/consistency').subscribe({ next: (c) => this.tcheck.set(c), error: () => undefined }); this.api.get('/accounting/events', { status: 'failed', limit: 50 }).subscribe((r) => this.failed.set(r.items)); }
  reconcile() { this.busy.set(true); this.api.post('/accounting/reconcile').subscribe({ next: (r) => { this.report.set(r); this.check.set(r.accounting); this.tcheck.set(r.treasury); this.busy.set(false); this.loadChecks(); this.loadJ(); }, error: (e) => { this.toast.error(errorMessage(e)); this.busy.set(false); } }); }
  retry(e: { id: string }) { this.api.post(`/accounting/events/${e.id}/retry`).subscribe({ next: () => { this.toast.success('Opération rejouée avec succès'); this.loadChecks(); }, error: (er) => { this.toast.error(errorMessage(er)); this.loadChecks(); } }); }
  loadCfg() { this.api.get('/accounting/settings').subscribe((c) => { this.cfg.set(c); this.codes.set(Object.fromEntries(c.roles.map((r: { role: string; accountCode: string | null }) => [r.role, r.accountCode ?? '']))); }); }
  setCode(role: string, v: string) { this.codes.update((c) => ({ ...c, [role]: v })); }
  setSelf(v: boolean) { this.cfg.update((c) => ({ ...c, allowExpenseSelfValidation: v })); }
  saveCfg() { this.api.put('/accounting/settings', { accounts: this.codes(), allowExpenseSelfValidation: this.cfg().allowExpenseSelfValidation }).subscribe({ next: (c) => { this.cfg.set(c); this.toast.success('Paramétrage enregistré'); }, error: (e) => this.toast.error(errorMessage(e)) }); }
}
