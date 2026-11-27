import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { ExportMenu } from '../../../shared/components/export-menu';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { SupplierDto } from '../../../shared/models/api.models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SupplierActions } from '../supplier-actions.service';
import { TX_ICON, TX_LABEL, TX_STATUS, supplierTxStatus } from '../supplier.labels';
import { SupplierService } from '../supplier.service';
import { SupplierTx, SupplierTxKind } from '../supplier.types';

/** Onglet Transactions : lit les documents réels des modules Achats et Importations (aucune copie). */
@Component({
  selector: 'app-tab-transactions',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon, EmptyState, ExportMenu, Skeleton, MoneyPipe],
  template: `
    <div class="top"><h2>Historique des achats</h2>
      <div class="acts">@if (kinds().length) {<app-export-menu [path]="'/suppliers/' + c().id + '/transactions/export'" [params]="exportParams()" />}
        @if (order(); as o) {<a mat-flat-button color="primary" [routerLink]="o.link" [queryParams]="{ supplierId: c().id }"><app-icon name="add" />{{ o.label }}</a>}</div></div>
    <div class="card">
      <div class="toolbar-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Référence</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="q" placeholder="BC-, FA-, n° fournisseur…" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Type de document</mat-label>
          <mat-select [value]="type()" (selectionChange)="type.set($event.value); status.set(''); reload()"><mat-option value="">Tous</mat-option>@for (k of kinds(); track k) {<mat-option [value]="k">{{ label[k] }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (s of statuses(); track s) {<mat-option [value]="s">{{ docStatus[s] }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date"><mat-label>Du</mat-label><input matInput type="date" [value]="from()" (change)="from.set($any($event.target).value); reload()" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date"><mat-label>Au</mat-label><input matInput type="date" [value]="to()" (change)="to.set($any($event.target).value); reload()" /></mat-form-field>
      </div>
      @if (loading() && !rows().length) {<app-skeleton />}
      @else if (!rows().length) {<app-empty-state icon="receipt_long" [message]="kinds().length ? 'Aucune transaction ne correspond aux critères.' : 'Votre rôle ne donne accès à aucun type de document.'" />}
      @else {
        <div class="table-wrap"><table mat-table class="responsive" [dataSource]="rows()">
          <ng-container matColumnDef="ref"><th mat-header-cell *matHeaderCellDef>Référence</th><td mat-cell *matCellDef="let r" data-label="Référence"><a [routerLink]="[r.webPath]"><strong>{{ r.number ?? '(brouillon)' }}</strong></a>@if (r.externalRef) {<br><span class="muted small">{{ r.externalRef }}</span>}</td></ng-container>
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type</th><td mat-cell *matCellDef="let r" data-label="Type"><span class="kind"><app-icon [name]="icon[r.kind]" />{{ label[r.kind] }}</span></td></ng-container>
          <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let r" data-label="Date">{{ r.date | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
          <ng-container matColumnDef="ht"><th mat-header-cell *matHeaderCellDef class="r">Montant HT</th><td mat-cell *matCellDef="let r" class="r" data-label="Montant HT">{{ r.totalHtMinor === null ? '—' : (r.totalHtMinor | money) }}</td></ng-container>
          <ng-container matColumnDef="ttc"><th mat-header-cell *matHeaderCellDef class="r">Montant TTC</th><td mat-cell *matCellDef="let r" class="r" data-label="Montant TTC"><strong>{{ r.totalTtcMinor === null ? '—' : (r.totalTtcMinor | money) }}</strong></td></ng-container>
          <ng-container matColumnDef="currency"><th mat-header-cell *matHeaderCellDef>Devise</th><td mat-cell *matCellDef="let r" data-label="Devise">{{ r.currency }}@if (r.foreignMinor !== null) {<br><span class="muted small">{{ foreign(r) | number: '1.2-3' : 'fr' }} {{ r.currency }}</span>}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let r" data-label="Statut"><span class="chip {{ st(r).chip }}">{{ st(r).label }}</span></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr">Actions</span></th><td mat-cell *matCellDef="let r" class="r">
            <a mat-icon-button [routerLink]="[r.webPath]" [attr.aria-label]="'Consulter ' + (r.number ?? 'le document')" title="Consulter"><app-icon name="visibility" /></a></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
        </table></div>
      }
      <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
    </div>
    <p class="muted small note">Les montants HT / TTC sont en devise de base. Dossiers d’importation : montant dans la devise d’origine et contre-valeur au taux réel du dossier.</p>`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.acts{display:flex;gap:8px;flex-wrap:wrap}.kind{display:inline-flex;gap:6px;align-items:center;color:var(--text-2);white-space:nowrap}.date{width:150px!important}.sr{position:absolute;width:1px;height:1px;overflow:hidden}.small{font-size:12px}.note{margin-top:10px}`,
})
export class TabTransactions {
  c = input.required<SupplierDto>(); allowed = input<SupplierTxKind[]>([]);
  private svc = inject(SupplierService); private toast = inject(ToastService); private destroy = inject(DestroyRef); private actions = inject(SupplierActions); private ref = inject(ReferenceDataService);
  cols = ['ref', 'type', 'date', 'ht', 'ttc', 'currency', 'status', 'actions']; label: Record<string, string> = TX_LABEL; icon: Record<string, string> = TX_ICON; docStatus = TX_STATUS; st = supplierTxStatus;
  private byKind: Record<SupplierTxKind, string[]> = { purchase_order: ['draft', 'confirmed', 'partially_received', 'received', 'cancelled'], goods_receipt: ['draft', 'validated'], purchase_invoice: ['draft', 'validated', 'unpaid', 'partial', 'paid'], import_file: ['draft', 'ordered', 'shipped', 'customs', 'arrived', 'closed', 'integrated', 'cancelled'] };
  rows = signal<SupplierTx[]>([]); total = signal(0); loading = signal(true); page = signal(0); pageSize = signal(20); kinds = signal<SupplierTxKind[]>([]);
  type = signal<SupplierTxKind | ''>(''); status = signal(''); from = signal(''); to = signal(''); q = new FormControl('', { nonNullable: true }); private term = signal('');
  statuses = computed(() => { const t = this.type(); return [...new Set((t ? [t] : this.kinds()).flatMap((k) => this.byKind[k]))]; });
  exportParams = computed(() => ({ q: this.term() || undefined, type: this.type() || undefined, status: this.status() || undefined, from: this.from() || undefined, to: this.to() || undefined }));
  order = computed(() => this.actions.newOrder(this.c()));
  foreign = (r: SupplierTx) => (r.foreignMinor ?? 0) / 10 ** this.ref.decimalsOf(r.currency);
  constructor() {
    this.q.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe((v) => { this.term.set(v); this.reload(); });
    effect(() => { this.kinds.set(this.allowed()); });
  }
  ngOnInit() { this.load(); }
  reload() { this.page.set(0); this.load(); }
  private pending: Subscription | undefined;
  load() {
    this.loading.set(true); this.pending?.unsubscribe();
    this.pending = this.svc.transactions(this.c().id, { page: this.page() + 1, limit: this.pageSize(), type: this.type(), status: this.status(), from: this.from(), to: this.to(), q: this.q.value }).subscribe({
      next: (r) => { this.rows.set(r.items); this.total.set(r.total); this.kinds.set(r.allowedKinds); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
}
