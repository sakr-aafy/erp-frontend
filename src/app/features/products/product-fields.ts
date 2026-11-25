import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { Icon } from '../../shared/components/icon';
import { CategoryDto, ProductDto, UnitDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openCatalog } from './catalog-dialog';
import { ProductForm, volumes } from './product-form.model';
import { PACKAGING_TYPES, num } from './product.labels';
import { ProductService } from './product.service';
import { PricingPreview } from './product.types';
import { SupplierPicker } from './supplier-picker';

const HEAD = `header{display:flex;align-items:center;gap:10px;margin-bottom:14px;color:var(--brand)}h3{margin:0;font-size:16px;font-weight:600;color:var(--text)}.sub{margin:-8px 0 14px;font-size:13px}.wide{grid-column:1/-1}.small{font-size:12px}
  .hint{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:var(--r-md);background:var(--brand-50);color:var(--text-2);font-size:13px;margin-top:8px}.hint app-icon{color:var(--brand);margin-top:1px;flex:none}
  .warn{display:flex;gap:8px;align-items:center;padding:8px 12px;border-radius:var(--r-md);background:var(--accent-50);border:1px solid var(--accent-300);margin-top:8px}.neg{color:var(--danger)}`;

// ======================= 1. GÉNÉRAL =======================
@Component({
  selector: 'app-fields-general',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonToggleModule, MatButtonModule, MatTooltipModule, Icon],
  template: `
    <form [formGroup]="form()" (submit)="$event.preventDefault()" class="card">
      <header><app-icon name="info" /><h3>Général</h3></header>
      <p class="muted sub">Identification et caractéristiques de l’article.</p>
      <div class="kind"><mat-button-toggle-group [value]="c.kind.value" (change)="c.kind.setValue($event.value)" hideSingleSelectionIndicator aria-label="Type d’article">
        <mat-button-toggle value="product"><app-icon name="inventory_2" />Produit</mat-button-toggle><mat-button-toggle value="service"><app-icon name="work" />Service</mat-button-toggle></mat-button-toggle-group></div>
      <div class="form-grid">
        <mat-form-field appearance="outline"><mat-label>Code article</mat-label><input matInput formControlName="reference" required placeholder="ex. MACH-0001" />
          <mat-hint>Unique par société (casse ignorée)</mat-hint>@if (c.reference.invalid && c.reference.touched) {<mat-error>Code requis (60 caractères max)</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Désignation (nom de l’article)</mat-label><input matInput formControlName="name" required />
          @if (c.name.invalid && c.name.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Marque</mat-label><input matInput formControlName="brand" list="brands" /><datalist id="brands">@for (b of brands(); track b) {<option [value]="b"></option>}</datalist></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Modèle</mat-label><input matInput formControlName="model" /></mat-form-field>
        <mat-form-field appearance="outline">@if (canManage) {<button matPrefix mat-icon-button class="gear" type="button" (click)="manage('category')" aria-label="Gérer les catégories" matTooltip="Gérer les catégories"><app-icon name="settings" /></button>}
          <mat-label>Catégorie</mat-label><mat-select formControlName="familyId" (selectionChange)="c.subId.setValue('')"><mat-option value="">Aucune</mat-option>@for (f of families(); track f.id) {<mat-option [value]="f.id">{{ f.name }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Sous-catégorie</mat-label><mat-select formControlName="subId" [disabled]="!subs().length"><mat-option value="">Aucune</mat-option>@for (s of subs(); track s.id) {<mat-option [value]="s.id">{{ s.name }}</mat-option>}</mat-select>
          @if (c.familyId.value && !subs().length) {<mat-hint>Cette catégorie n’a pas de sous-catégorie</mat-hint>}</mat-form-field>
        <mat-form-field appearance="outline">@if (canManage) {<button matPrefix mat-icon-button class="gear" type="button" (click)="manage('unit')" aria-label="Gérer les unités de vente" matTooltip="Gérer les unités de vente"><app-icon name="settings" /></button>}
          <mat-label>Unité de vente</mat-label><mat-select formControlName="unitId" required>@for (u of units(); track u.id) {<mat-option [value]="u.id">{{ u.name }}</mat-option>}</mat-select>
          @if (c.unitId.invalid && c.unitId.touched) {<mat-error>Unité requise (utilisez l’icône ⚙ pour en créer)</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline" class="wide"><mat-label>Description</mat-label><textarea matInput rows="3" formControlName="description"></textarea></mat-form-field>
      </div>
    </form>`,
  styles: HEAD + `.kind{margin-bottom:14px}mat-button-toggle app-icon{margin-right:6px;vertical-align:middle}.gear{width:36px;height:36px;margin:0 4px 0 8px;padding:0;border-radius:var(--r-md);color:var(--muted);--icon-size:1.15rem}.gear:hover,.gear:focus-visible{background:var(--brand-50);color:var(--brand)}`,
})
export class FieldsGeneral {
  form = input.required<ProductForm>(); preselectUnit = input(false);
  private svc = inject(ProductService); private dialog = inject(MatDialog); private auth = inject(AuthService);
  cats = signal<CategoryDto[]>([]); units = signal<UnitDto[]>([]); brands = signal<string[]>([]);
  canManage = this.auth.has('products:create') || this.auth.has('products:update') || this.auth.has('products:delete');
  get c() { return this.form().controls; }
  families = computed(() => this.cats().filter((x) => !x.parentId));
  private fam = signal('');
  subs = computed(() => this.cats().filter((x) => x.parentId === this.fam()));
  private destroy = inject(DestroyRef);
  constructor() { effect(() => { const f = this.form(); this.fam.set(f.controls.familyId.value); f.controls.familyId.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => this.fam.set(v)); }); }
  ngOnInit() { this.load(); this.svc.brands().subscribe({ next: (b) => this.brands.set(b), error: () => undefined }); }
  private load() {
    this.svc.categories().subscribe((c) => this.cats.set(c));
    this.svc.units().subscribe((u) => { this.units.set(u); if (this.preselectUnit() && u.length === 1 && !this.c.unitId.value) this.c.unitId.setValue(u[0]!.id); });
  }
  manage(kind: 'category' | 'unit') {
    openCatalog(this.dialog, kind).subscribe(() => {
      this.svc.categories().subscribe((cats) => { this.cats.set(cats); if (this.c.familyId.value && !cats.some((x) => x.id === this.c.familyId.value)) this.c.familyId.setValue(''); if (this.c.subId.value && !cats.some((x) => x.id === this.c.subId.value)) this.c.subId.setValue(''); });
      this.svc.units().subscribe((u) => { this.units.set(u); if (!u.some((x) => x.id === this.c.unitId.value)) this.c.unitId.setValue(''); });
    });
  }
}

// ======================= 2. PACKAGING ET POIDS =======================
@Component({
  selector: 'app-fields-packaging',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, Icon],
  template: `
    <form [formGroup]="form()" (submit)="$event.preventDefault()" class="card">
      <header><app-icon name="inventory_2" /><h3>Dimension de packaging et poids</h3></header>
      <p class="muted sub">Dimensions de l’emballage, poids et volume (réutilisés par le module Importations). Facultatif ; sans objet pour un service.</p>
      @if (isService()) {<div class="hint"><app-icon name="info" />Un service n’a ni emballage ni poids : cette section n’est pas utilisée.</div>} @else {
      <div class="form-grid">
        <mat-form-field appearance="outline"><mat-label>Longueur (mm)</mat-label><input matInput type="number" min="0" step="any" formControlName="lengthMm" />@if (c.lengthMm.invalid) {<mat-error>Valeur positive</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Largeur (mm)</mat-label><input matInput type="number" min="0" step="any" formControlName="widthMm" />@if (c.widthMm.invalid) {<mat-error>Valeur positive</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Hauteur (mm)</mat-label><input matInput type="number" min="0" step="any" formControlName="heightMm" />@if (c.heightMm.invalid) {<mat-error>Valeur positive</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Poids net (kg)</mat-label><input matInput type="number" min="0" step="any" formControlName="netWeightKg" />@if (c.netWeightKg.invalid) {<mat-error>Valeur positive</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Poids brut (kg)</mat-label><input matInput type="number" min="0" step="any" formControlName="grossWeightKg" />
          @if (c.grossWeightKg.invalid) {<mat-error>Valeur positive</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Type d’emballage</mat-label><mat-select formControlName="packType"><mat-option value="">Non précisé</mat-option>@for (t of types; track t.value) {<mat-option [value]="t.value">{{ t.label }}</mat-option>}</mat-select></mat-form-field>
        @if (c.packType.value === 'other') {<mat-form-field appearance="outline"><mat-label>Précisez le type d’emballage</mat-label><input matInput formControlName="packTypeLabel" /></mat-form-field>}
        <mat-form-field appearance="outline"><mat-label>Nombre de colis</mat-label><input matInput type="number" min="1" step="1" formControlName="parcelCount" />@if (c.parcelCount.invalid) {<mat-error>Entier positif</mat-error>}</mat-form-field>
      </div>
      @if (gross()) {<p class="neg" role="alert"><app-icon name="warning" /> Le poids brut ne peut pas être inférieur au poids net</p>}
      <mat-slide-toggle formControlName="dimensionsPerParcel">Les dimensions sont celles d’<strong>un seul colis</strong> (tous les colis sont identiques)</mat-slide-toggle>
      <div class="vol" role="status" aria-live="polite">
        <div><span class="muted">Volume d’un colis</span><strong>{{ v().unit === null ? '—' : num(v().unit, 9) + ' m³' }}</strong></div>
        <div><span class="muted">Volume total</span><strong>{{ v().total === null ? '—' : num(v().total, 9) + ' m³' }}</strong>@if (v().multiplied) {<span class="muted small">{{ num(v().unit, 9) }} × {{ c.parcelCount.value }} colis</span>}</div>
      </div>
      <p class="muted small">Volume (m³) = (longueur × largeur × hauteur en mm) / 1 000 000 000, recalculé automatiquement et vérifié par le serveur. Le volume total n’est multiplié par le nombre de colis que si les dimensions sont celles d’un colis.</p>}
    </form>`,
  styles: HEAD + `.vol{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:16px 0 8px}.vol div{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:var(--r-md);background:var(--brand-50)}.vol strong{font-size:20px;color:var(--brand);font-variant-numeric:tabular-nums}`,
})
export class FieldsPackaging {
  form = input.required<ProductForm>(); types = PACKAGING_TYPES; num = num;
  get c() { return this.form().controls; }
  private tick = signal(0); private destroy = inject(DestroyRef);
  constructor() { effect(() => { const f = this.form(); f.valueChanges.pipe(debounceTime(0), takeUntilDestroyed(this.destroy)).subscribe(() => this.tick.update((x) => x + 1)); }); }
  isService = () => (this.tick(), this.c.kind.value === 'service');
  gross = () => (this.tick(), this.form().hasError('grossBelowNet'));
  v = computed(() => { this.tick(); const x = this.form().getRawValue(); return volumes({ lengthMm: x.lengthMm, widthMm: x.widthMm, heightMm: x.heightMm, parcelCount: x.parcelCount, dimensionsPerParcel: x.dimensionsPerParcel }); });
}

// ======================= 3. PRIX =======================
@Component({
  selector: 'app-fields-prices',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon, SupplierPicker, MoneyPipe],
  template: `
    <form [formGroup]="form()" (submit)="$event.preventDefault()" class="stack">
      @if (!ref.vatRates().length) {<div class="warn" role="alert"><app-icon name="warning" />Aucune règle de TVA validée : validez-les dans Fiscalité avant d’enregistrer un article.</div>}
      @if (product()?.access?.purchase ?? purchase()) {
      <section class="card">
        <header><app-icon name="shopping_cart" /><h3>Achat</h3></header>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Devise d’achat</mat-label><mat-select formControlName="purchaseCurrency">@for (cur of currencies(); track cur) {<mat-option [value]="cur">{{ cur }}{{ cur === base() ? ' (devise de base)' : '' }}</mat-option>}</mat-select></mat-form-field>
          @if (foreign()) {
            <mat-form-field appearance="outline"><mat-label>Prix d’achat HT chez le fournisseur ({{ c.purchaseCurrency.value }})</mat-label><input matInput type="number" min="0" step="any" formControlName="purchaseForeign" />@if (c.purchaseForeign.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
            <div class="conv" role="status"><span class="muted">Contre-valeur en {{ base() }}</span><strong>{{ convertedMinor() === null ? '—' : (convertedMinor() | money) }}</strong>
              <span class="muted small">@if (rate()) {1 {{ c.purchaseCurrency.value }} = {{ rate()!.rate }} {{ base() }} (taux du {{ rate()!.rateDate.slice(0, 10) }})} @else {Le taux de change enregistré est appliqué à l’enregistrement.}</span></div>
          } @else {
            <mat-form-field appearance="outline"><mat-label>Prix d’achat HT ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="purchasePrice" />@if (c.purchasePrice.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          }
          <app-supplier-picker [control]="c.mainSupplier" label="Fournisseur habituel" />
          <mat-form-field appearance="outline"><mat-label>Coût de revient estimé ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="estimatedCost" />
            <mat-hint>Saisi à titre indicatif ; le coût réel vient des réceptions et importations</mat-hint></mat-form-field>
          @if (product()?.access?.cost) {<div class="conv"><span class="muted">Coût de revient réel actuel</span><strong>{{ product()!.costPriceMinor === null ? 'Pas encore calculé' : (product()!.costPriceMinor | money) }}</strong><span class="muted small">Calculé par le module Coût de revient (CMP)</span></div>}
        </div>
      </section>}
      <section class="card">
        <header><app-icon name="payments" /><h3>Vente</h3></header>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Prix de vente HT ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="salePrice" required />@if (c.salePrice.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>TVA</mat-label><mat-select formControlName="vatRateCode" required>@for (v of ref.vatRates(); track v.code) {<mat-option [value]="v.code">{{ v.code }} — {{ vatText(v) }}{{ v.label ? ' (' + v.label + ')' : '' }}</mat-option>}</mat-select>
            <mat-hint>Source unique : la même TVA s’affiche dans l’onglet Douane</mat-hint>@if (c.vatRateCode.invalid && c.vatRateCode.touched) {<mat-error>TVA requise</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Prix minimum de vente HT ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="minSalePrice" />
            @if (c.minSalePrice.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Remise maximale autorisée (%)</mat-label><input matInput type="number" min="0" max="100" step="0.01" formControlName="maxDiscountPct" />@if (c.maxDiscountPct.invalid) {<mat-error>Entre 0 et 100 %</mat-error>}</mat-form-field>
          <div class="conv" role="status"><span class="muted">Prix de vente TTC</span><strong>{{ preview() ? (preview()!.saleTtcMinor | money) : '—' }}</strong><span class="muted small">{{ preview() ? 'TVA ' + preview()!.vatRatePct + ' % (' + regime(preview()!.vatRegime) + ')' : 'Calculé par le moteur fiscal' }}</span></div>
        </div>
        @if (minAbove()) {<p class="neg" role="alert"><app-icon name="warning" /> Le minimum ne peut pas dépasser le prix de vente</p>}
        @if (preview()?.margins; as m) {
          <div class="margins" role="status" aria-live="polite">
            <div><span class="muted">Marge HT</span><strong [class.neg]="m.marginHtMinor < 0">{{ m.marginHtMinor | money }}</strong></div>
            <div><span class="muted">Taux de marge (sur coût)</span><strong>{{ m.marginRatePct === null ? '—' : m.marginRatePct + ' %' }}</strong></div>
            <div><span class="muted">Taux de marque (sur prix de vente)</span><strong>{{ m.markPct === null ? '—' : m.markPct + ' %' }}</strong></div>
            <div><span class="muted">Marge TTC (indicative)</span><strong [class.neg]="m.marginTtcMinor < 0">{{ m.marginTtcMinor | money }}</strong><span class="muted small">{{ m.marginTtcRatePct === null ? '' : m.marginTtcRatePct + ' %' }}</span></div>
          </div>
          <p class="muted small">Marge HT = prix de vente HT − coût de revient. Marge TTC indicative = prix TTC − (coût + TVA sur coût) : la TVA n’est jamais comptée comme un bénéfice (formule à valider avec le comptable). Coût retenu : réel, sinon estimé, sinon prix d’achat.</p>
          @if (preview()!.belowCost) {<div class="warn" role="alert"><app-icon name="warning" />Le prix de vente est inférieur au coût de revient.</div>}
        }
      </section>
    </form>`,
  styles: HEAD + `.stack{display:flex;flex-direction:column;gap:16px}.conv{display:flex;flex-direction:column;gap:2px;justify-content:center;padding:10px 14px;border-radius:var(--r-md);background:var(--brand-50);min-height:56px}.conv strong{font-size:18px;color:var(--brand);font-variant-numeric:tabular-nums}
    .margins{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px}.margins div{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-md)}.margins strong{font-size:18px;font-variant-numeric:tabular-nums}`,
})
export class FieldsPrices {
  form = input.required<ProductForm>(); product = input<ProductDto | null>(null); purchase = input(true); canCost = input(true);
  ref = inject(ReferenceDataService); private svc = inject(ProductService); private destroy = inject(DestroyRef); private auth = inject(AuthService);
  get c() { return this.form().controls; }
  base = computed(() => this.ref.data()?.baseCurrency ?? 'TND');
  currencies = computed(() => [this.base(), ...(this.ref.data()?.currencies ?? []).map((x) => x.code).filter((x) => x !== this.base())]);
  rate = signal<{ rate: number; rateDate: string } | null>(null); preview = signal<PricingPreview | null>(null);
  private cur = signal(''); private foreignVal = signal<number | null>(null);
  foreign = computed(() => !!this.cur() && this.cur() !== this.base());
  private tick = signal(0); minAbove = () => (this.tick(), this.form().hasError('minAboveSale'));
  step = () => 1 / 10 ** this.ref.decimals();
  regime = (r: string) => ({ taxable: 'taxable', zero: 'taux zéro', exempt: 'exonéré', suspended: 'suspension' } as Record<string, string>)[r] ?? r;
  vatText = (v: { regime: string; ratePct: number }) => (v.regime === 'taxable' ? `${v.ratePct} %` : ({ zero: '0 % (taux zéro)', exempt: 'exonéré', suspended: 'suspension' } as Record<string, string>)[v.regime]);
  convertedMinor = computed(() => { const r = this.rate(); const f = this.foreignVal(); if (!r || f === null || !this.foreign()) return null; return Math.round(f * r.rate * 10 ** this.ref.decimals()); });
  constructor() {
    effect(() => {
      const f = this.form(); this.cur.set(f.controls.purchaseCurrency.value); this.foreignVal.set(f.controls.purchaseForeign.value === null ? null : Number(f.controls.purchaseForeign.value));
      f.controls.purchaseCurrency.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => { this.cur.set(v); this.loadRate(v); });
      f.controls.purchaseForeign.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => this.foreignVal.set(v === null || (v as unknown) === '' ? null : Number(v)));
      f.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.tick.update((x) => x + 1));
      f.valueChanges.pipe(debounceTime(350), switchMap(() => {
        const v = f.getRawValue(); const code = v.vatRateCode; const sale = this.ref.toMinor(Number(v.salePrice) || 0); if (!code) return of(null);
        const pr = this.product(); const cost = pr?.costPriceMinor ?? (v.estimatedCost !== null && (v.estimatedCost as unknown) !== '' ? this.ref.toMinor(Number(v.estimatedCost)) : this.foreign() ? this.convertedMinor() : (v.purchasePrice !== null && (v.purchasePrice as unknown) !== '' ? this.ref.toMinor(Number(v.purchasePrice)) : null));
        return this.svc.pricingPreview({ salePriceMinor: sale, vatRateCode: code, ...(this.auth.has('costCalculation:view') && cost !== null && { costMinor: cost }) }).pipe(catchError(() => of(null)));
      }), takeUntilDestroyed(this.destroy)).subscribe((p) => this.preview.set(p));
      queueMicrotask(() => { f.updateValueAndValidity({ emitEvent: true }); this.loadRate(f.controls.purchaseCurrency.value); });
    });
  }
  private loadRate(cur: string) { if (!cur || cur === this.base() || !this.auth.has('imports:view')) { this.rate.set(null); return; } this.svc.rate(cur).subscribe({ next: (r) => this.rate.set(r), error: () => this.rate.set(null) }); }
}

// ======================= 5. DOUANE =======================
@Component({
  selector: 'app-fields-customs',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, Icon],
  template: `
    <form [formGroup]="form()" (submit)="$event.preventDefault()" class="card">
      <header><app-icon name="account_balance" /><h3>Douane</h3></header>
      <p class="muted sub">Informations nécessaires à l’importation. Aucun code ni taux n’est présumé : saisissez les valeurs validées par votre transitaire.</p>
      <div class="form-grid">
        <mat-form-field appearance="outline"><mat-label>Code NGP du fournisseur</mat-label><input matInput formControlName="supplierHsCode" inputmode="numeric" /><mat-hint>Texte : les zéros initiaux sont conservés</mat-hint>@if (c.supplierHsCode.invalid) {<mat-error>Code invalide (chiffres, lettres, points, tirets)</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Code NGP tunisien</mat-label><input matInput formControlName="tnHsCode" inputmode="numeric" />@if (c.tnHsCode.invalid) {<mat-error>Code invalide</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>DD — Droits de douane (%)</mat-label><input matInput type="number" min="0" step="any" formControlName="ddPct" />@if (c.ddPct.invalid) {<mat-error>Pourcentage positif</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>FODEC (%)</mat-label><input matInput type="number" min="0" step="any" formControlName="fodecPct" />@if (c.fodecPct.invalid) {<mat-error>Pourcentage positif</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>RPD (%)</mat-label><input matInput type="number" min="0" step="any" formControlName="rpdPct" />@if (c.rpdPct.invalid) {<mat-error>Pourcentage positif</mat-error>}</mat-form-field>
        <div class="vat" role="status"><span class="muted">TVA (identique à l’onglet Prix)</span><strong>{{ vat() }}</strong><span class="muted small">Modifiable uniquement dans l’onglet Prix</span></div>
        <mat-form-field appearance="outline"><mat-label>Pays d’origine</mat-label><input matInput formControlName="originCountry" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Pays de provenance</mat-label><input matInput formControlName="provenanceCountry" /></mat-form-field>
        <mat-form-field appearance="outline" class="wide"><mat-label>Règlement particulier</mat-label><textarea matInput rows="2" formControlName="specialRegulation"></textarea></mat-form-field>
      </div>
      <div class="hint"><app-icon name="info" />Les bases de calcul de chaque droit et taxe dépendent du régime douanier : elles ne sont pas déduites automatiquement. Ces valeurs sont copiées (instantané daté) dans chaque dossier d’importation à l’ajout de l’article ; un dossier existant n’est jamais modifié.</div>
    </form>`,
  styles: HEAD + `.vat{display:flex;flex-direction:column;gap:2px;justify-content:center;padding:10px 14px;border-radius:var(--r-md);background:var(--brand-50);min-height:56px}.vat strong{font-size:16px;color:var(--brand)}`,
})
export class FieldsCustoms {
  form = input.required<ProductForm>(); ref = inject(ReferenceDataService);
  get c() { return this.form().controls; }
  private code = signal(''); private destroy = inject(DestroyRef);
  constructor() { effect(() => { const f = this.form(); this.code.set(f.controls.vatRateCode.value); f.controls.vatRateCode.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => this.code.set(v)); }); }
  vat = computed(() => { const r = this.ref.vatRates().find((x) => x.code === this.code()); return r ? `${r.code} — ${r.regime === 'taxable' ? r.ratePct + ' %' : r.regime === 'zero' ? '0 % (taux zéro)' : r.regime === 'exempt' ? 'exonéré' : 'suspension'}` : this.code() || '—'; });
}
