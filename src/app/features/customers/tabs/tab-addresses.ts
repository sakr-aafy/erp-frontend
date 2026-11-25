import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { Address, Customer2 } from '../../../shared/models/api.models';
import { CustomerService } from '../customer.service';

const line = (a: Address) => [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ');

/**
 * Onglet Adresses : facturation et livraison. « Livraison = facturation » ne duplique rien : l'adresse de livraison suit la facturation.
 * Les nouveaux documents copient ces adresses à leur création ; les documents déjà émis ne changent jamais.
 */
@Component({
  selector: 'app-tab-addresses',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, Icon],
  template: `
    <div class="top"><h2>Adresses du client</h2>@if (canEdit() && !editing()) {<button mat-stroked-button type="button" (click)="editing.set(true)"><app-icon name="edit" />Modifier</button>}</div>
    @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
    <form [formGroup]="form" class="grid" (submit)="$event.preventDefault()">
      <section class="card" formGroupName="billing"><h3><app-icon name="receipt_long" />Adresse de facturation</h3>
        @if (editing()) {
          <mat-form-field appearance="outline"><mat-label>Adresse complète</mat-label><textarea matInput rows="2" formControlName="street"></textarea></mat-form-field>
          <div class="two"><mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="city" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="postalCode" /></mat-form-field></div>
          <mat-form-field appearance="outline"><mat-label>Pays</mat-label><input matInput formControlName="country" /></mat-form-field>
        } @else {<p class="addr">{{ billingText() || 'Non renseignée' }}</p>}</section>

      <section class="card" formGroupName="shipping"><h3><app-icon name="local_shipping" />Adresse de livraison</h3>
        @if (editing()) {<mat-checkbox [checked]="same()" (change)="same.set($event.checked)">Utiliser l’adresse de facturation comme adresse de livraison</mat-checkbox>}
        @if (same()) {
          @if (!editing()) {<p class="muted"><app-icon name="check_circle" /> Identique à l’adresse de facturation</p>}
          <p class="addr">{{ billingText() || 'Non renseignée' }}</p>
        } @else if (editing()) {
          <mat-form-field appearance="outline"><mat-label>Adresse complète de livraison</mat-label><textarea matInput rows="2" formControlName="street"></textarea></mat-form-field>
          <div class="two"><mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="city" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="postalCode" /></mat-form-field></div>
          <mat-form-field appearance="outline"><mat-label>Pays</mat-label><input matInput formControlName="country" /></mat-form-field>
        } @else {<p class="addr">{{ shippingText() || 'Non renseignée' }}</p>}</section>
    </form>
    @if (editing()) {<div class="bar"><button mat-button type="button" (click)="cancel()">Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>}`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}h3{margin:0 0 12px;font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center;color:var(--brand)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.addr{margin:0;white-space:pre-wrap;font-size:15px}mat-form-field{width:100%}
    .bar{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.err{color:var(--danger);display:flex;gap:8px;align-items:center;margin-bottom:12px}.muted app-icon{color:var(--brand);vertical-align:-3px}`,
})
export class TabAddresses {
  c = input.required<Customer2>(); saved = output<Customer2>();
  private fb = inject(FormBuilder); private svc = inject(CustomerService); private toast = inject(ToastService); private auth = inject(AuthService);
  private g = () => this.fb.nonNullable.group({ street: ['', Validators.maxLength(200)], city: ['', Validators.maxLength(80)], postalCode: ['', Validators.maxLength(20)], country: ['', Validators.maxLength(60)] });
  form = this.fb.nonNullable.group({ billing: this.g(), shipping: this.g() });
  editing = signal(false); saving = signal(false); error = signal(''); same = signal(true);
  canEdit = computed(() => this.auth.has('customers:update') && this.c().status !== 'archived');
  billingText = computed(() => line(this.c().address));
  shippingText = computed(() => line(this.c().shippingAddress));
  constructor() { effect(() => { const c = this.c(); if (!this.editing()) { this.form.setValue({ billing: this.pick(c.address), shipping: this.pick(c.shippingAddress) }); this.same.set(c.shippingSameAsBilling); } }); }
  private pick = (a: Address) => ({ street: a.street ?? '', city: a.city ?? '', postalCode: a.postalCode ?? '', country: a.country ?? '' });
  cancel() { this.editing.set(false); this.error.set(''); this.form.setValue({ billing: this.pick(this.c().address), shipping: this.pick(this.c().shippingAddress) }); this.same.set(this.c().shippingSameAsBilling); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.saving.set(true); this.error.set('');
    const body = { address: { ...v.billing }, shippingSameAsBilling: this.same(), ...(!this.same() && { shippingAddress: { ...v.shipping } }) };
    this.svc.update(this.c().id, body).subscribe({
      next: (u) => { this.saving.set(false); this.editing.set(false); this.toast.success('Adresses enregistrées'); this.saved.emit(u); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
