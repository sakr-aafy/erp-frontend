import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { PageHeader } from '../../../shared/components/page-header';
import { RowAction, RowActions } from '../../../shared/components/row-actions';
import { Skeleton } from '../../../shared/components/skeleton';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { QUOTATION_STATUS_STYLE, SalesDoc, STATUS_LABELS } from '../sales.models';
import { SalesService } from '../sales.service';
import { QuotationActions } from './quotation-actions.service';

const STATUSES = ['pending', 'sent', 'accepted', 'refused', 'expired'];

/** Liste des devis : compteurs réels par statut (cliquables), recherche, filtres, tri et pagination côté serveur. */
@Component({
  selector: 'app-quotation-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon, PageHeader, EmptyState, Skeleton, MoneyPipe, RowActions],
  template: `
    <div class="page">
      <app-page-header title="Devis" subtitle="Création, envoi, suivi des statuts et conversion en proforma ou facture">
        @if (auth.has('reports:view')) {<a mat-stroked-button routerLink="/reports/quotations"><app-icon name="download" />Rapport et export</a>}
        @if (auth.has('quotations:create')) {<a mat-flat-button color="primary" routerLink="new"><app-icon name="add" />Nouveau devis</a>}
      </app-page-header>
      @if (stats(); as s) {
        <div class="counters" role="group" aria-label="Devis par statut">
          @for (k of statuses; track k) {<button type="button" class="counter" [class.on]="status() === k" [attr.aria-pressed]="status() === k" (click)="toggle(k)">
            <span class="chip {{ style[k]!.chip }}"><app-icon [name]="style[k]!.icon" />{{ label(k) }}</span><strong>{{ s[k] }}</strong></button>}
        </div>
        <p class="muted figures">Montant TTC en cours (en attente et envoyés) : <strong>{{ s['openTotalMinor'] | money }}</strong> · Acceptés : <strong>{{ s['acceptedTotalMinor'] | money }}</strong> · Taux de conversion en facture : <strong>{{ s['conversionRatePct'] }} %</strong></p>
      }
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" placeholder="N° de devis ou client" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (s of statuses; track s) {<mat-option [value]="s">{{ label(s) }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date"><mat-label>Du</mat-label><input matInput type="date" [formControl]="from" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date"><mat-label>Au</mat-label><input matInput type="date" [formControl]="to" /></mat-form-field>
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="request_quote" message="Aucun devis ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table class="responsive compact" [dataSource]="items()" matSort (matSortChange)="onSort($event)">
            <ng-container matColumnDef="number"><th mat-header-cell *matHeaderCellDef mat-sort-header="number">Numéro</th><td mat-cell *matCellDef="let d" data-label="Numéro"><a [routerLink]="[d.id]" class="lnk" (click)="$event.stopPropagation()"><strong>{{ d.number }}</strong></a></td></ng-container>
            <ng-container matColumnDef="customer"><th mat-header-cell *matHeaderCellDef mat-sort-header="customer">Client</th><td mat-cell *matCellDef="let d" data-label="Client">{{ d.customer.name }}</td></ng-container>
            <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef mat-sort-header="issueDate">Date de création</th><td mat-cell *matCellDef="let d" data-label="Création">{{ d.issueDate | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="validity"><th mat-header-cell *matHeaderCellDef mat-sort-header="validUntil">Validité</th><td mat-cell *matCellDef="let d" data-label="Validité">{{ d.validUntil | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="ht"><th mat-header-cell *matHeaderCellDef mat-sort-header="totalHtMinor" class="r">Montant HT</th><td mat-cell *matCellDef="let d" class="r" data-label="Montant HT">{{ d.totals.totalHtMinor | money }}</td></ng-container>
            <ng-container matColumnDef="ttc"><th mat-header-cell *matHeaderCellDef mat-sort-header="totalTtcMinor" class="r">Montant TTC</th><td mat-cell *matCellDef="let d" class="r" data-label="Montant TTC"><strong>{{ d.totals.totalTtcMinor | money }}</strong></td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef mat-sort-header="status">Statut</th><td mat-cell *matCellDef="let d" data-label="Statut"><span class="chip status-chip {{ style[d.status]!.chip }}"><app-icon [name]="style[d.status]!.icon" />{{ label(d.status) }}</span></td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr-only">Actions</span></th><td mat-cell *matCellDef="let d" class="r act" (click)="$event.stopPropagation()"><app-row-actions [actions]="actionsOf(d)" /></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols" class="row" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `.counters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:8px}.counter{display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:14px 16px;border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);font:inherit;cursor:pointer;box-shadow:var(--shadow-sm);transition:border-color var(--t-fast)}
    .counter:hover{border-color:var(--brand)}.counter:focus-visible{outline:none;box-shadow:var(--ring)}.counter.on{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}.counter strong{font-size:22px;font-variant-numeric:tabular-nums}.chip::before{display:none}.chip app-icon{--icon-size:.85rem}.figures{font-size:13px;margin:0 0 16px}
    table.compact th,table.compact td{padding:0 8px!important}table.compact th.mat-mdc-header-cell{font-size:11px}.date{max-width:160px!important}.lnk{color:var(--brand);text-decoration:none;white-space:nowrap}.row{cursor:pointer}td.r{white-space:nowrap}.act{width:56px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    @media (max-width:900px){.counters{grid-template-columns:repeat(2,minmax(0,1fr))}}`,
})
export class QuotationList {
  private svc = inject(SalesService); private toast = inject(ToastService); private router = inject(Router); private destroy = inject(DestroyRef); private actions = inject(QuotationActions); auth = inject(AuthService); ref = inject(ReferenceDataService);
  statuses = STATUSES; style = QUOTATION_STATUS_STYLE; label = (s: string) => STATUS_LABELS[s] ?? s;
  cols = ['number', 'customer', 'date', 'validity', 'ht', 'ttc', 'status', 'actions'];
  items = signal<SalesDoc[]>([]); total = signal(0); loading = signal(true); stats = signal<Record<string, number> | null>(null);
  page = signal(0); pageSize = signal(20); status = signal(''); sort = signal<string | undefined>(undefined);
  search = new FormControl('', { nonNullable: true }); from = new FormControl('', { nonNullable: true }); to = new FormControl('', { nonNullable: true });
  private menus = computed(() => new Map(this.items().map((d) => [d.id, this.rowActions(d)])));
  actionsOf = (d: SalesDoc) => this.menus().get(d.id) ?? [];
  ngOnInit() {
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    for (const c of [this.from, this.to]) c.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.refresh();
  }
  refresh() { this.load(); this.svc.stats('quotations').subscribe({ next: (s) => this.stats.set(s), error: () => undefined }); }
  reload() { this.page.set(0); this.load(); }
  toggle(s: string) { this.status.set(this.status() === s ? '' : s); this.reload(); }
  private listing: Subscription | undefined;
  load() {
    this.loading.set(true); this.listing?.unsubscribe();
    this.listing = this.svc.list('quotations', { page: this.page() + 1, limit: this.pageSize(), q: this.search.value, status: this.status(), from: this.from.value, to: this.to.value, sort: this.sort() }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); } });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  onSort(s: Sort) { this.sort.set(s.direction ? (s.direction === 'desc' ? '-' : '') + s.active : undefined); this.reload(); }
  open(d: SalesDoc) { this.router.navigate(['/quotations', d.id]); }
  private rowActions(d: SalesDoc): RowAction[] {
    return [
      { label: 'Consulter', icon: 'visibility', link: ['/quotations', d.id] },
      { label: 'Imprimer (PDF)', icon: 'print', run: () => this.actions.print(d) },
      ...this.actions.list(d, () => this.refresh()).map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, run: a.run })),
      { label: 'Voir l’activité', icon: 'history', link: ['/quotations', d.id], query: { tab: 'activity' } },
    ];
  }
}
