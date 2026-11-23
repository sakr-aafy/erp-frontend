import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ProductDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { prompt } from '../../shared/components/prompt-dialog';
import { ProductService, categoryOptions } from './product.service';

@Component({
  selector: 'app-product-list',
  imports: [ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, Icon, MatMenuModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, PageHeader, EmptyState, Skeleton, ExportMenu, HasPermissionDirective, MoneyPipe],
  template: `
    <div class="page">
      <app-page-header title="Produits / Articles" subtitle="Catalogue des produits et services">
        <a mat-stroked-button routerLink="catalog"><app-icon name="category" />Catégories & unités</a>
        <a mat-stroked-button routerLink="import" *appHasPermission="'products:create'"><app-icon name="upload" />Importer</a>
        <app-export-menu path="/products/export" [params]="exportParams()" />
        <a mat-flat-button color="primary" routerLink="new" *appHasPermission="'products:create'"><app-icon name="add" />Nouvel article</a>
      </app-page-header>
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" placeholder="Référence, désignation…" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Catégorie</mat-label>
            <mat-select [value]="categoryId()" (selectionChange)="categoryId.set($event.value); reload()"><mat-option value="">Toutes</mat-option>@for (c of cats(); track c.id) {<mat-option [value]="c.id">{{ c.label }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Type</mat-label>
            <mat-select [value]="kind()" (selectionChange)="kind.set($event.value); reload()"><mat-option value="">Tous</mat-option><mat-option value="product">Produits</mat-option><mat-option value="service">Services</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="active()" (selectionChange)="active.set($event.value); reload()"><mat-option value="all">Tous</mat-option><mat-option value="true">Actifs</mat-option><mat-option value="false">Désactivés</mat-option></mat-select></mat-form-field>
          <mat-slide-toggle [checked]="belowCost()" (change)="belowCost.set($event.checked); reload()">Vendus sous le coût</mat-slide-toggle>
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="inventory_2" message="Aucun article ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table [dataSource]="items()" matSort (matSortChange)="onSort($event)">
            <ng-container matColumnDef="reference"><th mat-header-cell *matHeaderCellDef mat-sort-header="reference">Référence</th><td mat-cell *matCellDef="let p"><strong>{{ p.reference }}</strong></td></ng-container>
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef mat-sort-header="name">Désignation</th><td mat-cell *matCellDef="let p">{{ p.name }}<br><span class="muted">{{ p.categoryName }}{{ p.kind === 'service' ? ' · Service' : '' }}</span></td></ng-container>
            <ng-container matColumnDef="unit"><th mat-header-cell *matHeaderCellDef>Unité</th><td mat-cell *matCellDef="let p">{{ p.unitCode }}</td></ng-container>
            <ng-container matColumnDef="purchase"><th mat-header-cell *matHeaderCellDef mat-sort-header="purchasePriceMinor">Prix d’achat</th><td mat-cell *matCellDef="let p">{{ p.purchasePriceMinor | money }}</td></ng-container>
            <ng-container matColumnDef="sale"><th mat-header-cell *matHeaderCellDef mat-sort-header="salePriceMinor">Prix de vente</th>
              <td mat-cell *matCellDef="let p" [style.color]="p.belowCost ? 'var(--danger)' : null">{{ p.salePriceMinor | money }}@if (p.belowCost) {<app-icon style="font-size:16px;vertical-align:middle" title="Prix de vente inférieur au coût de revient" name="warning" />}</td></ng-container>
            <ng-container matColumnDef="margin"><th mat-header-cell *matHeaderCellDef>Marge</th><td mat-cell *matCellDef="let p">{{ p.marginMinor | money }}</td></ng-container>
            <ng-container matColumnDef="vat"><th mat-header-cell *matHeaderCellDef>TVA</th><td mat-cell *matCellDef="let p">{{ p.vatRateCode }}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let p"><span class="chip" [class.ok]="p.isActive" [class.off]="!p.isActive">{{ p.isActive ? 'Actif' : 'Désactivé' }}</span></td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let p">
              <button mat-icon-button [matMenuTriggerFor]="m" aria-label="Actions" (click)="$event.stopPropagation()"><app-icon name="more_vert" /></button>
              <mat-menu #m="matMenu">
                <a mat-menu-item [routerLink]="[p.id]"><app-icon name="visibility" />Voir la fiche</a>
                @if (auth.has('products:update')) {<a mat-menu-item [routerLink]="[p.id, 'edit']"><app-icon name="edit" />Modifier</a>
                  <button mat-menu-item (click)="toggle(p)"><app-icon [name]="p.isActive ? 'block' : 'check_circle'" />{{ p.isActive ? 'Désactiver' : 'Réactiver' }}</button>}
                @if (auth.has('products:create')) {<button mat-menu-item (click)="duplicate(p)"><app-icon name="content_copy" />Dupliquer</button>}
              </mat-menu></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols" class="row" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `.row{cursor:pointer}.row:hover{background:var(--brand-50)}`,
})
export class ProductList {
  private svc = inject(ProductService); private toast = inject(ToastService); private router = inject(Router); private dialog = inject(MatDialog); private destroy = inject(DestroyRef);
  auth = inject(AuthService);
  cols = ['reference', 'name', 'unit', 'purchase', 'sale', 'margin', 'vat', 'status', 'actions'];
  items = signal<ProductDto[]>([]); total = signal(0); loading = signal(true); cats = signal<{ id: string; label: string }[]>([]);
  page = signal(0); pageSize = signal(20); categoryId = signal(''); kind = signal(''); active = signal('all'); belowCost = signal(false); sort = signal<string | undefined>(undefined);
  search = new FormControl('', { nonNullable: true });
  exportParams = () => ({ q: this.search.value, categoryId: this.categoryId(), kind: this.kind(), active: this.active(), belowCost: this.belowCost() || undefined });

  constructor() {
    this.svc.categories().subscribe((c) => this.cats.set(categoryOptions(c)));
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.load();
  }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    this.svc.list({ page: this.page() + 1, limit: this.pageSize(), q: this.search.value, categoryId: this.categoryId(), kind: this.kind(), active: this.active(), belowCost: this.belowCost(), sort: this.sort() }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  onSort(s: Sort) { this.sort.set(s.direction ? (s.direction === 'desc' ? '-' : '') + s.active : undefined); this.reload(); }
  open(p: ProductDto) { this.router.navigate(['/products', p.id]); }
  toggle(p: ProductDto) { this.svc.setActive(p.id, !p.isActive).subscribe({ next: () => { this.toast.success(p.isActive ? 'Article désactivé' : 'Article réactivé'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  duplicate(p: ProductDto) {
    prompt(this.dialog, { title: `Dupliquer « ${p.name} »`, label: 'Nouvelle référence (unique)', confirmLabel: 'Dupliquer' }).subscribe((ref) => {
      if (ref) this.svc.duplicate(p.id, ref).subscribe({ next: (n) => { this.toast.success('Article dupliqué'); this.router.navigate(['/products', n.id, 'edit']); }, error: (e) => this.toast.error(errorMessage(e)) });
    });
  }
}
