import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { Icon } from '../../shared/components/icon';
import { PageHeader } from '../../shared/components/page-header';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ProductDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ProductActions } from './product-actions.service';
import { ProductThumb } from './product-thumb';
import { SupplierPicker } from './supplier-picker';
import { STATUS_CHIP } from './product.labels';
import { SupplierRef } from './product-form.model';
import { ProductService } from './product.service';

type Col = 'photo' | 'reference' | 'name' | 'category' | 'brand' | 'model' | 'unit' | 'purchase' | 'sale' | 'margin' | 'vat' | 'stock' | 'status' | 'actions';
const LABELS: Record<Col, string> = { photo: 'Photo', reference: 'Code article', name: 'Désignation', category: 'Catégorie', brand: 'Marque', model: 'Modèle', unit: 'Unité de vente', purchase: 'Prix d’achat HT', sale: 'Prix de vente HT', margin: 'Marge', vat: 'TVA', stock: 'Stock disponible', status: 'Statut', actions: 'Actions' };
const OPTIONAL: Col[] = ['photo', 'category', 'brand', 'model', 'unit', 'purchase', 'sale', 'margin', 'vat', 'stock'];
const DEFAULT_VISIBLE: Col[] = ['photo', 'category', 'brand', 'purchase', 'sale', 'margin', 'vat', 'stock'];
const STORE = 'machimex.products.columns';
const load = (): Col[] => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Col[] | null; if (Array.isArray(v)) return v.filter((c) => OPTIONAL.includes(c)); } catch { /* stockage indisponible */ } return DEFAULT_VISIBLE; };

@Component({
  selector: 'app-product-list',
  imports: [ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, Icon, MatMenuModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatSelectModule,
    MatSlideToggleModule, PageHeader, EmptyState, Skeleton, ExportMenu, HasPermissionDirective, MoneyPipe, RowActions, ProductThumb, SupplierPicker],
  template: `
    <div class="page">
      <app-page-header title="Produits / Articles" subtitle="Catalogue des machines, équipements, pièces et services">
        <a mat-stroked-button routerLink="catalog"><app-icon name="category" />Catégories & unités</a>
        <a mat-stroked-button routerLink="import" *appHasPermission="'products:create'"><app-icon name="upload" />Importer</a>
        <app-export-menu path="/products/export" [params]="exportParams()" />
        <a mat-flat-button color="primary" routerLink="new" *appHasPermission="'products:create'"><app-icon name="add" />Nouvel article</a>
      </app-page-header>
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" placeholder="Code, désignation, marque, modèle, fournisseur…" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Catégorie</mat-label>
            <mat-select [value]="categoryId()" (selectionChange)="categoryId.set($event.value); reload()"><mat-option value="">Toutes</mat-option>@for (c of cats(); track c.id) {<mat-option [value]="c.id">{{ c.label }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Type</mat-label>
            <mat-select [value]="kind()" (selectionChange)="kind.set($event.value); reload()"><mat-option value="">Tous</mat-option><mat-option value="product">Produits</mat-option><mat-option value="service">Services</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="open">Tous (hors archivés)</mat-option><mat-option value="active">Actifs</mat-option><mat-option value="inactive">Inactifs</mat-option><mat-option value="blocked">Bloqués</mat-option><mat-option value="archived">Archivés</mat-option><mat-option value="all">Tous, archivés inclus</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Marque</mat-label>
            <mat-select [value]="brand()" (selectionChange)="brand.set($event.value); reload()"><mat-option value="">Toutes</mat-option>@for (b of brands(); track b) {<mat-option [value]="b">{{ b }}</mat-option>}</mat-select></mat-form-field>
          <app-supplier-picker class="sup" [control]="supplier" label="Fournisseur" />
          @if (auth.has('inventory:view')) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Entrepôt</mat-label>
              <mat-select [value]="warehouseId()" (selectionChange)="warehouseId.set($event.value); reload()"><mat-option value="">Tous les entrepôts</mat-option>@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Niveau de stock</mat-label>
              <mat-select [value]="stockState()" (selectionChange)="stockState.set($event.value); reload()"><mat-option value="">Tous</mat-option><mat-option value="out">En rupture</mat-option><mat-option value="below_min">Sous le stock minimum</mat-option></mat-select></mat-form-field>
          }
          @if (auth.has('costCalculation:view')) {<mat-slide-toggle [checked]="belowCost()" (change)="belowCost.set($event.checked); reload()">Vendus sous le coût</mat-slide-toggle>}
          <span class="spacer"></span>
          <button mat-stroked-button type="button" [matMenuTriggerFor]="colmenu" aria-label="Choisir les colonnes visibles"><app-icon name="table_view" />Colonnes</button>
          <mat-menu #colmenu="matMenu"><div class="cols" (click)="$event.stopPropagation()">@for (c of optional; track c) {@if (allowed(c)) {<mat-checkbox [checked]="visible().includes(c)" (change)="toggleCol(c, $event.checked)">{{ labels[c] }}</mat-checkbox>}}
            <button mat-button type="button" (click)="resetCols()">Réinitialiser</button></div></mat-menu>
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="inventory_2" message="Aucun article ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table class="responsive compact" [dataSource]="items()" matSort (matSortChange)="onSort($event)">
            <ng-container matColumnDef="photo"><th mat-header-cell *matHeaderCellDef><span class="sr">Photo</span></th><td mat-cell *matCellDef="let p" data-label="Photo"><app-product-thumb [productId]="p.id" [photoId]="p.mainPhotoId" [kind]="p.kind" [alt]="p.name" [size]="40" /></td></ng-container>
            <ng-container matColumnDef="reference"><th mat-header-cell *matHeaderCellDef mat-sort-header="reference">Code article</th><td mat-cell *matCellDef="let p" data-label="Code"><a [routerLink]="[p.id]" class="code">{{ p.reference }}</a></td></ng-container>
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef mat-sort-header="name">Désignation</th><td mat-cell *matCellDef="let p" data-label="Désignation"><a [routerLink]="[p.id]" class="lnk"><strong>{{ p.name }}</strong></a>@if (p.kind === 'service') {<span class="chip off">Service</span>}</td></ng-container>
            <ng-container matColumnDef="category"><th mat-header-cell *matHeaderCellDef>Catégorie</th><td mat-cell *matCellDef="let p" data-label="Catégorie">{{ p.familyName ?? '—' }}@if (p.subName) {<br><span class="muted">{{ p.subName }}</span>}</td></ng-container>
            <ng-container matColumnDef="brand"><th mat-header-cell *matHeaderCellDef mat-sort-header="brand">Marque</th><td mat-cell *matCellDef="let p" data-label="Marque">{{ p.brand ?? '—' }}</td></ng-container>
            <ng-container matColumnDef="model"><th mat-header-cell *matHeaderCellDef mat-sort-header="model">Modèle</th><td mat-cell *matCellDef="let p" data-label="Modèle">{{ p.model ?? '—' }}</td></ng-container>
            <ng-container matColumnDef="unit"><th mat-header-cell *matHeaderCellDef>Unité</th><td mat-cell *matCellDef="let p" data-label="Unité">{{ p.unitName ?? p.unitCode }}</td></ng-container>
            <ng-container matColumnDef="purchase"><th mat-header-cell *matHeaderCellDef mat-sort-header="purchasePriceMinor" class="r">Prix d’achat HT</th><td mat-cell *matCellDef="let p" class="r" data-label="Prix d’achat HT">@if (p.purchasePriceMinor !== null) {{{ p.purchasePriceMinor | money }}@if (p.purchaseCurrency) {<br><span class="muted small">{{ foreignText(p) }}</span>}} @else {—}</td></ng-container>
            <ng-container matColumnDef="sale"><th mat-header-cell *matHeaderCellDef mat-sort-header="salePriceMinor" class="r">Prix de vente HT</th>
              <td mat-cell *matCellDef="let p" class="r" data-label="Prix de vente HT" [style.color]="p.belowCost ? 'var(--danger)' : null">{{ p.salePriceMinor | money }}@if (p.belowCost) {<app-icon class="ico" name="warning" title="Prix de vente inférieur au coût de revient" />}</td></ng-container>
            <ng-container matColumnDef="margin"><th mat-header-cell *matHeaderCellDef class="r">Marge</th><td mat-cell *matCellDef="let p" class="r" data-label="Marge">@if (p.marginMinor !== null) {{{ p.marginMinor | money }}@if (p.marginRatePct !== null) {<br><span class="muted small">{{ p.marginRatePct }} %</span>}} @else {—}</td></ng-container>
            <ng-container matColumnDef="vat"><th mat-header-cell *matHeaderCellDef>TVA</th><td mat-cell *matCellDef="let p" data-label="TVA">{{ p.vatRatePct === null ? p.vatRateCode : p.vatRatePct + ' %' }}</td></ng-container>
            <ng-container matColumnDef="stock"><th mat-header-cell *matHeaderCellDef class="r">Stock disponible</th><td mat-cell *matCellDef="let p" class="r" data-label="Stock">@if (p.kind === 'service') {—} @else {<strong [class.neg]="(p.stockQty ?? 0) <= 0" [class.low]="p.stockQty > 0 && p.stockQty < p.minStock">{{ p.stockQty ?? '—' }}</strong>}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef mat-sort-header="status">Statut</th><td mat-cell *matCellDef="let p" data-label="Statut"><span class="chip {{ chip[p.status] }}">{{ p.statusLabel }}</span></td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr">Actions</span></th><td mat-cell *matCellDef="let p" class="r act" (click)="$event.stopPropagation()"><app-row-actions [actions]="actionsOf(p)" /></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols()"></tr><tr mat-row *matRowDef="let r; columns: cols()" class="row" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `td.r,td[data-label=TVA],td[data-label=Statut]{white-space:nowrap}.row{cursor:pointer}.code{font-weight:600;color:var(--brand);text-decoration:none;white-space:nowrap}.lnk{color:inherit;text-decoration:none}table.compact th,table.compact td{padding:0 8px!important}table.compact th.mat-mdc-header-cell{font-size:11px}
    .sr{position:absolute;width:1px;height:1px;overflow:hidden}.ico{font-size:16px;vertical-align:middle;margin-left:4px}.small{font-size:12px}.act{width:56px}.neg{color:var(--danger)}.low{color:var(--accent-ink,#8a6400)}
    .sup{display:block;width:240px}.cols{display:flex;flex-direction:column;padding:8px 14px;min-width:200px}.chip+.chip{margin-left:6px}td[data-label="Désignation"]{min-width:180px}
    @media (max-width:900px){.sup{width:100%}}`,
})
export class ProductList {
  private svc = inject(ProductService); private toast = inject(ToastService); private router = inject(Router); private destroy = inject(DestroyRef); private http = inject(HttpClient); private actions = inject(ProductActions);
  auth = inject(AuthService); private ref = inject(ReferenceDataService);
  foreignText = (p: ProductDto) => { const d = this.ref.decimalsOf(p.purchaseCurrency ?? ''); return `${((p.purchasePriceForeignMinor ?? 0) / 10 ** d).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} ${p.purchaseCurrency}`; };
  labels = LABELS; optional = OPTIONAL; chip = STATUS_CHIP;
  visible = signal<Col[]>(load());
  access = { purchase: ['costCalculation:view', 'purchases:view', 'imports:view'].some((p) => this.auth.has(p)), cost: this.auth.has('costCalculation:view'), stock: this.auth.has('inventory:view') };
  allowed = (c: Col) => (c === 'purchase' ? this.access.purchase : c === 'margin' ? this.access.cost : c === 'stock' ? this.access.stock : true);
  cols = computed<Col[]>(() => ([...(['reference', 'name'] as Col[]), ...OPTIONAL.filter((c) => this.visible().includes(c) && this.allowed(c))] as Col[]).sort((a, b) => order(a) - order(b)).concat(['status', 'actions'] as Col[]));
  items = signal<ProductDto[]>([]); total = signal(0); loading = signal(true); cats = signal<{ id: string; label: string }[]>([]); brands = signal<string[]>([]); warehouses = signal<{ id: string; code: string; name: string }[]>([]);
  page = signal(0); pageSize = signal(20); categoryId = signal(''); kind = signal(''); status = signal('open'); brand = signal(''); warehouseId = signal(''); stockState = signal(''); belowCost = signal(false); sort = signal<string | undefined>(undefined);
  supplier = new FormControl<SupplierRef | null>(null); search = new FormControl('', { nonNullable: true });
  exportParams = computed(() => ({ q: this.search.value, categoryId: this.categoryId(), kind: this.kind(), status: this.status(), brand: this.brand(), supplierId: this.supplier.value?.id, warehouseId: this.warehouseId(), stockState: this.stockState(), belowCost: this.belowCost() || undefined, sort: this.sort() }));

  constructor() {
    this.svc.categories().subscribe((c) => this.cats.set(c.map((x) => ({ id: x.id, label: x.parentId ? `${c.find((y) => y.id === x.parentId)?.name ?? '?'} › ${x.name}` : x.name })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))));
    this.svc.brands().subscribe({ next: (b) => this.brands.set(b), error: () => undefined });
    if (this.auth.has('inventory:view')) this.http.get<{ id: string; code: string; name: string }[]>(`${environment.apiUrl}/warehouses`).subscribe({ next: (w) => this.warehouses.set(w), error: () => undefined });
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.supplier.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.load();
  }
  toggleCol(c: Col, on: boolean) { const v = on ? [...this.visible(), c] : this.visible().filter((x) => x !== c); this.visible.set(v); try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* ignoré */ } }
  resetCols() { this.visible.set(DEFAULT_VISIBLE); try { localStorage.removeItem(STORE); } catch { /* ignoré */ } }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    this.svc.list({ page: this.page() + 1, limit: this.pageSize(), q: this.search.value, categoryId: this.categoryId(), kind: this.kind(), status: this.status(), brand: this.brand(), supplierId: this.supplier.value?.id, warehouseId: this.warehouseId(), stockState: this.stockState(), belowCost: this.belowCost(), sort: this.sort() }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  onSort(s: Sort) { this.sort.set(s.direction ? (s.direction === 'desc' ? '-' : '') + s.active : undefined); this.reload(); }
  open(p: ProductDto) { this.router.navigate(['/products', p.id]); }

  actionsOf(p: ProductDto): RowAction[] {
    const can = (x: string) => this.auth.has(x); const editable = p.status !== 'archived';
    return [
      { label: 'Consulter la fiche article', icon: 'visibility', link: ['/products', p.id] },
      { label: 'Modifier', icon: 'edit', link: ['/products', p.id, 'edit'], hidden: !can('products:update') || !editable },
      { label: 'Dupliquer', icon: 'content_copy', hidden: !can('products:create'), run: () => this.actions.duplicate(p) },
      { label: 'Imprimer la fiche', icon: 'print', run: () => this.actions.print(p) },
      { label: 'Consulter le stock', icon: 'warehouse', link: ['/products', p.id], query: { tab: 'stock' }, hidden: !can('inventory:view') || p.kind === 'service' },
      { label: 'Consulter les transactions', icon: 'receipt_long', link: ['/products', p.id], query: { tab: 'transactions' } },
      { label: 'Consulter les documents', icon: 'folder', link: ['/products', p.id], query: { tab: 'documents' } },
      ...this.actions.statusActions(p).map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, run: () => this.actions.changeStatus(p, a).subscribe({ next: (u) => u && this.load(), error: (e) => this.toast.error(errorMessage(e)) }) })),
      { label: 'Supprimer', icon: 'delete', danger: true, hidden: !can('products:delete'), run: () => this.actions.remove(p).subscribe({ next: (ok) => ok && this.load(), error: (e) => this.toast.error(errorMessage(e)) }) },
    ];
  }
}
const ORDER: Col[] = ['photo', 'reference', 'name', 'category', 'brand', 'model', 'unit', 'purchase', 'sale', 'margin', 'vat', 'stock', 'status', 'actions'];
const order = (c: Col) => ORDER.indexOf(c);
