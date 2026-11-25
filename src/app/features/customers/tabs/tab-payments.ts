import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { ExportMenu } from '../../../shared/components/export-menu';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { Customer2 } from '../../../shared/models/api.models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PaymentDialog } from '../../sales/payment-dialog';
import { METHOD_LABEL } from '../customer.labels';
import { CustomerService } from '../customer.service';
import { PaymentsView, UnpaidInvoice } from '../customer.types';

/** Onglet Paiements : situation financière, historique, factures impayées. L'encaissement passe par le service existant (jamais de modification directe du solde). */
@Component({
  selector: 'app-tab-payments',
  imports: [DatePipe, RouterLink, MatButtonModule, MatMenuModule, MatTableModule, MatPaginatorModule, Icon, EmptyState, ExportMenu, Skeleton, MoneyPipe],
  template: `
    @if (!v()) {<div class="card"><app-skeleton /></div>} @else {
      <div class="top"><h2>Situation financière</h2>
        <div class="acts">
          @if (canStatement()) {<app-export-menu [path]="'/customers/' + c().id + '/statement'" [params]="{}" />}
          @if (canPay() && v()!.unpaidInvoices.length === 1) {<button mat-flat-button color="primary" type="button" (click)="pay(v()!.unpaidInvoices[0]!)"><app-icon name="add" />Enregistrer un paiement</button>}
          @else if (canPay() && v()!.unpaidInvoices.length > 1) {<button mat-flat-button color="primary" type="button" [matMenuTriggerFor]="m"><app-icon name="add" />Enregistrer un paiement</button>
            <mat-menu #m="matMenu">@for (i of v()!.unpaidInvoices; track i.id) {<button mat-menu-item type="button" (click)="pay(i)">{{ i.number }} — reste {{ i.remainingMinor | money }}</button>}</mat-menu>}
        </div>
      </div>
      <div class="kpis">
        <div class="card k"><span class="muted">Total facturé</span><strong>{{ v()!.finance.billedMinor | money }}</strong></div>
        <div class="card k"><span class="muted">Total des avoirs</span><strong>{{ v()!.finance.creditNotesMinor | money }}</strong></div>
        <div class="card k"><span class="muted">Total encaissé</span><strong>{{ v()!.finance.paidMinor | money }}</strong></div>
        <div class="card k main"><span class="muted">Solde restant</span><strong [class.neg]="v()!.finance.balanceMinor > 0">{{ v()!.finance.balanceMinor | money }}</strong></div>
        <div class="card k"><span class="muted">Factures échues</span><strong [class.neg]="v()!.finance.overdueMinor > 0">{{ v()!.finance.overdueMinor | money }}</strong>@if (v()!.finance.overdueInvoices) {<span class="muted">{{ v()!.finance.overdueInvoices }} facture(s)</span>}</div>
        <div class="card k"><span class="muted">Crédit disponible</span><strong>{{ v()!.finance.availableCreditMinor === null ? 'Illimité' : (v()!.finance.availableCreditMinor | money) }}</strong>@if (v()!.finance.creditExceeded) {<span class="chip danger">Plafond dépassé</span>}</div>
        @if (v()!.finance.excessMinor > 0) {<div class="card k"><span class="muted">Excédent en faveur du client</span><strong class="pos">{{ v()!.finance.excessMinor | money }}</strong></div>}
      </div>
      @if (!v()!.finance.consistent) {<p class="warn"><app-icon name="warning" />Écart entre le solde enregistré et les opérations : consultez les contrôles de cohérence (Comptabilité).</p>}

      <h3>Factures impayées</h3>
      <div class="card" style="margin-bottom:16px">
        @if (!v()!.unpaidInvoices.length) {<app-empty-state icon="check_circle" message="Aucune facture impayée." />} @else {
          <div class="table-wrap"><table mat-table class="responsive" [dataSource]="v()!.unpaidInvoices">
            <ng-container matColumnDef="n"><th mat-header-cell *matHeaderCellDef>Facture</th><td mat-cell *matCellDef="let i" data-label="Facture"><a [routerLink]="['/invoices', i.id]"><strong>{{ i.number }}</strong></a></td></ng-container>
            <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let i" data-label="Date">{{ i.issueDate | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="due"><th mat-header-cell *matHeaderCellDef>Prochaine échéance</th><td mat-cell *matCellDef="let i" data-label="Échéance">{{ i.nextDueDate ? (i.nextDueDate | date: 'dd/MM/yyyy' : 'UTC') : '—' }}@if (i.overdue) { <span class="chip danger">Échue</span>}</td></ng-container>
            <ng-container matColumnDef="t"><th mat-header-cell *matHeaderCellDef class="r">Total</th><td mat-cell *matCellDef="let i" class="r" data-label="Total">{{ i.totalMinor | money }}</td></ng-container>
            <ng-container matColumnDef="r"><th mat-header-cell *matHeaderCellDef class="r">Reste dû</th><td mat-cell *matCellDef="let i" class="r" data-label="Reste dû"><strong>{{ i.remainingMinor | money }}</strong></td></ng-container>
            <ng-container matColumnDef="a"><th mat-header-cell *matHeaderCellDef class="r"></th><td mat-cell *matCellDef="let i" class="r">@if (canPay()) {<button mat-stroked-button type="button" (click)="pay(i)">Encaisser</button>}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="uCols"></tr><tr mat-row *matRowDef="let r; columns: uCols"></tr></table></div>}
      </div>

      <h3>Historique des paiements</h3>
      <div class="card">
        @if (!v()!.items.length) {<app-empty-state icon="payments" message="Aucun paiement enregistré." />} @else {
          <div class="table-wrap"><table mat-table class="responsive" [dataSource]="v()!.items">
            <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let p" data-label="Date">{{ p.paidAt | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="ref"><th mat-header-cell *matHeaderCellDef>Référence</th><td mat-cell *matCellDef="let p" data-label="Référence">{{ p.reference || '—' }}</td></ng-container>
            <ng-container matColumnDef="inv"><th mat-header-cell *matHeaderCellDef>Facture</th><td mat-cell *matCellDef="let p" data-label="Facture"><a [routerLink]="['/invoices', p.invoiceId]">{{ p.invoiceNumber ?? '—' }}</a></td></ng-container>
            <ng-container matColumnDef="m"><th mat-header-cell *matHeaderCellDef class="r">Montant</th><td mat-cell *matCellDef="let p" class="r" data-label="Montant"><strong [class.cancelled]="p.status === 'cancelled'">{{ p.amountMinor | money }}</strong></td></ng-container>
            <ng-container matColumnDef="mode"><th mat-header-cell *matHeaderCellDef>Mode</th><td mat-cell *matCellDef="let p" data-label="Mode">{{ method[p.method] ?? p.method }}</td></ng-container>
            @if (v()!.canSeeAccounts) {<ng-container matColumnDef="acc"><th mat-header-cell *matHeaderCellDef>Compte</th><td mat-cell *matCellDef="let p" data-label="Compte">{{ p.account ?? '—' }}</td></ng-container>}
            <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let p" data-label="Statut"><span class="chip" [class.ok]="p.status === 'active'" [class.off]="p.status !== 'active'">{{ p.status === 'active' ? 'Encaissé' : 'Annulé' }}</span></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="pCols()"></tr><tr mat-row *matRowDef="let r; columns: pCols()"></tr></table></div>}
        <mat-paginator [length]="v()!.total" [pageSize]="v()!.limit" [pageIndex]="v()!.page - 1" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    }`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}h3{margin:20px 0 10px;font-size:15px;font-weight:600}.acts{display:flex;gap:8px;flex-wrap:wrap}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.k{display:flex;flex-direction:column;gap:6px}.k strong{font-size:20px;font-variant-numeric:tabular-nums}.k.main{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}
    .neg{color:var(--danger)}@media (max-width:600px){.kpis{grid-template-columns:1fr 1fr;gap:8px}.k strong{font-size:16px}}.pos{color:var(--brand)}.cancelled{text-decoration:line-through;color:var(--muted)}.warn{display:flex;gap:8px;align-items:center;margin:12px 0 0;padding:8px 12px;background:var(--accent-50);border:1px solid var(--accent-300);border-radius:var(--r-md)}`,
})
export class TabPayments {
  c = input.required<Customer2>(); changed = output<void>();
  private svc = inject(CustomerService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService);
  v = signal<PaymentsView | null>(null); method = METHOD_LABEL; uCols = ['n', 'd', 'due', 't', 'r', 'a'];
  canPay = computed(() => this.auth.has('invoices:update'));
  canStatement = computed(() => this.auth.has('accounting:view'));
  pCols = computed(() => ['d', 'ref', 'inv', 'm', 'mode', ...(this.v()?.canSeeAccounts ? ['acc'] : []), 's']);
  ngOnInit() { this.load(); }
  load(page = 1, limit = this.v()?.limit ?? 20) { this.svc.payments(this.c().id, page, limit).subscribe({ next: (r) => this.v.set(r), error: (e) => this.toast.error(errorMessage(e)) }); }
  onPage(e: PageEvent) { this.load(e.pageIndex + 1, e.pageSize); }
  pay(i: UnpaidInvoice) {
    this.dialog.open(PaymentDialog, { data: { invoiceId: i.id, number: i.number, dueMinor: i.remainingMinor } }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Encaissement enregistré'); this.load(1); this.changed.emit(); } });
  }
}
