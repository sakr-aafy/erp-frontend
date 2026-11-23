import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../core/services/api.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { PageHeader } from '../../shared/components/page-header';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { prompt } from '../../shared/components/prompt-dialog';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AccountDialog, PaySupplierDialog, TransferDialog } from './finance-dialogs';

const css = `.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}.kpi{padding:14px 16px}.kpi .v{font-size:22px;font-weight:600;margin-top:4px}.kpi .l{color:var(--erp-muted,var(--muted));font-size:13px}
  .r{text-align:right}.neg{color:var(--danger)}.filters{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.filters mat-form-field{width:190px}h3{margin:16px 0 8px;font-size:16px}`;

/** Trésorerie : position, comptes (banque / caisse), virements internes. */
@Component({
  selector: 'app-treasury-home',
  imports: [DatePipe, RouterLink, RowActions, MatTableModule, MatButtonModule, Icon, PageHeader, EmptyState, MoneyPipe],
  template: `<div class="page"><app-page-header title="Trésorerie" subtitle="Comptes bancaires et caisses : soldes, mouvements immuables (toute correction passe par un mouvement inverse)">
      <a mat-stroked-button routerLink="movements"><app-icon name="swap_vert" />Mouvements</a>
      @if (auth.has('treasury:validate')) {<a mat-stroked-button routerLink="reconciliation"><app-icon name="fact_check" />Rapprochement</a>}
      <a mat-stroked-button routerLink="supplier-payments"><app-icon name="payments" />Règlements fournisseurs</a>
      @if (auth.has('treasury:create')) {<button mat-stroked-button (click)="transfer()" [disabled]="accounts().length < 2"><app-icon name="sync_alt" />Virement interne</button>
        <button mat-flat-button color="primary" (click)="openAccount()"><app-icon name="add" />Nouveau compte</button>}</app-page-header>
    <div class="kpis"><div class="card kpi"><div class="l">Banques</div><div class="v">{{ pos()?.bankMinor | money }}</div></div><div class="card kpi"><div class="l">Caisses</div><div class="v">{{ pos()?.cashMinor | money }}</div></div><div class="card kpi"><div class="l">Trésorerie totale</div><div class="v">{{ pos()?.totalMinor | money }}</div></div></div>
    <div class="card">@if (!accounts().length) {<app-empty-state icon="account_balance" message="Aucun compte de trésorerie. Créez une banque ou une caisse pour enregistrer encaissements, règlements et dépenses." />} @else {
      <div class="table-wrap"><table mat-table [dataSource]="accounts()">
        <ng-container matColumnDef="n"><th mat-header-cell *matHeaderCellDef>Compte</th><td mat-cell *matCellDef="let a"><strong>{{ a.code }}</strong> — {{ a.name }}<br><span class="muted">{{ a.type === 'bank' ? 'Banque' : 'Caisse' }}@if (a.iban) { · {{ a.iban }}}@if (a.accountCode) { · compte {{ a.accountCode }}}</span></td></ng-container>
        <ng-container matColumnDef="b"><th mat-header-cell *matHeaderCellDef class="r">Solde</th><td mat-cell *matCellDef="let a" class="r" [class.neg]="a.balanceMinor < 0"><strong>{{ a.balanceMinor | money }}</strong></td></ng-container>
        <ng-container matColumnDef="r"><th mat-header-cell *matHeaderCellDef>Rapprochement</th><td mat-cell *matCellDef="let a">@if (a.type === 'bank') {{{ a.unreconciledCount }} à pointer@if (a.lastReconciledDate) { <br><span class="muted">jusqu’au {{ a.lastReconciledDate | date: 'dd/MM/yyyy' : 'UTC' }}</span>}} @else {<span class="muted">—</span>}</td></ng-container>
        <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let a"><span class="chip" [class.ok]="a.isActive" [class.off]="!a.isActive">{{ a.isActive ? 'Actif' : 'Inactif' }}</span>@if (a.allowNegative) {<span class="chip" style="margin-left:4px">Découvert</span>}</td></ng-container>
        <ng-container matColumnDef="x"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let a" class="r"><app-row-actions [actions]="acts(a)" /></td></ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}</div>
    <h3>Derniers virements internes</h3>
    <div class="card">@if (!transfers().length) {<app-empty-state icon="sync_alt" message="Aucun virement interne." />} @else {<div class="table-wrap"><table mat-table [dataSource]="transfers()">
      <ng-container matColumnDef="n"><th mat-header-cell *matHeaderCellDef>N°</th><td mat-cell *matCellDef="let t">{{ t.number }}</td></ng-container>
      <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let t">{{ t.date | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
      <ng-container matColumnDef="f"><th mat-header-cell *matHeaderCellDef>De → vers</th><td mat-cell *matCellDef="let t">{{ name(t.fromAccountId) }} → {{ name(t.toAccountId) }}</td></ng-container>
      <ng-container matColumnDef="a"><th mat-header-cell *matHeaderCellDef class="r">Montant</th><td mat-cell *matCellDef="let t" class="r">{{ t.amountMinor | money }}</td></ng-container>
      <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let t"><span class="chip" [class.ok]="t.status === 'active'" [class.off]="t.status !== 'active'">{{ t.status === 'active' ? 'Effectué' : 'Annulé' }}</span></td></ng-container>
      <ng-container matColumnDef="x"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let t">@if (t.status === 'active' && auth.has('treasury:validate')) {<button mat-stroked-button color="warn" (click)="cancel(t)">Annuler</button>}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="tcols"></tr><tr mat-row *matRowDef="let r; columns: tcols"></tr></table></div>}</div></div>`,
  styles: css,
})
export class TreasuryHome {
  private api = inject(Api); private dialog = inject(MatDialog); private toast = inject(ToastService); auth = inject(AuthService);
  cols = ['n', 'b', 'r', 's', 'x']; tcols = ['n', 'd', 'f', 'a', 's', 'x']; pos = signal<any>(null); transfers = signal<any[]>([]); accounts = computed<any[]>(() => this.pos()?.accounts ?? []);  
  ngOnInit() { this.load(); }
  load() { this.api.get('/treasury/position').subscribe((p) => this.pos.set(p)); this.api.get('/treasury/transfers', { limit: 10 }).subscribe((r) => this.transfers.set(r.items)); }
  acts = (a: { id: string; isActive: boolean }): RowAction[] => [{ label: 'Mouvements du compte', icon: 'list_alt', link: ['movements'] as unknown[], hidden: false }, { label: 'Modifier', icon: 'edit', run: () => this.openAccount(a), hidden: !this.auth.has('treasury:update') },
    { label: a.isActive ? 'Désactiver' : 'Activer', icon: a.isActive ? 'block' : 'check_circle', run: () => this.toggle(a), hidden: !this.auth.has('treasury:update') }];
  name = (id: string) => this.accounts().find((a) => a.id === id)?.name ?? '—';
  openAccount(a?: unknown) { this.dialog.open(AccountDialog, { data: a ?? null }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Compte enregistré'); this.load(); } }); }
  toggle(a: { id: string; isActive: boolean }) { this.api.patch(`/treasury/accounts/${a.id}/active`, { isActive: !a.isActive }).subscribe({ next: () => { this.toast.success('Statut mis à jour'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  transfer() { this.dialog.open(TransferDialog, { data: { accounts: this.accounts().filter((a) => a.isActive) } }).afterClosed().subscribe((r) => { if (r) { this.toast.success(`Virement ${r.number} effectué`); this.load(); } }); }
  cancel(t: { id: string; number: string }) { prompt(this.dialog, { title: `Annuler le virement ${t.number}`, label: 'Motif de l’annulation', confirmLabel: 'Annuler le virement' }).subscribe((reason) => reason && this.api.post(`/treasury/transfers/${t.id}/cancel`, { reason }).subscribe({ next: () => { this.toast.success('Virement annulé (mouvements inverses créés)'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}

/** Historique des mouvements de trésorerie (lecture seule, immuables) + relevé de compte. */
@Component({
  selector: 'app-treasury-movements',
  imports: [DatePipe, FormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, PageHeader, EmptyState, ExportMenu, MoneyPipe],
  template: `<div class="page"><app-page-header title="Mouvements de trésorerie" subtitle="Chaque encaissement, règlement, dépense ou virement crée un mouvement immuable lié à son document source">
      <a mat-stroked-button routerLink="/treasury"><app-icon name="arrow_back" />Trésorerie</a>
      @if (f.accountId) {<app-export-menu [path]="'/treasury/accounts/' + f.accountId + '/statement'" [params]="{ from: f.from, to: f.to }" />} @else {<app-export-menu path="/treasury/movements/export" [params]="{ direction: f.direction, kind: f.kind, from: f.from, to: f.to }" />}</app-page-header>
    <div class="card"><div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Compte</mat-label><mat-select [(ngModel)]="f.accountId" (selectionChange)="reload()"><mat-option value="">Tous</mat-option>@for (a of accounts(); track a.id) {<mat-option [value]="a.id">{{ a.name }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Sens</mat-label><mat-select [(ngModel)]="f.direction" (selectionChange)="reload()"><mat-option value="">Tous</mat-option><mat-option value="in">Entrées</mat-option><mat-option value="out">Sorties</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Nature</mat-label><mat-select [(ngModel)]="f.kind" (selectionChange)="reload()"><mat-option value="">Toutes</mat-option>@for (k of kinds; track k.v) {<mat-option [value]="k.v">{{ k.l }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rapprochement</mat-label><mat-select [(ngModel)]="f.reconciled" (selectionChange)="reload()"><mat-option value="">Tous</mat-option><mat-option value="true">Rapprochés</mat-option><mat-option value="false">Non rapprochés</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Du</mat-label><input matInput type="date" [(ngModel)]="f.from" (change)="reload()" /></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Au</mat-label><input matInput type="date" [(ngModel)]="f.to" (change)="reload()" /></mat-form-field></div>
      @if (!items().length) {<app-empty-state icon="swap_vert" message="Aucun mouvement." />} @else {<div class="table-wrap"><table mat-table [dataSource]="items()">
        <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let m">{{ m.date | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
        <ng-container matColumnDef="a"><th mat-header-cell *matHeaderCellDef>Compte</th><td mat-cell *matCellDef="let m">{{ m.accountName }}</td></ng-container>
        <ng-container matColumnDef="l"><th mat-header-cell *matHeaderCellDef>Libellé</th><td mat-cell *matCellDef="let m">{{ m.label }}@if (m.reversalOf) {<span class="chip off" style="margin-left:6px">Annulation</span>}@if (m.reversed) {<span class="chip" style="margin-left:6px">Annulé</span>}</td></ng-container>
        <ng-container matColumnDef="i"><th mat-header-cell *matHeaderCellDef class="r">Entrée</th><td mat-cell *matCellDef="let m" class="r">@if (m.direction === 'in') {{{ m.amountMinor | money }}}</td></ng-container>
        <ng-container matColumnDef="o"><th mat-header-cell *matHeaderCellDef class="r">Sortie</th><td mat-cell *matCellDef="let m" class="r">@if (m.direction === 'out') {{{ m.amountMinor | money }}}</td></ng-container>
        <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef class="r">Solde après</th><td mat-cell *matCellDef="let m" class="r muted">{{ m.balanceAfterMinor | money }}</td></ng-container>
        <ng-container matColumnDef="r"><th mat-header-cell *matHeaderCellDef>Rapproché</th><td mat-cell *matCellDef="let m"><app-icon class="rec" [class.locked]="m.reconciled" [attr.title]="m.reconciled ? 'Rapproché (verrouillé)' : 'Non rapproché'" [style.color]="m.reconciled ? 'var(--brand)' : 'var(--placeholder)'" [name]="m.reconciled ? 'lock' : 'circle'" /></td></ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}
      <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" (page)="onPage($event)" hidePageSize /></div></div>`,
  styles: css,
})
export class TreasuryMovements {
  private api = inject(Api); private route = inject(ActivatedRoute); private toast = inject(ToastService);
  cols = ['d', 'a', 'l', 'i', 'o', 's', 'r']; items = signal<any[]>([]); accounts = signal<any[]>([]); total = signal(0); page = signal(0);  
  kinds = [{ v: 'customer_receipt', l: 'Encaissement client' }, { v: 'supplier_payment', l: 'Règlement fournisseur' }, { v: 'expense', l: 'Dépense' }, { v: 'transfer', l: 'Virement' }, { v: 'reversal', l: 'Annulation' }];
  f = { accountId: '', direction: '', kind: '', reconciled: '', from: '', to: '' };
  ngOnInit() { this.f.accountId = this.route.snapshot.queryParamMap.get('accountId') ?? ''; this.api.get('/treasury/accounts').subscribe((a) => this.accounts.set(a)); this.load(); }
  reload() { this.page.set(0); this.load(); }
  load() { this.api.get('/treasury/movements', { page: this.page() + 1, limit: 20, ...this.f }).subscribe({ next: (r) => { this.items.set(r.items); this.total.set(r.total); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.load(); }
}

/** Rapprochement bancaire : pointage des mouvements, écart en direct, validation définitive. */
@Component({
  selector: 'app-reconciliation',
  imports: [DatePipe, FormsModule, RouterLink, MatTableModule, MatButtonModule, Icon, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule, PageHeader, EmptyState, MoneyPipe],
  template: `<div class="page"><app-page-header title="Rapprochement bancaire" subtitle="Pointez les mouvements présents sur le relevé : le solde du relevé doit égaler le dernier solde rapproché + les mouvements pointés. Un rapprochement validé est définitif."><a mat-stroked-button routerLink="/treasury"><app-icon name="arrow_back" />Trésorerie</a></app-page-header>
    <div class="card"><div class="filters"><mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:260px"><mat-label>Compte bancaire</mat-label><mat-select [ngModel]="accountId()" (selectionChange)="pick($event.value)">@for (a of banks(); track a.id) {<mat-option [value]="a.id">{{ a.name }}</mat-option>}</mat-select></mat-form-field></div>
      @if (cand()) {
      <p class="muted">Dernier solde rapproché : <strong>{{ cand().previousBalanceMinor | money }}</strong>@if (cand().lastReconciledDate) { (relevé du {{ cand().lastReconciledDate | date: 'dd/MM/yyyy' : 'UTC' }}). Aucun mouvement ne peut être daté avant cette date.}</p>
      @if (!cand().items.length) {<app-empty-state icon="fact_check" message="Tous les mouvements de ce compte sont rapprochés." />} @else {
      <div class="table-wrap"><table mat-table [dataSource]="cand().items">
        <ng-container matColumnDef="c"><th mat-header-cell *matHeaderCellDef><mat-checkbox [checked]="allChecked()" [indeterminate]="someChecked()" (change)="toggleAll($event.checked)" aria-label="Tout pointer" /></th><td mat-cell *matCellDef="let m"><mat-checkbox [checked]="sel().has(m.id)" (change)="toggle(m.id, $event.checked)" [aria-label]="'Pointer ' + m.label" /></td></ng-container>
        <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let m">{{ m.date | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
        <ng-container matColumnDef="l"><th mat-header-cell *matHeaderCellDef>Libellé</th><td mat-cell *matCellDef="let m">{{ m.label }}</td></ng-container>
        <ng-container matColumnDef="i"><th mat-header-cell *matHeaderCellDef class="r">Entrée</th><td mat-cell *matCellDef="let m" class="r">@if (m.direction === 'in') {{{ m.amountMinor | money }}}</td></ng-container>
        <ng-container matColumnDef="o"><th mat-header-cell *matHeaderCellDef class="r">Sortie</th><td mat-cell *matCellDef="let m" class="r">@if (m.direction === 'out') {{{ m.amountMinor | money }}}</td></ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}
      <div class="filters" style="margin-top:16px"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Date du relevé</mat-label><input matInput type="date" [(ngModel)]="date" [max]="today" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Solde du relevé ({{ ref.symbol() }})</mat-label><input matInput type="number" [step]="1 / 10 ** ref.decimals()" [ngModel]="statement()" (ngModelChange)="statement.set($event)" /></mat-form-field></div>
      <div class="kpis" style="margin-top:12px"><div class="card kpi"><div class="l">Solde rapproché + pointé</div><div class="v">{{ expected() | money }}</div></div>
        <div class="card kpi"><div class="l">Écart avec le relevé</div><div class="v" [class.neg]="diff() !== 0" [style.color]="diff() === 0 && statementSet() ? 'var(--brand)' : ''">{{ statementSet() ? (diff() | money) : '—' }}</div></div></div>
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      <button mat-flat-button color="primary" [disabled]="!canValidate() || busy()" (click)="validate()"><app-icon name="lock" />Valider le rapprochement</button>}</div>
    @if (history().length) {<h3>Rapprochements validés</h3><div class="card"><div class="table-wrap"><table mat-table [dataSource]="history()">
      <ng-container matColumnDef="n"><th mat-header-cell *matHeaderCellDef>N°</th><td mat-cell *matCellDef="let h">{{ h.number }}</td></ng-container>
      <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Relevé du</th><td mat-cell *matCellDef="let h">{{ h.statementDate | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
      <ng-container matColumnDef="b"><th mat-header-cell *matHeaderCellDef class="r">Solde du relevé</th><td mat-cell *matCellDef="let h" class="r">{{ h.statementBalanceMinor | money }}</td></ng-container>
      <ng-container matColumnDef="m"><th mat-header-cell *matHeaderCellDef class="r">Mouvements</th><td mat-cell *matCellDef="let h" class="r">{{ h.movementCount }}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="hcols"></tr><tr mat-row *matRowDef="let r; columns: hcols"></tr></table></div></div>}</div>`,
  styles: css,
})
export class Reconciliation {
  private api = inject(Api); private toast = inject(ToastService); ref = inject(ReferenceDataService);
  cols = ['c', 'd', 'l', 'i', 'o']; hcols = ['n', 'd', 'b', 'm']; banks = signal<any[]>([]); accountId = signal(''); cand = signal<any>(null); sel = signal(new Set<string>()); history = signal<any[]>([]);  
  statement = signal<number | null>(null); date = new Date().toISOString().slice(0, 10); today = this.date; error = signal(''); busy = signal(false);
  statementSet = computed(() => this.statement() !== null && `${this.statement()}` !== '');
  selectedSum = computed(() => (this.cand()?.items ?? []).filter((m: any) => this.sel().has(m.id)).reduce((s: number, m: any) => s + m.signedMinor, 0));  
  expected = computed(() => (this.cand()?.previousBalanceMinor ?? 0) + this.selectedSum());
  diff = computed(() => this.ref.toMinor(Number(this.statement() ?? 0)) - this.expected());
  allChecked = computed(() => !!this.cand()?.items.length && this.sel().size === this.cand().items.length); someChecked = computed(() => this.sel().size > 0 && !this.allChecked());
  canValidate = computed(() => this.sel().size > 0 && this.statementSet() && this.diff() === 0);
  ngOnInit() { this.api.get('/treasury/accounts', { type: 'bank', active: true }).subscribe((a) => { this.banks.set(a); if (a.length === 1) this.pick(a[0].id); }); }
  pick(id: string) { this.accountId.set(id); this.sel.set(new Set()); this.statement.set(null); this.error.set('');
    this.api.get(`/treasury/reconciliations/candidates/${id}`).subscribe((c) => this.cand.set(c)); this.api.get('/treasury/reconciliations', { accountId: id, limit: 10 }).subscribe((r) => this.history.set(r.items)); }
  toggle(id: string, on: boolean) { const s = new Set(this.sel()); if (on) s.add(id); else s.delete(id); this.sel.set(s); }
  toggleAll(on: boolean) { this.sel.set(on ? new Set<string>(this.cand().items.map((m: { id: string }) => m.id)) : new Set()); }
  validate() {
    this.busy.set(true); this.error.set('');
    this.api.post('/treasury/reconciliations', { accountId: this.accountId(), statementDate: this.date, statementBalanceMinor: this.ref.toMinor(Number(this.statement())), movementIds: [...this.sel()] }).subscribe({
      next: (r) => { this.toast.success(`Rapprochement ${r.number} validé`); this.busy.set(false); this.pick(this.accountId()); }, error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

/** Règlements fournisseurs : historique, nouveau règlement (partiel / groupé), annulation. */
@Component({
  selector: 'app-supplier-payments',
  imports: [DatePipe, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, Icon, PageHeader, EmptyState, MoneyPipe],
  template: `<div class="page"><app-page-header title="Règlements fournisseurs" subtitle="Règlements partiels ou groupés affectés aux factures d’achat ; chaque règlement sort de la trésorerie et solde la dette fournisseur"><a mat-stroked-button routerLink="/treasury"><app-icon name="arrow_back" />Trésorerie</a>
      @if (auth.has('treasury:create')) {<button mat-flat-button color="primary" (click)="newPayment()"><app-icon name="add" />Nouveau règlement</button>}</app-page-header>
    <div class="card">@if (!items().length) {<app-empty-state icon="payments" message="Aucun règlement fournisseur." />} @else {<div class="table-wrap"><table mat-table [dataSource]="items()">
      <ng-container matColumnDef="n"><th mat-header-cell *matHeaderCellDef>N°</th><td mat-cell *matCellDef="let p">{{ p.number }}</td></ng-container>
      <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let p">{{ p.paidAt | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
      <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef>Fournisseur</th><td mat-cell *matCellDef="let p">{{ p.supplierName }}<br><span class="muted">{{ factures(p) }}</span></td></ng-container>
      <ng-container matColumnDef="a"><th mat-header-cell *matHeaderCellDef class="r">Montant</th><td mat-cell *matCellDef="let p" class="r">{{ p.amountMinor | money }}</td></ng-container>
      <ng-container matColumnDef="t"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let p"><span class="chip" [class.ok]="p.status === 'active'" [class.off]="p.status !== 'active'">{{ p.status === 'active' ? 'Enregistré' : 'Annulé' }}</span></td></ng-container>
      <ng-container matColumnDef="x"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let p">@if (p.status === 'active' && auth.has('treasury:validate')) {<button mat-stroked-button color="warn" (click)="cancel(p)">Annuler</button>}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}
      <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" (page)="onPage($event)" hidePageSize /></div></div>`,
  styles: css,
})
export class SupplierPayments {
  private api = inject(Api); private dialog = inject(MatDialog); private toast = inject(ToastService); auth = inject(AuthService);
  cols = ['n', 'd', 's', 'a', 't', 'x']; items = signal<any[]>([]); total = signal(0); page = signal(0);  
  ngOnInit() { this.load(); } factures = (p: { allocations: { number: string }[] }) => p.allocations.map((a) => a.number).join(', ');
  load() { this.api.get('/supplier-payments', { page: this.page() + 1, limit: 20 }).subscribe({ next: (r) => { this.items.set(r.items); this.total.set(r.total); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.load(); }
  newPayment() { this.dialog.open(PaySupplierDialog, { data: {} }).afterClosed().subscribe((r) => { if (r) { this.toast.success(`Règlement ${r.number} enregistré`); this.load(); } }); }
  cancel(p: { id: string; number: string }) { prompt(this.dialog, { title: `Annuler le règlement ${p.number}`, label: 'Motif de l’annulation', confirmLabel: 'Annuler le règlement' }).subscribe((reason) => reason && this.api.post(`/supplier-payments/${p.id}/cancel`, { reason }).subscribe({ next: () => { this.toast.success('Règlement annulé'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}
