import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
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
import { errorMessage } from '../../../core/services/api';
import { DownloadService } from '../../../core/services/download.service';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { ExportMenu } from '../../../shared/components/export-menu';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { ProductDto } from '../../../shared/models/api.models';
import { PHASE_CHIP, TX_GROUPS } from '../product.labels';
import { ProductService } from '../product.service';
import { TxRow } from '../product.types';

/** Onglet 6 — Transactions : achats, ventes, stock et importations lus automatiquement dans les modules sources (rien n'est copié dans l'article). */
@Component({
  selector: 'app-tab-transactions',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon, EmptyState, Skeleton, ExportMenu],
  template: `
    <div class="top"><div><h2>Transactions de l’article</h2><p class="muted">Cet onglet affiche automatiquement toutes les opérations concernant l’article.</p></div>
      @if (allowed().length) {<app-export-menu [path]="'/products/' + p().id + '/transactions/export'" [params]="exportParams()" />}</div>
    <div class="groups" role="tablist" aria-label="Catégories de transactions">@for (g of groupsOf(); track g.value) {<button type="button" role="tab" class="g" [class.on]="group() === g.value" [attr.aria-selected]="group() === g.value" (click)="setGroup(g.value)">{{ g.label }}</button>}</div>
    <div class="card">
      <div class="toolbar-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Référence</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="q" placeholder="N° de document" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Du</mat-label><input matInput type="date" [value]="from()" (change)="from.set($any($event.target).value); reload()" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Au</mat-label><input matInput type="date" [value]="to()" (change)="to.set($any($event.target).value); reload()" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label><mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (s of statuses; track s.v) {<mat-option [value]="s.v">{{ s.l }}</mat-option>}</mat-select></mat-form-field>
      </div>
      @if (loading() && !rows().length) {<app-skeleton />}
      @else if (!rows().length) {<app-empty-state icon="receipt_long" [message]="allowed().length ? 'Aucune transaction ne correspond aux critères.' : 'Votre rôle ne donne accès à aucun type de transaction.'" />}
      @else {
        <div class="table-wrap"><table mat-table class="responsive compact" [dataSource]="rows()">
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type de transaction</th><td mat-cell *matCellDef="let r" data-label="Type"><strong>{{ r.kindLabel }}</strong></td></ng-container>
          <ng-container matColumnDef="num"><th mat-header-cell *matHeaderCellDef>N° du document</th><td mat-cell *matCellDef="let r" data-label="N°"><a [routerLink]="[r.webPath]" class="code">{{ r.number ?? '(brouillon)' }}</a></td></ng-container>
          <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let r" data-label="Date">{{ r.date | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
          <ng-container matColumnDef="party"><th mat-header-cell *matHeaderCellDef>Client / Fournisseur</th><td mat-cell *matCellDef="let r" data-label="Tiers">{{ r.customer ?? r.supplier ?? '—' }}</td></ng-container>
          <ng-container matColumnDef="qty"><th mat-header-cell *matHeaderCellDef class="r">Quantité</th><td mat-cell *matCellDef="let r" class="r" data-label="Quantité"><span [class.out]="r.direction === 'out'" [class.in]="r.direction === 'in'">{{ r.direction === 'in' ? '+' : '' }}{{ r.quantity ?? '—' }}</span></td></ng-container>
          <ng-container matColumnDef="price"><th mat-header-cell *matHeaderCellDef class="r">Prix unitaire</th><td mat-cell *matCellDef="let r" class="r" data-label="Prix unitaire">{{ r.unitPriceMinor === null ? '—' : amount(r, r.unitPriceMinor) }}</td></ng-container>
          <ng-container matColumnDef="cur"><th mat-header-cell *matHeaderCellDef>Devise</th><td mat-cell *matCellDef="let r" data-label="Devise">{{ r.currency ?? '—' }}</td></ng-container>
          <ng-container matColumnDef="total"><th mat-header-cell *matHeaderCellDef class="r">Total</th><td mat-cell *matCellDef="let r" class="r" data-label="Total"><strong>{{ r.totalMinor === null ? '—' : amount(r, r.totalMinor) }}</strong></td></ng-container>
          <ng-container matColumnDef="wh"><th mat-header-cell *matHeaderCellDef>Entrepôt</th><td mat-cell *matCellDef="let r" data-label="Entrepôt">{{ r.warehouse ?? '—' }}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let r" data-label="Statut"><span class="chip {{ phaseChip[r.phase] }}" [attr.title]="r.statusLabel">{{ r.phase }}</span><br><span class="muted small">{{ r.statusLabel }}</span></td></ng-container>
          <ng-container matColumnDef="act"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr">Actions</span></th><td mat-cell *matCellDef="let r" class="r">
            <a mat-icon-button [routerLink]="[r.webPath]" aria-label="Consulter le document" title="Consulter"><app-icon name="visibility" /></a>
            @if (r.pdfPath) {<button mat-icon-button type="button" (click)="pdf(r)" aria-label="Télécharger le PDF" title="PDF"><app-icon name="picture_as_pdf" /></button>}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
        </table></div>
      }
      <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
    </div>`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}.groups{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.g{padding:6px 16px;border:1px solid var(--border-strong);border-radius:999px;background:var(--surface);font:inherit;font-size:13px;font-weight:500;color:var(--text-2);cursor:pointer}
    .g:hover{border-color:var(--brand);color:var(--brand)}.g:focus-visible{outline:none;box-shadow:var(--ring)}.g.on{background:var(--brand);border-color:var(--brand);color:#fff}.code{font-weight:600;color:var(--brand);text-decoration:none}.small{font-size:12px}.sr{position:absolute;width:1px;height:1px;overflow:hidden}
    table.compact th,table.compact td{padding:0 8px!important}table.compact th.mat-mdc-header-cell{font-size:11px}.out{color:var(--danger)}.in{color:var(--brand)}`,
})
export class TabTransactions {
  p = input.required<ProductDto>();
  private svc = inject(ProductService); private toast = inject(ToastService); private dl = inject(DownloadService); private destroy = inject(DestroyRef); private ref = inject(ReferenceDataService);
  cols = ['type', 'num', 'date', 'party', 'qty', 'price', 'cur', 'total', 'wh', 'status', 'act']; phaseChip = PHASE_CHIP;
  rows = signal<TxRow[]>([]); total = signal(0); loading = signal(true); page = signal(0); pageSize = signal(20); allowed = signal<string[]>([]); allowedGroups = signal<string[]>([]);
  group = signal(''); from = signal(''); to = signal(''); status = signal(''); q = new FormControl('', { nonNullable: true });
  exportParams = () => ({ group: this.group(), status: this.status(), from: this.from(), to: this.to(), q: this.q.value });
  groupsOf = () => TX_GROUPS.filter((g) => !g.value || this.allowedGroups().includes(g.value) || this.allowedGroups().length === 0);
  statuses = [{ v: 'pending', l: 'En attente' }, { v: 'sent', l: 'Envoyé' }, { v: 'confirmed', l: 'Confirmée' }, { v: 'partially_received', l: 'Partiellement reçue' }, { v: 'received', l: 'Reçue' }, { v: 'validated', l: 'Validé' }, { v: 'draft', l: 'Brouillon' }, { v: 'accepted', l: 'Accepté' }, { v: 'cancelled', l: 'Annulé' }];
  amount = (r: TxRow, minor: number) => { const base = this.ref.data()?.baseCurrency; if (r.currency && r.currency !== base) { const d = this.ref.decimalsOf(r.currency); return (minor / 10 ** d).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }); } return this.ref.format(minor); };
  constructor() { this.q.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload()); effect(() => { void this.p(); }); }
  ngOnInit() { this.load(); }
  setGroup(g: string) { this.group.set(g); this.reload(); }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    this.svc.transactions(this.p().id, { page: this.page() + 1, limit: this.pageSize(), group: this.group(), status: this.status(), from: this.from(), to: this.to(), q: this.q.value }).subscribe({
      next: (r) => { this.rows.set(r.items); this.total.set(r.total); this.allowed.set(r.allowedKinds); this.allowedGroups.set(r.groups); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  pdf(r: TxRow) { this.dl.openPdf(r.pdfPath!).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
}
