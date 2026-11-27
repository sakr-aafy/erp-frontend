import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { ExportMenu } from '../../../shared/components/export-menu';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { SupplierDto } from '../../../shared/models/api.models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { METHOD_LABEL } from '../../customers/customer.labels';
import { PaySupplierDialog } from '../../finance/finance-dialogs';
import { SupplierService } from '../supplier.service';
import { OpenPurchaseInvoice, SupplierPaymentsView } from '../supplier.types';

/**
 * Onglet Paiements : situation financière, factures impayées et échéances, historique des règlements. Le règlement passe
 * par le service Trésorerie existant (jamais de modification directe du solde) ; possible quel que soit le statut du fournisseur.
 */
@Component({
  selector: 'app-tab-payments',
  imports: [DatePipe, RouterLink, MatButtonModule, MatTableModule, MatPaginatorModule, Icon, EmptyState, ExportMenu, Skeleton, MoneyPipe],
  template: `
    @if (!v()) {<div class="card"><app-skeleton /></div>} @else {
      <div class="top"><h2>Situation financière</h2>
        <div class="acts">
          @if (canStatement) {<span class="labelled"><span class="muted">Relevé de compte</span><app-export-menu [path]="'/suppliers/' + c().id + '/statement'" [params]="{}" /></span>}
          @if (canPay && v()!.unpaidInvoices.length) {<button mat-flat-button color="primary" type="button" (click)="pay()"><app-icon name="add" />Enregistrer un règlement</button>}
        </div>
      </div>
      <div class="kpis">
        <div class="card k"><span class="muted">Total facturé (factures validées)</span><strong>{{ v()!.finance.billedMinor | money }}</strong></div>
        <div class="card k"><span class="muted">Total des règlements</span><strong>{{ v()!.finance.paidMinor | money }}</strong></div>
        <div class="card k main"><span class="muted">Solde restant à payer</span><strong [class.neg]="v()!.finance.balanceMinor > 0">{{ v()!.finance.balanceMinor | money }}</strong></div>
        <div class="card k"><span class="muted">Factures échues</span><strong [class.neg]="v()!.finance.overdueMinor > 0">{{ v()!.finance.overdueMinor | money }}</strong>@if (v()!.finance.overdueInvoices) {<span class="muted">{{ v()!.finance.overdueInvoices }} facture(s)</span>}</div>
        <div class="card k"><span class="muted">Échéances à venir</span><strong>{{ v()!.finance.upcomingMinor | money }}</strong></div>
        <div class="card k"><span class="muted">Seuil de blocage des commandes</span><strong>{{ v()!.finance.thresholdMinor === null ? 'Aucun' : (v()!.finance.thresholdMinor | money) }}</strong>@if (v()!.finance.ordersBlocked) {<span class="chip danger">Dépassé</span>}</div>
        @if (v()!.finance.excessMinor > 0) {<div class="card k"><span class="muted">Excédent en faveur de la société</span><strong class="pos">{{ v()!.finance.excessMinor | money }}</strong></div>}
      </div>
      @if (!v()!.finance.consistent) {<p class="warn"><app-icon name="warning" />Écart entre le solde enregistré et les opérations : consultez les contrôles de cohérence (Comptabilité).</p>}

      <h3>Factures impayées et échéances</h3>
      <div class="card" style="margin-bottom:16px">
        @if (!v()!.unpaidInvoices.length) {<app-empty-state icon="check_circle" message="Aucune facture impayée." />} @else {
          <div class="table-wrap"><table mat-table class="responsive" [dataSource]="v()!.unpaidInvoices">
            <ng-container matColumnDef="n"><th mat-header-cell *matHeaderCellDef>Facture</th><td mat-cell *matCellDef="let i" data-label="Facture"><a [routerLink]="['/purchase-invoices', i.id]"><strong>{{ i.number }}</strong></a><br><span class="muted small">{{ i.supplierInvoiceNumber }}</span></td></ng-container>
            <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let i" data-label="Date">{{ i.invoiceDate | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="due"><th mat-header-cell *matHeaderCellDef>Échéance</th><td mat-cell *matCellDef="let i" data-label="Échéance">{{ i.dueDate | date: 'dd/MM/yyyy' : 'UTC' }}@if (i.overdue) { <span class="chip danger">Échue</span>}</td></ng-container>
            <ng-container matColumnDef="t"><th mat-header-cell *matHeaderCellDef class="r">Total</th><td mat-cell *matCellDef="let i" class="r" data-label="Total">{{ i.totalMinor | money }}</td></ng-container>
            <ng-container matColumnDef="r"><th mat-header-cell *matHeaderCellDef class="r">Reste dû</th><td mat-cell *matCellDef="let i" class="r" data-label="Reste dû"><strong>{{ i.remainingMinor | money }}</strong></td></ng-container>
            <ng-container matColumnDef="a"><th mat-header-cell *matHeaderCellDef class="r"></th><td mat-cell *matCellDef="let i" class="r">@if (canPay) {<button mat-stroked-button type="button" (click)="pay(i)">Régler</button>}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="uCols"></tr><tr mat-row *matRowDef="let r; columns: uCols"></tr></table></div>}
      </div>

      <div class="top sub"><h3>Historique des règlements</h3>@if (v()!.canSeeHistory && v()!.total) {<app-export-menu [path]="'/suppliers/' + c().id + '/payments/export'" [params]="{}" />}</div>
      <div class="card">
        @if (!v()!.canSeeHistory) {<p class="muted"><app-icon name="lock" /> L’historique des règlements nécessite la permission « Trésorerie — consulter ».</p>}
        @else if (!v()!.items.length) {<app-empty-state icon="payments" message="Aucun règlement enregistré." />} @else {
          <div class="table-wrap"><table mat-table class="responsive" [dataSource]="v()!.items">
            <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let p" data-label="Date">{{ p.paidAt | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="ref"><th mat-header-cell *matHeaderCellDef>Référence</th><td mat-cell *matCellDef="let p" data-label="Référence"><strong>{{ p.number }}</strong>@if (p.reference) {<br><span class="muted small">{{ p.reference }}</span>}</td></ng-container>
            <ng-container matColumnDef="inv"><th mat-header-cell *matHeaderCellDef>Factures</th><td mat-cell *matCellDef="let p" data-label="Factures">@for (i of p.invoices; track i.id; let last = $last) {<a [routerLink]="['/purchase-invoices', i.id]">{{ i.number }}</a>@if (!last) {, }}</td></ng-container>
            <ng-container matColumnDef="m"><th mat-header-cell *matHeaderCellDef class="r">Montant</th><td mat-cell *matCellDef="let p" class="r" data-label="Montant"><strong [class.cancelled]="p.status === 'cancelled'">{{ p.amountMinor | money }}</strong></td></ng-container>
            <ng-container matColumnDef="cur"><th mat-header-cell *matHeaderCellDef>Devise</th><td mat-cell *matCellDef="let p" data-label="Devise">{{ v()!.currency }}</td></ng-container>
            <ng-container matColumnDef="mode"><th mat-header-cell *matHeaderCellDef>Mode</th><td mat-cell *matCellDef="let p" data-label="Mode">{{ method[p.method] ?? p.method }}</td></ng-container>
            <ng-container matColumnDef="acc"><th mat-header-cell *matHeaderCellDef>Compte</th><td mat-cell *matCellDef="let p" data-label="Compte">{{ p.account ?? '—' }}</td></ng-container>
            <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let p" data-label="Statut"><span class="chip" [class.ok]="p.status === 'active'" [class.off]="p.status !== 'active'">{{ p.status === 'active' ? 'Réglé' : 'Annulé' }}</span></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="pCols"></tr><tr mat-row *matRowDef="let r; columns: pCols"></tr></table></div>
          <mat-paginator [length]="v()!.total" [pageSize]="v()!.limit" [pageIndex]="v()!.page - 1" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />}
      </div>
    }`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.top.sub{margin:20px 0 10px}.top.sub h3{margin:0}h2{margin:0;font-size:16px;font-weight:600}h3{margin:20px 0 10px;font-size:15px;font-weight:600}.acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.labelled{display:inline-flex;gap:8px;align-items:center;font-size:13px}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.k{display:flex;flex-direction:column;gap:6px}.k strong{font-size:20px;font-variant-numeric:tabular-nums}.k.main{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}
    .neg{color:var(--danger)}.small{font-size:12px}@media (max-width:600px){.kpis{grid-template-columns:1fr 1fr;gap:8px}.k strong{font-size:16px}}.pos{color:var(--brand)}.cancelled{text-decoration:line-through;color:var(--muted)}.warn{display:flex;gap:8px;align-items:center;margin:12px 0 0;padding:8px 12px;background:var(--accent-50);border:1px solid var(--accent-300);border-radius:var(--r-md)}`,
})
export class TabPayments {
  c = input.required<SupplierDto>(); changed = output<void>();
  private svc = inject(SupplierService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService);
  v = signal<SupplierPaymentsView | null>(null); method = METHOD_LABEL; uCols = ['n', 'd', 'due', 't', 'r', 'a']; pCols = ['d', 'ref', 'inv', 'm', 'cur', 'mode', 'acc', 's'];
  /** Saisie d'un règlement : Trésorerie (création) et Achats (lecture des factures ouvertes). */
  canPay = this.auth.has('treasury:create') && this.auth.has('purchases:view');
  canStatement = this.auth.has('accounting:view');
  ngOnInit() { this.load(); }
  load(page = 1, limit = this.v()?.limit ?? 20) { this.svc.payments(this.c().id, page, limit).subscribe({ next: (r) => this.v.set(r), error: (e) => this.toast.error(errorMessage(e)) }); }
  onPage(e: PageEvent) { this.load(e.pageIndex + 1, e.pageSize); }
  pay(invoice?: OpenPurchaseInvoice) {
    this.dialog.open(PaySupplierDialog, { width: '620px', maxWidth: '96vw', data: { supplierId: this.c().id, supplierName: this.c().name, method: this.c().paymentMethod, ...(invoice && { invoice: { id: invoice.id } }) } })
      .afterClosed().subscribe((r) => { if (r) { this.toast.success('Règlement enregistré'); this.load(1); this.changed.emit(); } });
  }
}
