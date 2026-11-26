import { Component, computed, input, model } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AddressSnapshot, DeliveryAddress } from '../models/api.models';
import { AddressBody, addressLine } from './address-card';

/**
 * Choix d'une adresse enregistrée sur un document, avec aperçu. `current` est la copie déjà portée par le document
 * (ou son document source) : elle reste proposée même si l'adresse a depuis été archivée.
 */
@Component({
  selector: 'app-address-select',
  imports: [MatFormFieldModule, MatSelectModule, AddressBody],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="field"><mat-label>{{ label() }}</mat-label>
      <mat-select [value]="value()" (selectionChange)="value.set($event.value)">
        <mat-option value="">{{ noneLabel() }}</mat-option>
        @for (o of options(); track o.id) {<mat-option [value]="o.id">{{ o.label }}@if (o.city) { — {{ o.city }}}@if (o.isDefault) { (par défaut)}</mat-option>}
      </mat-select></mat-form-field>
    @if (selected(); as a) {<div class="preview"><strong>{{ a.label }}</strong><app-address-body [a]="a" /></div>}
    @else if (!options().length) {<p class="muted hint">Aucune adresse enregistrée : ajoutez-en depuis la fiche.</p>}`,
  styles: `:host{display:block;min-width:0}.field{width:100%}.preview{margin-top:8px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--brand);border-radius:var(--r-md);background:var(--brand-50);font-size:14px}
    .preview strong{display:block;margin-bottom:4px}.hint{font-size:12px;margin:6px 0 0}`,
})
export class AddressSelect {
  addresses = input<DeliveryAddress[]>([]);
  current = input<AddressSnapshot | null>(null);
  /** Identifiant sélectionné ; '' = aucune. */
  value = model('');
  label = input('Adresse de livraison');
  noneLabel = input('Aucune (adresse de facturation)');
  options = computed(() => {
    const list = this.addresses().filter((a) => !a.archived).map((a) => ({ id: a.id, label: a.label, city: a.city, isDefault: a.isDefault }));
    const c = this.current();
    if (c?.addressId && !list.some((a) => a.id === c.addressId)) list.unshift({ id: c.addressId, label: `${c.label} (copie du document)`, city: c.city, isDefault: false });
    return list;
  });
  selected = computed(() => {
    const id = this.value(); if (!id) return null;
    const c = this.current();
    return c?.addressId === id ? c : this.addresses().find((a) => a.id === id) ?? null;
  });
}
export { addressLine };
