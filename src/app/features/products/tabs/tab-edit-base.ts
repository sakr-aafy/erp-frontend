import { Directive, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { AuthService } from '../../../core/authentication/auth.service';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ProductDto } from '../../../shared/models/api.models';
import { buildProductForm, patchProductForm } from '../product-form.model';

/** Comportement commun des onglets Général / Packaging / Prix / Douane : consultation puis modification en place (mêmes champs et validations que le formulaire de création). */
@Directive()
export abstract class TabEditBase {
  p = input.required<ProductDto>(); saved = output<ProductDto>();
  protected fb = inject(FormBuilder); protected ref = inject(ReferenceDataService); protected auth = inject(AuthService);
  form = buildProductForm(this.fb, this.ref.data()?.baseCurrency ?? 'TND');
  editing = signal(false); saving = signal(false); error = signal('');
  canEdit = computed(() => this.auth.has('products:update') && this.p().status !== 'archived');
  constructor() { effect(() => { const p = this.p(); if (!this.editing()) patchProductForm(this.form, p, this.ref); }); }
  edit() { patchProductForm(this.form, this.p(), this.ref); this.error.set(''); this.editing.set(true); }
  cancel() { patchProductForm(this.form, this.p(), this.ref); this.editing.set(false); this.error.set(''); }
  protected invalidMessage(): string | null {
    if (this.form.valid) return null; this.form.markAllAsTouched(); const e = this.form.errors ?? {};
    return e['grossBelowNet'] ? 'Le poids brut ne peut pas être inférieur au poids net.' : e['minAboveSale'] ? 'Le prix minimum de vente ne peut pas dépasser le prix de vente.' : 'Veuillez corriger les champs en erreur.';
  }
}
