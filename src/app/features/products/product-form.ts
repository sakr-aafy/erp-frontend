import { Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../../shared/components/icon';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { HasUnsavedChanges } from '../../shared/guards/unsaved.guard';
import { FieldsCustoms, FieldsGeneral, FieldsPackaging, FieldsPrices } from './product-fields';
import { buildProductForm, fullBody, generalBody, packagingBody, customsBody, patchProductForm, pricesBody, stockBody } from './product-form.model';
import { ProductService } from './product.service';
import { ProductDto } from '../../shared/models/api.models';

const GROUPS = [
  { key: 'general', label: '1. Général', hint: 'Identification et caractéristiques', icon: 'info' }, { key: 'packaging', label: '2. Dimensions et Poids', hint: 'Volume, emballage et poids', icon: 'straighten' },
  { key: 'prices', label: '3. Prix', hint: 'Prix d’achat, de vente et marges', icon: 'payments' }, { key: 'stock', label: '4. Stock', hint: 'Seuil et traçabilité', icon: 'warehouse' }, { key: 'customs', label: '5. Douane', hint: 'Informations nécessaires à l’importation', icon: 'account_balance' },
];
const LATER = [{ label: '6. Transactions', icon: 'sync_alt' }, { label: '7. Documents', icon: 'folder' }, { label: '8. Activités', icon: 'history' }];

/** Création / modification d'un article : cinq groupes (Général, Dimensions et Poids, Prix, Stock, Douane) ; Transactions, Documents et Activités s'ouvrent après l'enregistrement. */
@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, Icon, PageHeader, Skeleton, FieldsGeneral, FieldsPackaging, FieldsPrices, FieldsCustoms],
  template: `
    <div class="page">
      <app-page-header [title]="id() ? 'Modifier l’article' : 'Nouvel article'" subtitle="Les champs marqués d’un astérisque sont obligatoires. Le code article est unique par société.">
        <a mat-stroked-button [routerLink]="id() ? ['/products', id()] : ['/products']"><app-icon name="arrow_back" />Retour</a>
      </app-page-header>
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
        @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <nav class="groups" aria-label="Groupes du formulaire">
          @for (g of groups; track g.key) {@if (g.key !== 'customs' || canCustoms()) {<button type="button" class="grp" (click)="go(g.key)"><app-icon [name]="g.icon" /><span><strong>{{ g.label }}</strong><small>{{ g.hint }}</small></span></button>}}
          @for (l of later; track l.label) {<span class="grp off" [attr.title]="id() ? '' : 'Disponible après l’enregistrement de l’article'" aria-disabled="true"><app-icon [name]="l.icon" /><span><strong>{{ l.label }}</strong><small>{{ id() ? 'Dans la fiche de l’article' : 'Disponible après l’enregistrement' }}</small></span></span>}
        </nav>
        <div class="sections">
          <section id="g-general"><app-fields-general [form]="form" [preselectUnit]="!id()" /></section>
          <section id="g-packaging"><app-fields-packaging [form]="form" [product]="product()" /></section>
          <section id="g-prices"><app-fields-prices [form]="form" [product]="product()" [purchase]="canPurchase()" /></section>
          <section id="g-stock">
            <form [formGroup]="form" class="card" (submit)="$event.preventDefault()">
              <header><app-icon name="warehouse" /><h3>Stock</h3></header>
              <p class="muted sub">Seuil d’alerte et traçabilité. Les entrepôts, emplacements, seuils par entrepôt et quantités se gèrent dans l’onglet Stock de la fiche ; les quantités ne changent que par les opérations (réception, sortie, BL, transfert, inventaire).</p>
              <div class="form-grid"><mat-form-field appearance="outline"><mat-label>Stock minimum (seuil d’alerte global)</mat-label><input matInput type="number" min="0" formControlName="minStock" /></mat-form-field></div>
              <mat-slide-toggle formControlName="hasSerial">Article suivi par numéro de série (machines)</mat-slide-toggle>
            </form>
          </section>
          @if (canCustoms()) {<section id="g-customs"><app-fields-customs [form]="form" /></section>}
        </div>
        <div class="bar"><span class="spacer">@if (form.dirty) {<span class="muted"><app-icon name="info" /> Modifications non enregistrées</span>}</span>
          <a mat-button [routerLink]="id() ? ['/products', id()] : ['/products']">Annuler</a>
          <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
      }
    </div>`,
  styles: `.err{color:var(--danger);margin-bottom:16px;display:flex;gap:8px;align-items:center;border-color:var(--danger-200);background:var(--danger-50)}
    .groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:16px}.grp{display:flex;gap:12px;align-items:center;text-align:left;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);color:var(--text);font:inherit;cursor:pointer;transition:all var(--t-fast) var(--ease)}
    .grp:hover{border-color:var(--brand);background:var(--brand-50)}.grp:focus-visible{outline:none;box-shadow:var(--ring)}.grp app-icon{color:var(--brand);flex:none}.grp span{display:flex;flex-direction:column;min-width:0}.grp small{color:var(--muted);font-size:12px;font-weight:400}
    .grp.off{cursor:default;background:var(--surface-2);border-style:dashed}.grp.off:hover{border-color:var(--border);background:var(--surface-2)}.grp.off app-icon{color:var(--muted)}.grp.off strong{color:var(--muted);font-weight:500}
    .sections{display:flex;flex-direction:column;gap:16px;scroll-margin-top:80px}section{scroll-margin-top:80px}header{display:flex;align-items:center;gap:10px;margin-bottom:14px;color:var(--brand)}h3{margin:0;font-size:16px;font-weight:600;color:var(--text)}.sub{margin:-8px 0 14px;font-size:13px}
    .bar{display:flex;gap:8px;align-items:center;margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg);z-index:2}.spacer{flex:1}`,
})
export class ProductForm implements HasUnsavedChanges {
  id = input<string>();
  private fb = inject(FormBuilder); private svc = inject(ProductService); private router = inject(Router); private toast = inject(ToastService); private ref = inject(ReferenceDataService); private auth = inject(AuthService);
  groups = GROUPS; later = LATER;
  form = buildProductForm(this.fb, this.ref.data()?.baseCurrency ?? 'TND');
  product = signal<ProductDto | null>(null); loading = signal(false); saving = signal(false); error = signal('');
  canPurchase = computed(() => ['costCalculation:view', 'purchases:view', 'imports:view'].some((p) => this.auth.has(p)));
  canCustoms = computed(() => this.auth.has('imports:view') || this.auth.has('products:update'));
  private done = false;
  hasUnsavedChanges() { return !this.done && this.form.dirty; }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(e: BeforeUnloadEvent) { if (this.hasUnsavedChanges()) { e.preventDefault(); e.returnValue = ''; } }

  ngOnInit() {
    const id = this.id(); if (!id) return;
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: (p) => { this.product.set(p); patchProductForm(this.form, p, this.ref); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.done = true; this.router.navigateByUrl('/products'); },
    });
  }
  go(key: string) { document.getElementById(`g-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); const e = this.form.errors ?? {};
      this.error.set(e['grossBelowNet'] ? 'Le poids brut ne peut pas être inférieur au poids net.' : e['minAboveSale'] ? 'Le prix minimum de vente ne peut pas dépasser le prix de vente.' : 'Veuillez corriger les champs en erreur.');
      return;
    }
    this.saving.set(true); this.error.set('');
    const id = this.id(); const purchase = this.canPurchase(); const customs = this.canCustoms();
    const body = id
      ? { ...generalBody(this.form, true), ...pricesBody(this.form, this.ref, true, purchase), ...stockBody(this.form), ...(this.form.controls.kind.value === 'product' && { packaging: packagingBody(this.form, true) }), ...(customs && { customs: customsBody(this.form, true) }) }
      : fullBody(this.form, this.ref, purchase, customs);
    (id ? this.svc.update(id, body) : this.svc.create(body)).subscribe({
      next: (p) => { this.done = true; this.toast.success(id ? 'Article modifié' : 'Article créé'); if (p.warnings?.length) this.toast.error(p.warnings.join(' ')); this.router.navigate(['/products', p.id]); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
