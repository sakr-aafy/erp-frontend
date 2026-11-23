import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { Page, SupplierDto, UnitDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openCatalog } from './catalog-dialog';
import { ProductService, categoryOptions } from './product.service';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule, MatTooltipModule, Icon, PageHeader, Skeleton, MoneyPipe],
  template: `
    <div class="page">
      <app-page-header [title]="id() ? 'Modifier l’article' : 'Nouvel article'" subtitle="La référence est unique. Les prix sont saisis dans la devise de base." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (!ref.vatRates().length) {<div class="card warn" role="alert"><app-icon name="warning" /> Aucune règle de TVA validée. Configurez et validez-les dans <a routerLink="/fiscal">Fiscalité</a> avant de créer des articles.</div>}
        @if (error()) {<div class="card" style="color:var(--danger);margin-bottom:16px" role="alert">{{ error() }}</div>}
        <div class="card" style="margin-bottom:16px"><h3>Identification</h3><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Référence</mat-label><input matInput formControlName="reference" />
            @if (form.controls.reference.invalid && form.controls.reference.touched) {<mat-error>Requise (60 car. max)</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Désignation</mat-label><input matInput formControlName="name" />
            @if (form.controls.name.invalid && form.controls.name.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Type</mat-label><mat-select formControlName="kind"><mat-option value="product">Produit</mat-option><mat-option value="service">Service</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline">@if (canManage) {<button matPrefix mat-icon-button class="gear" type="button" (click)="manage('category')" aria-label="Gérer les catégories" matTooltip="Gérer les catégories"><app-icon name="settings" /></button>}<mat-label>Catégorie</mat-label><mat-select formControlName="categoryId"><mat-option value="">Aucune</mat-option>@for (c of cats(); track c.id) {<mat-option [value]="c.id">{{ c.label }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline">@if (canManage) {<button matPrefix mat-icon-button class="gear" type="button" (click)="manage('unit')" aria-label="Gérer les unités de mesure" matTooltip="Gérer les unités de mesure"><app-icon name="settings" /></button>}<mat-label>Unité de mesure</mat-label><mat-select formControlName="unitId">@for (u of units(); track u.id) {<mat-option [value]="u.id">{{ u.code }} — {{ u.name }}</mat-option>}</mat-select>
            @if (form.controls.unitId.invalid && form.controls.unitId.touched) {<mat-error>Unité requise (créez-en dans Catégories & unités)</mat-error>}</mat-form-field>
        </div>
          <mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Description</mat-label><textarea matInput rows="2" formControlName="description"></textarea></mat-form-field></div>
        <div class="card" style="margin-bottom:16px"><h3>Prix et TVA</h3><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Prix d’achat ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="purchasePrice" />
            @if (form.controls.purchasePrice.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Prix de vente ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="salePrice" />
            @if (form.controls.salePrice.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Taux de TVA</mat-label><mat-select formControlName="vatRateCode">
            @for (v of ref.vatRates(); track v.code) {<mat-option [value]="v.code">{{ v.code }} — {{ vatText(v) }}{{ v.label ? ' (' + v.label + ')' : '' }}</mat-option>}</mat-select>
            @if (form.controls.vatRateCode.invalid && form.controls.vatRateCode.touched) {<mat-error>Taux de TVA requis</mat-error>}</mat-form-field>
        </div>
          <p class="muted">Marge (aperçu) : <strong>{{ margin() | money }}</strong> — le coût de revient définitif et l’alerte sont calculés par le serveur.</p>
          @if (belowCost()) {<div class="warn-inline"><app-icon name="warning" /> Le prix de vente est inférieur au coût{{ existingCost() !== null ? ' de revient' : ' (prix d’achat)' }}.</div>}</div>
        <div class="card" style="margin-bottom:16px"><h3>Stock et approvisionnement</h3><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Stock minimum (seuil d’alerte)</mat-label><input matInput type="number" min="0" formControlName="minStock" /></mat-form-field>
          @if (suppliers().length || form.controls.mainSupplierId.value) {
            <mat-form-field appearance="outline"><mat-label>Fournisseur principal</mat-label><mat-select formControlName="mainSupplierId"><mat-option value="">Aucun</mat-option>@for (s of suppliers(); track s.id) {<mat-option [value]="s.id">{{ s.name }}</mat-option>}</mat-select></mat-form-field>
          }
        </div><mat-slide-toggle formControlName="hasSerial">Article suivi par numéro de série (machines)</mat-slide-toggle></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button [routerLink]="id() ? ['/products', id()] : ['/products']">Annuler</a>
          <button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}
    </div>`,
  styles: `.gear{width:36px;height:36px;margin:0 4px 0 8px;padding:0;border-radius:var(--r-md);color:var(--muted);--icon-size:1.15rem;transition:background var(--t-fast),color var(--t-fast)}.gear:hover,.gear:focus-visible{background:var(--brand-50);color:var(--brand)}h3{margin:0 0 12px;font-size:16px}.warn{background:var(--accent-50);border-color:var(--accent-300);margin-bottom:16px;display:flex;gap:8px;align-items:center}
    .warn-inline{display:flex;gap:6px;align-items:center;color:var(--danger);font-weight:500}`,
})
export class ProductForm {
  id = input<string>();
  private fb = inject(FormBuilder); private svc = inject(ProductService); private router = inject(Router); private toast = inject(ToastService); private http = inject(HttpClient);
  ref = inject(ReferenceDataService); private auth = inject(AuthService); private dialog = inject(MatDialog);
  canManage = this.auth.has('products:create') || this.auth.has('products:update') || this.auth.has('products:delete');
  manage(kind: 'category' | 'unit') { openCatalog(this.dialog, kind).subscribe(() => this.reloadCatalog()); }
  private reloadCatalog() {
    this.svc.categories().subscribe((c) => { this.cats.set(categoryOptions(c)); if (!c.some((x) => x.id === this.form.controls.categoryId.value)) this.form.controls.categoryId.setValue(''); });
    this.svc.units().subscribe((u) => { this.units.set(u); if (!u.some((x) => x.id === this.form.controls.unitId.value)) this.form.controls.unitId.setValue(''); });
  }
  cats = signal<{ id: string; label: string }[]>([]); units = signal<UnitDto[]>([]); suppliers = signal<SupplierDto[]>([]);
  existingCost = signal<number | null>(null);
  form = this.fb.nonNullable.group({
    reference: ['', [Validators.required, Validators.maxLength(60)]], name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]], description: [''],
    kind: ['product' as 'product' | 'service'], categoryId: [''], unitId: ['', Validators.required], purchasePrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0)]], vatRateCode: ['', Validators.required], minStock: [0, Validators.min(0)], mainSupplierId: [''], hasSerial: [false],
  });
  private values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  cost = computed(() => this.existingCost() ?? this.ref.toMinor(Number(this.values().purchasePrice) || 0));
  margin = computed(() => this.ref.toMinor(Number(this.values().salePrice) || 0) - this.cost());
  belowCost = computed(() => this.margin() < 0);
  loading = signal(false); saving = signal(false); error = signal('');
  step = () => 1 / 10 ** this.ref.decimals();
  vatText = (v: { regime: string; ratePct: number }) => (v.regime === 'taxable' ? `${v.ratePct} %` : ({ zero: '0 % (taux zéro)', exempt: 'exonéré', suspended: 'suspension' } as Record<string, string>)[v.regime]);

  ngOnInit() {
    this.svc.categories().subscribe((c) => this.cats.set(categoryOptions(c)));
    this.svc.units().subscribe((u) => { this.units.set(u); if (!this.id() && u.length === 1) this.form.controls.unitId.setValue(u[0]!.id); });
    if (this.auth.has('suppliers:view')) this.http.get<Page<SupplierDto>>(`${environment.apiUrl}/suppliers`, { params: { limit: 100, status: 'active' } }).subscribe((p) => this.suppliers.set(p.items));
    const id = this.id(); if (!id) return;
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: (p) => {
        this.form.patchValue({ reference: p.reference, name: p.name, description: p.description ?? '', kind: p.kind, categoryId: p.categoryId ?? '', unitId: p.unitId, purchasePrice: this.ref.fromMinor(p.purchasePriceMinor),
          salePrice: this.ref.fromMinor(p.salePriceMinor), vatRateCode: p.vatRateCode, minStock: p.minStock, mainSupplierId: p.mainSupplierId ?? '', hasSerial: p.hasSerial });
        this.existingCost.set(p.costPriceMinor);
        this.loading.set(false);
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/products'); },
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Veuillez corriger les champs en erreur.'); return; }
    this.saving.set(true); this.error.set('');
    const v = this.form.getRawValue(); const id = this.id();
    const body = {
      reference: v.reference, name: v.name, description: v.description || (id ? null : undefined), kind: v.kind, categoryId: v.categoryId || (id ? null : undefined), unitId: v.unitId,
      purchasePriceMinor: this.ref.toMinor(Number(v.purchasePrice)), salePriceMinor: this.ref.toMinor(Number(v.salePrice)), vatRateCode: v.vatRateCode,
      minStock: Number(v.minStock) || 0, mainSupplierId: v.mainSupplierId || (id ? null : undefined), hasSerial: v.hasSerial,
    };
    (id ? this.svc.update(id, body) : this.svc.create(body)).subscribe({
      next: (p) => {
        this.toast.success(id ? 'Article modifié' : 'Article créé');
        if (p.warnings?.length) this.toast.error(p.warnings.join(' '));
        this.router.navigate(['/products', p.id]);
      },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
