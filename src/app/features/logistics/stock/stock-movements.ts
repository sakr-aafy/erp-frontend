import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../../core/services/api.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { ExportMenu } from '../../../shared/components/export-menu';
import { PageHeader } from '../../../shared/components/page-header';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

const REASONS: Record<string, string> = { receipt: 'Réception', import: 'Importation', delivery: 'Livraison', delivery_cancel: 'Annulation de livraison', transfer_out: 'Transfert (sortie)', transfer_in: 'Transfert (entrée)', inventory_in: 'Inventaire (+)', inventory_out: 'Inventaire (−)', manual_in: 'Entrée manuelle', manual_out: 'Sortie manuelle' };

/** Historique complet des mouvements (par article, magasin, motif, période). Les mouvements sont immuables. */
@Component({
  selector: 'app-stock-movements',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, PageHeader, EmptyState, ExportMenu, MoneyPipe],
  template: `
    <div class="page"><app-page-header title="Mouvements de stock" subtitle="Traçabilité complète : chaque mouvement est immuable et relié à son document (une correction passe par un mouvement inverse)">
        <a mat-stroked-button routerLink="/stock"><app-icon name="arrow_back" />Stock</a><app-export-menu path="/stock/movements/export" [params]="params()" /></app-page-header>
      <div class="card"><div class="toolbar-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Magasin</mat-label><mat-select [value]="warehouseId()" (selectionChange)="warehouseId.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Motif</mat-label><mat-select [value]="reason()" (selectionChange)="reason.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (r of reasons; track r.key) {<mat-option [value]="r.key">{{ r.label }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:160px"><mat-label>Du</mat-label><input matInput type="date" [formControl]="from" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:160px"><mat-label>Au</mat-label><input matInput type="date" [formControl]="to" /></mat-form-field>
        @if (productId()) {<span class="chip ok">Article filtré <a href="javascript:void 0" (click)="clearProduct()" style="margin-left:6px">✕</a></span>}</div>
        @if (!items().length) {<app-empty-state icon="swap_vert" message="Aucun mouvement." />} @else {
        <div class="table-wrap"><table mat-table [dataSource]="items()">
          <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let m">{{ m.at | date: 'dd/MM/yyyy HH:mm' }}</td></ng-container>
          <ng-container matColumnDef="art"><th mat-header-cell *matHeaderCellDef>Article</th><td mat-cell *matCellDef="let m"><strong>{{ m.reference }}</strong><br><span class="muted">{{ m.name }}</span></td></ng-container>
          <ng-container matColumnDef="wh"><th mat-header-cell *matHeaderCellDef>Magasin</th><td mat-cell *matCellDef="let m">{{ m.warehouse }}</td></ng-container>
          <ng-container matColumnDef="reason"><th mat-header-cell *matHeaderCellDef>Motif</th><td mat-cell *matCellDef="let m">{{ label(m.reason) }}@if (m.forced) {<span class="chip off" style="margin-left:4px">Stock négatif autorisé</span>}@if (m.note) {<br><span class="muted">{{ m.note }}</span>}</td></ng-container>
          <ng-container matColumnDef="qty"><th mat-header-cell *matHeaderCellDef style="text-align:right">Quantité</th><td mat-cell *matCellDef="let m" style="text-align:right" [style.color]="m.direction === 'in' ? 'var(--brand)' : 'var(--danger)'"><strong>{{ m.direction === 'in' ? '+' : '−' }}{{ m.quantity }}</strong></td></ng-container>
          <ng-container matColumnDef="after"><th mat-header-cell *matHeaderCellDef style="text-align:right">Stock après</th><td mat-cell *matCellDef="let m" style="text-align:right">{{ m.qtyAfter }}</td></ng-container>
          <ng-container matColumnDef="val"><th mat-header-cell *matHeaderCellDef style="text-align:right">Valeur</th><td mat-cell *matCellDef="let m" style="text-align:right">{{ m.valueMinor | money }}</td></ng-container>
          <ng-container matColumnDef="doc"><th mat-header-cell *matHeaderCellDef>Document</th><td mat-cell *matCellDef="let m">{{ m.source?.number ?? '—' }}@if (m.serials?.length) {<br><span class="muted">{{ m.serials.join(', ') }}</span>}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[20, 50, 100]" (page)="onPage($event)" /></div></div>`,
})
export class StockMovements {
  productIdParam = input<string | undefined>(undefined, { alias: 'productId' });
  private api = inject(Api); private toast = inject(ToastService);
  cols = ['at', 'art', 'wh', 'reason', 'qty', 'after', 'val', 'doc']; items = signal<any[]>([]); total = signal(0); page = signal(0); pageSize = signal(20);  
  warehouses = signal<{ id: string; code: string }[]>([]); warehouseId = signal(''); reason = signal(''); productId = signal(''); from = new FormControl('', { nonNullable: true }); to = new FormControl('', { nonNullable: true });
  reasons = Object.entries(REASONS).map(([key, label]) => ({ key, label })); label = (r: string) => REASONS[r] ?? r;
  params = () => ({ warehouseId: this.warehouseId(), reason: this.reason(), productId: this.productId(), from: this.from.value, to: this.to.value ? `${this.to.value}T23:59:59` : '' });
  ngOnInit() { this.productId.set(this.productIdParam() ?? ''); this.api.get('/warehouses').subscribe((w) => this.warehouses.set(w)); this.from.valueChanges.subscribe(() => this.reload()); this.to.valueChanges.subscribe(() => this.reload()); this.load(); }
  reload() { this.page.set(0); this.load(); } clearProduct() { this.productId.set(''); this.reload(); }
  load() { this.api.get('/stock/movements', { page: this.page() + 1, limit: this.pageSize(), ...this.params() }).subscribe({ next: (r) => { this.items.set(r.items); this.total.set(r.total); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
}
