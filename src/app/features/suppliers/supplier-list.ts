import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { Icon } from '../../shared/components/icon';
import { PageHeader } from '../../shared/components/page-header';
import { PhoneLink } from '../../shared/components/phone-link';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { SupplierCategoryDto, SupplierDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { SupplierActions } from './supplier-actions.service';
import { SupplierSearch, SupplierSearchValue } from './supplier-search';
import { FINANCE_PERMISSIONS, SUPPLIER_STATUS_CHIP, SUPPLIER_STATUS_LABEL } from './supplier.labels';
import { SupplierService } from './supplier.service';

@Component({
  selector: 'app-supplier-list',
  imports: [RouterLink, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, Icon, MatFormFieldModule, MatSelectModule, MatSlideToggleModule,
    PageHeader, EmptyState, Skeleton, ExportMenu, HasPermissionDirective, MoneyPipe, RowActions, PhoneLink, SupplierSearch],
  template: `
    <div class="page">
      <app-page-header title="Fournisseurs" subtitle="Fiches fournisseurs, catégories, conditions d’achat, soldes et seuils de blocage">
        <a mat-stroked-button routerLink="categories"><app-icon name="category" />Catégories de fournisseurs</a>
        <app-export-menu *appHasPermission="'suppliers:view'" path="/suppliers/export" [params]="exportParams()" />
        <a mat-flat-button color="primary" routerLink="new" *appHasPermission="'suppliers:create'"><app-icon name="add" />Nouveau fournisseur</a>
      </app-page-header>
      <div class="card">
        <div class="toolbar-row">
          <app-supplier-search class="search" [filters]="suggestFilters()" (changed)="onSearch($event)" />
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Catégorie</mat-label>
            <mat-select [value]="categoryId()" (selectionChange)="categoryId.set($event.value); reload()"><mat-option value="">Toutes les catégories</mat-option>@for (c of categories(); track c.id) {<mat-option [value]="c.id">{{ c.name }}@if (!c.isActive) { (désactivée)}</mat-option>}<mat-option value="none">Non classés</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="open">Tous (hors archivés)</mat-option><mat-option value="active">Actifs</mat-option><mat-option value="inactive">Inactifs</mat-option>
              <mat-option value="blocked">Bloqués</mat-option><mat-option value="archived">Archivés</mat-option><mat-option value="all">Tous, archivés inclus</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Pays</mat-label>
            <mat-select [value]="country()" (selectionChange)="country.set($event.value); reload()"><mat-option value="">Tous les pays</mat-option>@for (c of countries(); track c) {<mat-option [value]="c">{{ c }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Origine</mat-label>
            <mat-select [value]="foreign()" (selectionChange)="foreign.set($event.value); reload()"><mat-option value="">Locaux et étrangers</mat-option><mat-option value="false">Locaux</mat-option><mat-option value="true">Étrangers</mat-option></mat-select></mat-form-field>
          @if (amounts) {<mat-slide-toggle [checked]="withBalance()" (change)="withBalance.set($event.checked); reload()">Solde à payer</mat-slide-toggle>}
          <span class="spacer"></span>
          @if (summary() !== null) {<span class="muted">Total des soldes : <strong>{{ summary() | money }}</strong></span>}
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="local_shipping" message="Aucun fournisseur ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table class="responsive compact" [dataSource]="items()" matSort (matSortChange)="onSort($event)">
            <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef mat-sort-header="code">Code</th><td mat-cell *matCellDef="let s" data-label="Code"><span class="code">{{ s.code ?? '—' }}</span></td></ng-container>
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef mat-sort-header="name">Raison sociale</th>
              <td mat-cell *matCellDef="let s" data-label="Fournisseur"><a [routerLink]="[s.id]" class="lnk"><strong>{{ s.name }}</strong></a>@if (s.tradeName) {<br><span class="muted">{{ s.tradeName }}</span>}</td></ng-container>
            <ng-container matColumnDef="category"><th mat-header-cell *matHeaderCellDef>Catégorie</th><td mat-cell *matCellDef="let s" data-label="Catégorie">@if (s.categoryName) {<span class="cat">{{ s.categoryName }}</span>} @else {<span class="muted">Non classé</span>}</td></ng-container>
            <ng-container matColumnDef="taxId"><th mat-header-cell *matHeaderCellDef mat-sort-header="taxId">Matricule fiscal</th><td mat-cell *matCellDef="let s" data-label="Matricule fiscal">{{ s.taxId ?? '—' }}</td></ng-container>
            <ng-container matColumnDef="contact"><th mat-header-cell *matHeaderCellDef>Contact principal</th>
              <td mat-cell *matCellDef="let s" data-label="Contact">
                @if (s.primaryContact; as k) {{{ k.name }}<br>@if (k.phone) {<app-phone class="muted" [info]="k.phoneInfo" [value]="k.phone" />} @else if (s.phone) {<app-phone class="muted" [info]="s.phoneInfo" [value]="s.phone" />} @else {<span class="muted">{{ k.email || s.email }}</span>}}
                @else {@if (s.phone) {<app-phone [info]="s.phoneInfo" [value]="s.phone" />} @else {—}<br><span class="muted">{{ s.email }}</span>}</td></ng-container>
            <ng-container matColumnDef="city"><th mat-header-cell *matHeaderCellDef mat-sort-header="city">Ville</th><td mat-cell *matCellDef="let s" data-label="Ville">{{ s.address.city || '—' }}</td></ng-container>
            <ng-container matColumnDef="country"><th mat-header-cell *matHeaderCellDef mat-sort-header="country">Pays</th><td mat-cell *matCellDef="let s" data-label="Pays">{{ s.address.country || '—' }}@if (s.isForeign) { <span class="chip off">Étranger</span>}</td></ng-container>
            <ng-container matColumnDef="balance"><th mat-header-cell *matHeaderCellDef mat-sort-header="balanceMinor" class="r">Solde</th>
              <td mat-cell *matCellDef="let s" class="r" data-label="Solde" [style.color]="s.ordersBlocked ? 'var(--danger)' : null"><strong>{{ s.balanceMinor | money }}</strong>@if (s.ordersBlocked) {<app-icon class="warn-ico" name="warning" title="Seuil dépassé : commandes bloquées" />}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef mat-sort-header="status">Statut</th><td mat-cell *matCellDef="let s" data-label="Statut"><span class="chip {{ chip[s.status] }}">{{ statusLabel[s.status] }}</span></td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr-only">Actions</span></th><td mat-cell *matCellDef="let s" class="r act" (click)="$event.stopPropagation()"><app-row-actions [actions]="actionsOf(s)" /></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols" class="row" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `.search{flex:1 1 260px;min-width:220px}table.compact th,table.compact td{padding:0 8px!important}table.compact th.mat-mdc-header-cell{font-size:11px}td.r strong{white-space:nowrap}
    @media (min-width:901px){td[data-label=Fournisseur]{min-width:180px;max-width:240px}td[data-label=Contact]{max-width:190px;overflow:hidden;text-overflow:ellipsis}td[data-label=Catégorie]{max-width:180px}}.lnk{color:inherit;text-decoration:none}.row{cursor:pointer}.code{font-weight:600;color:var(--brand);white-space:nowrap}.cat{color:var(--text-2)}
    .warn-ico{font-size:16px;vertical-align:middle;margin-left:4px}.act{width:56px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`,
})
export class SupplierList {
  private svc = inject(SupplierService); private toast = inject(ToastService); private router = inject(Router);
  private actions = inject(SupplierActions); private auth = inject(AuthService);
  amounts = FINANCE_PERMISSIONS.some((p) => this.auth.has(p));
  cols = ['code', 'name', 'category', 'taxId', 'contact', 'city', 'country', ...(this.amounts ? ['balance'] : []), 'status', 'actions'];
  statusLabel = SUPPLIER_STATUS_LABEL; chip = SUPPLIER_STATUS_CHIP;
  items = signal<SupplierDto[]>([]); total = signal(0); loading = signal(true); summary = signal<number | null>(null);
  countries = signal<string[]>([]); categories = signal<SupplierCategoryDto[]>([]);
  page = signal(0); pageSize = signal(20); status = signal('open'); categoryId = signal(''); country = signal(''); foreign = signal(''); withBalance = signal(false); sort = signal<string | undefined>(undefined);
  query = signal(''); supplierId = signal('');
  suggestFilters = computed(() => ({ status: this.status(), categoryId: this.categoryId(), country: this.country(), foreign: this.foreign(), withBalance: this.withBalance() }));
  exportParams = computed(() => ({ q: this.query() || undefined, status: this.status(), categoryId: this.categoryId() || undefined, country: this.country() || undefined, foreign: this.foreign() || undefined, withBalance: this.withBalance() || undefined }));

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap; // « Consulter les fournisseurs » depuis les catégories
    this.categoryId.set(q.get('categoryId') ?? '');
    this.svc.countries().subscribe({ next: (c) => this.countries.set(c), error: () => undefined });
    this.svc.categories().subscribe({ next: (c) => this.categories.set(c.items), error: () => undefined });
    this.load();
  }
  reload() { this.page.set(0); this.load(); }
  onSearch(v: SupplierSearchValue) {
    const id = v.supplier?.id ?? '';
    if (v.q === this.query() && id === this.supplierId()) return;
    this.query.set(v.q); this.supplierId.set(id); this.reload();
  }
  private listing: Subscription | undefined;
  load() {
    this.loading.set(true); this.listing?.unsubscribe();
    this.listing = this.svc.list({ page: this.page() + 1, limit: this.pageSize(), q: this.query(), supplierId: this.supplierId(), status: this.supplierId() ? 'all' : this.status(), categoryId: this.categoryId(), country: this.country(), foreign: this.foreign(), withBalance: this.withBalance(), sort: this.sort() }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.summary.set(r.summary?.totalBalanceMinor ?? null); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  onSort(s: Sort) { this.sort.set(s.direction ? (s.direction === 'desc' ? '-' : '') + s.active : undefined); this.reload(); }
  open(s: SupplierDto) { this.router.navigate(['/suppliers', s.id]); }

  /** Menu « ⋮ » : chaque action n'apparaît que si l'utilisateur a la permission du module concerné et si le statut le permet. */
  actionsOf(s: SupplierDto): RowAction[] {
    const can = (p: string) => this.auth.has(p); const editable = s.status !== 'archived'; const order = this.actions.newOrder(s);
    return [
      { label: 'Consulter la fiche', icon: 'visibility', link: ['/suppliers', s.id] },
      { label: 'Modifier', icon: 'edit', link: ['/suppliers', s.id, 'edit'], hidden: !can('suppliers:update') || !editable },
      { label: 'Imprimer la fiche', icon: 'print', run: () => this.actions.print(s) },
      { label: order?.label ?? 'Nouvelle commande', icon: order?.icon ?? 'shopping_cart', link: order?.link, query: { supplierId: s.id }, hidden: !order },
      { label: 'Consulter les transactions', icon: 'receipt_long', link: ['/suppliers', s.id], query: { tab: 'transactions' }, hidden: !can('purchases:view') && !can('imports:view') },
      { label: 'Consulter les règlements', icon: 'payments', link: ['/suppliers', s.id], query: { tab: 'payments' }, hidden: !this.amounts },
      ...this.actions.statusActions(s).map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, run: () => this.actions.changeStatus(s, a).subscribe({ next: (u) => u && this.load(), error: (e) => this.toast.error(errorMessage(e)) }) })),
      { label: 'Supprimer', icon: 'delete', danger: true, hidden: !can('suppliers:delete'), run: () => this.actions.remove(s).subscribe({ next: (ok) => ok && this.load(), error: (e) => this.toast.error(errorMessage(e)) }) },
    ];
  }
}
