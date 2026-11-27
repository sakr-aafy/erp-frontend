import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Api } from '../../../core/services/api.service';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { ExportMenu } from '../../../shared/components/export-menu';
import { PageHeader } from '../../../shared/components/page-header';
import { Skeleton } from '../../../shared/components/skeleton';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { DecimalInput } from '../../../shared/directives/decimal-input.directive';
import { quantityError, quantityValidator } from '../../../shared/utils/quantity';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';

const STATUS: Record<string, string> = { ok: 'Normal', low: 'Sous le seuil', out: 'Rupture' };

/** Entrée / sortie manuelle (régularisation) : motif obligatoire, coût en entrée, autorisation explicite du stock négatif. */
@Component({
  selector: 'app-movement-dialog',
  imports: [DecimalInput, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>Mouvement de stock manuel</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="c">
        @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Type</mat-label><mat-select formControlName="direction"><mat-option value="in">Entrée</mat-option><mat-option value="out">Sortie</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Article</mat-label><input matInput [formControl]="productCtrl" [matAutocomplete]="pa" /><mat-autocomplete #pa="matAutocomplete" [displayWith]="show" (optionSelected)="product.set($event.option.value); form.controls.quantity.updateValueAndValidity()">@for (p of products(); track p.id) {<mat-option [value]="p">{{ p.reference }} — {{ p.name }}</mat-option>}</mat-autocomplete></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Magasin</mat-label><mat-select formControlName="warehouseId">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Quantité</mat-label><input matInput appDecimal formControlName="quantity" />@if (form.controls.quantity.invalid) {<mat-error>{{ qtyError(form.controls.quantity) }}</mat-error>}</mat-form-field>
        @if (form.controls.direction.value === 'in') {<mat-form-field appearance="outline"><mat-label>Coût unitaire ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="1 / 10 ** ref.decimals()" formControlName="unitCost" /></mat-form-field>}
        <mat-form-field appearance="outline"><mat-label>N° de série (un par ligne, si article suivi par série)</mat-label><textarea matInput rows="2" formControlName="serials"></textarea></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Motif (obligatoire)</mat-label><input matInput formControlName="reason" />@if (form.controls.reason.invalid && form.controls.reason.touched) {<mat-error>3 caractères minimum</mat-error>}</mat-form-field>
        @if (form.controls.direction.value === 'out' && auth.has('inventory:validate')) {<mat-slide-toggle formControlName="allowNegative">Autoriser un stock négatif (autorisation explicite, auditée)</mat-slide-toggle>}
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="loading()">Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: `.c{display:flex;flex-direction:column;min-width:min(440px,86vw)}`,
})
export class MovementDialog {
  private api = inject(Api); private ref_ = inject(MatDialogRef<MovementDialog>); ref = inject(ReferenceDataService); auth = inject(AuthService);
  warehouses = signal<{ id: string; code: string; name: string }[]>([]); products = signal<{ id: string; reference: string; name: string; quantityDecimals?: number }[]>([]); product = signal<{ id: string; quantityDecimals?: number } | null>(null); qtyError = quantityError;
  productCtrl = new FormControl<string | { id: string; reference: string; name: string }>('', { nonNullable: true });
  form = new FormBuilder().nonNullable.group({ direction: ['in' as 'in' | 'out'], warehouseId: ['', Validators.required], quantity: [1 as number | null, quantityValidator(() => this.product()?.quantityDecimals ?? 3)], unitCost: [0], serials: [''], reason: ['', [Validators.required, Validators.minLength(3)]], allowNegative: [false] });
  loading = signal(false); error = signal('');
  show = (p: { reference: string; name: string } | string | null) => (typeof p === 'string' ? p : p ? `${p.reference} — ${p.name}` : '');
  constructor() {
    this.api.get('/warehouses').subscribe((w) => { this.warehouses.set(w.filter((x: { isActive: boolean }) => x.isActive)); const d = w.find((x: { isDefault: boolean }) => x.isDefault); if (d) this.form.controls.warehouseId.setValue(d.id); });
    this.productCtrl.valueChanges.pipe(debounceTime(250), switchMap((v) => (typeof v === 'string' && v ? this.api.get('/products', { q: v, limit: 10, active: 'true' }) : of(null))), takeUntilDestroyed()).subscribe((r) => { if (r) this.products.set(r.items); });
  }
  save() {
    if (this.form.invalid || !this.product()) { this.form.markAllAsTouched(); this.error.set('Sélectionnez un article et complétez les champs.'); return; }
    const v = this.form.getRawValue(); this.loading.set(true); const serials = v.serials.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    this.api.post('/stock/movements', { direction: v.direction, productId: this.product()!.id, warehouseId: v.warehouseId, quantity: Number(v.quantity), ...(v.direction === 'in' && { unitCostMinor: this.ref.toMinor(Number(v.unitCost)) }), reason: v.reason, ...(serials.length && { serials }), ...(v.allowNegative && { allowNegativeStock: true }) })
      .subscribe({ next: (r) => this.ref_.close(r), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}

/** Tableau de bord du stock : état par article, seuils, valorisation CMP, alertes. */
@Component({
  selector: 'app-stock-overview',
  imports: [QtyPipe, ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, PageHeader, EmptyState, Skeleton, ExportMenu, MoneyPipe],
  template: `
    <div class="page">
      <app-page-header title="Stock" subtitle="État des stocks, valorisation au coût moyen pondéré (CMP) et alertes de seuil">
        <a mat-stroked-button routerLink="movements"><app-icon name="swap_vert" />Mouvements</a>
        <a mat-stroked-button routerLink="/stock-transfers"><app-icon name="sync_alt" />Transferts</a>
        <a mat-stroked-button routerLink="/inventories"><app-icon name="fact_check" />Inventaires</a>
        <a mat-stroked-button routerLink="warehouses"><app-icon name="warehouse" />Magasins</a>
        @if (auth.has('inventory:validate')) {<a mat-stroked-button routerLink="events"><app-icon name="history" />Événements</a>}
        <app-export-menu path="/stock/overview/export" [params]="{ q: search.value, status: status(), warehouseId: warehouseId() }" />
        @if (auth.has('inventory:create')) {<button mat-flat-button color="primary" (click)="movement()"><app-icon name="add" />Mouvement manuel</button>}
      </app-page-header>
      <div class="kpis"><div class="card"><span class="muted">Valeur du stock</span><strong>{{ summary().valueMinor | money }}</strong></div>
        <div class="card" [style.border-color]="summary().lowCount ? 'var(--accent-300)' : null"><span class="muted">Sous le seuil minimum</span><strong>{{ summary().lowCount }}</strong></div>
        <div class="card" [style.border-color]="summary().outCount ? 'var(--danger-200)' : null"><span class="muted">En rupture</span><strong>{{ summary().outCount }}</strong></div></div>
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" placeholder="Référence, désignation" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Magasin</mat-label><mat-select [value]="warehouseId()" (selectionChange)="warehouseId.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label><mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="">Tous</mat-option><mat-option value="alert">Alertes (seuil + rupture)</mat-option><mat-option value="low">Sous le seuil</mat-option><mat-option value="out">Rupture</mat-option><mat-option value="ok">Normal</mat-option></mat-select></mat-form-field>
        </div>
        @if (loading() && !items().length) {<app-skeleton />} @else if (!items().length) {<app-empty-state icon="inventory" message="Aucun article." />} @else {
        <div class="table-wrap"><table mat-table [dataSource]="items()">
          <ng-container matColumnDef="ref"><th mat-header-cell *matHeaderCellDef>Article</th><td mat-cell *matCellDef="let r"><a [routerLink]="['movements']" [queryParams]="{ productId: r.productId }" class="lnk"><strong>{{ r.reference }}</strong></a><br><span class="muted">{{ r.name }}</span></td></ng-container>
          <ng-container matColumnDef="qty"><th mat-header-cell *matHeaderCellDef style="text-align:right">Quantité</th><td mat-cell *matCellDef="let r" style="text-align:right"><strong>{{ r.qty | qty }}</strong> {{ r.unit }}</td></ng-container>
          <ng-container matColumnDef="min"><th mat-header-cell *matHeaderCellDef style="text-align:right">Seuil min.</th><td mat-cell *matCellDef="let r" style="text-align:right">{{ r.minStock || '—' }}</td></ng-container>
          <ng-container matColumnDef="cmp"><th mat-header-cell *matHeaderCellDef style="text-align:right">CMP</th><td mat-cell *matCellDef="let r" style="text-align:right">{{ r.avgCostMinor | money }}</td></ng-container>
          <ng-container matColumnDef="val"><th mat-header-cell *matHeaderCellDef style="text-align:right">Valeur</th><td mat-cell *matCellDef="let r" style="text-align:right">{{ r.valueMinor | money }}</td></ng-container>
          <ng-container matColumnDef="st"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let r"><span class="chip" [class.ok]="r.status === 'ok'" [class.warn]="r.status === 'low'" [class.danger]="r.status === 'out'">{{ label(r.status) }}</span></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:16px}.kpis .card{display:flex;flex-direction:column;gap:6px}.kpis strong{font-size:22px}.lnk{color:inherit;text-decoration:none}`,
})
export class StockOverview {
  private api = inject(Api); private dialog = inject(MatDialog); private toast = inject(ToastService); private destroy = inject(DestroyRef); auth = inject(AuthService); private router = inject(Router);
  cols = ['ref', 'qty', 'min', 'cmp', 'val', 'st']; items = signal<any[]>([]); total = signal(0); loading = signal(true);  
  summary = signal({ valueMinor: 0, lowCount: 0, outCount: 0 }); warehouses = signal<{ id: string; code: string }[]>([]);
  page = signal(0); pageSize = signal(20); status = signal(''); warehouseId = signal(''); search = new FormControl('', { nonNullable: true });
  label = (s: string) => STATUS[s] ?? s; _ = computed(() => 0);
  ngOnInit() { this.api.get('/warehouses').subscribe((w) => this.warehouses.set(w)); this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload()); this.load(); }
  reload() { this.page.set(0); this.load(); }
  load() { this.loading.set(true); this.api.get('/stock/overview', { page: this.page() + 1, limit: this.pageSize(), q: this.search.value, status: this.status(), warehouseId: this.warehouseId() }).subscribe({ next: (r) => { this.items.set(r.items); this.total.set(r.total); this.summary.set(r.summary); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); } }); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  movement() { this.dialog.open(MovementDialog).afterClosed().subscribe((r) => { if (r) { this.toast.success(r.belowMin ? 'Mouvement enregistré — attention : stock sous le seuil minimum' : 'Mouvement enregistré'); this.load(); } }); void this.router; }
}
