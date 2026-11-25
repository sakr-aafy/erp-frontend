import { DatePipe } from '@angular/common';
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
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { DownloadService } from '../../../core/services/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { Customer2 } from '../../../shared/models/api.models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { DOC_STATUS, KIND_ICON, KIND_LABEL, txStatus } from '../customer.labels';
import { CustomerService } from '../customer.service';
import { DocKind, TxRow } from '../customer.types';

/** Onglet Transactions : lit les documents réels des modules Devis, Proforma, Factures, Avoirs et Bons de livraison. */
@Component({
  selector: 'app-tab-transactions',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon, EmptyState, Skeleton, MoneyPipe],
  template: `
    <div class="top"><h2>Historique commercial</h2>
      @if (canQuote()) {<a mat-flat-button color="primary" [routerLink]="['/quotations', 'new']" [queryParams]="{ customerId: c().id }"><app-icon name="add" />Nouveau devis</a>}</div>
    <div class="card">
      <div class="toolbar-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Référence</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="q" placeholder="DEV-2026-…" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Type de document</mat-label>
          <mat-select [value]="type()" (selectionChange)="type.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (k of kinds(); track k) {<mat-option [value]="k">{{ label[k] }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (s of statuses; track s) {<mat-option [value]="s">{{ docStatus[s] }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date"><mat-label>Du</mat-label><input matInput type="date" [value]="from()" (change)="from.set($any($event.target).value); reload()" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date"><mat-label>Au</mat-label><input matInput type="date" [value]="to()" (change)="to.set($any($event.target).value); reload()" /></mat-form-field>
      </div>
      @if (loading() && !rows().length) {<app-skeleton />}
      @else if (!rows().length) {<app-empty-state icon="receipt_long" [message]="kinds().length ? 'Aucune transaction ne correspond aux critères.' : 'Votre rôle ne donne accès à aucun type de document.'" />}
      @else {
        <div class="table-wrap"><table mat-table class="responsive" [dataSource]="rows()">
          <ng-container matColumnDef="ref"><th mat-header-cell *matHeaderCellDef>Référence</th><td mat-cell *matCellDef="let r" data-label="Référence"><a [routerLink]="[r.webPath]"><strong>{{ r.number ?? '(brouillon)' }}</strong></a></td></ng-container>
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type</th><td mat-cell *matCellDef="let r" data-label="Type"><span class="kind"><app-icon [name]="icon[r.kind]" />{{ label[r.kind] }}</span></td></ng-container>
          <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let r" data-label="Date">{{ r.date | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
          <ng-container matColumnDef="ht"><th mat-header-cell *matHeaderCellDef class="r">Montant HT</th><td mat-cell *matCellDef="let r" class="r" data-label="Montant HT">{{ r.totalHtMinor === null ? '—' : (r.totalHtMinor | money) }}</td></ng-container>
          <ng-container matColumnDef="ttc"><th mat-header-cell *matHeaderCellDef class="r">Montant TTC</th><td mat-cell *matCellDef="let r" class="r" data-label="Montant TTC"><strong>{{ r.totalTtcMinor === null ? '—' : (r.totalTtcMinor | money) }}</strong></td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let r" data-label="Statut"><span class="chip {{ st(r).chip }}">{{ st(r).label }}</span></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr">Actions</span></th><td mat-cell *matCellDef="let r" class="r">
            <a mat-icon-button [routerLink]="[r.webPath]" aria-label="Consulter" title="Consulter"><app-icon name="visibility" /></a>
            <button mat-icon-button type="button" (click)="pdf(r)" aria-label="Télécharger le PDF" title="PDF"><app-icon name="picture_as_pdf" /></button></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
        </table></div>
      }
      <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
    </div>`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.kind{display:inline-flex;gap:6px;align-items:center;color:var(--text-2);white-space:nowrap}.date{width:150px!important}.sr{position:absolute;width:1px;height:1px;overflow:hidden}`,
})
export class TabTransactions {
  c = input.required<Customer2>(); allowed = input<DocKind[]>([]);
  private svc = inject(CustomerService); private toast = inject(ToastService); private dl = inject(DownloadService); private auth = inject(AuthService); private destroy = inject(DestroyRef);
  cols = ['ref', 'type', 'date', 'ht', 'ttc', 'status', 'actions']; label = KIND_LABEL; icon = KIND_ICON; docStatus = DOC_STATUS;
  statuses = ['pending', 'accepted', 'refused', 'expired', 'converted', 'cancelled', 'draft', 'validated', 'unpaid', 'partial', 'paid'];
  rows = signal<TxRow[]>([]); total = signal(0); loading = signal(true); page = signal(0); pageSize = signal(20);
  kinds = signal<DocKind[]>([]);
  type = signal<DocKind | ''>(''); status = signal(''); from = signal(''); to = signal(''); q = new FormControl('', { nonNullable: true });
  canQuote = computed(() => this.auth.has('quotations:create') && this.c().canSell);
  st = txStatus;
  constructor() {
    this.q.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    effect(() => { this.kinds.set(this.allowed()); });
  }
  ngOnInit() { this.load(); }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    this.svc.transactions(this.c().id, { page: this.page() + 1, limit: this.pageSize(), type: this.type(), status: this.status(), from: this.from(), to: this.to(), q: this.q.value }).subscribe({
      next: (r) => { this.rows.set(r.items); this.total.set(r.total); this.kinds.set(r.allowedKinds); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  pdf(r: TxRow) { this.dl.openPdf(r.pdfPath).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
}
