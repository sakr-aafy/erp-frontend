import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { DeliveryAddresses } from '../../../shared/components/delivery-addresses';
import { Icon } from '../../../shared/components/icon';
import { Address, SupplierDto } from '../../../shared/models/api.models';
import { SupplierService } from '../supplier.service';

const line = (a: Address) => [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ');

/**
 * Onglet Adresses : adresse de facturation du fournisseur et adresses chez le fournisseur (siège, usine, dépôt, point
 * d'enlèvement…), une seule par défaut. Elles ne se confondent pas avec le magasin de réception de la société ; les
 * documents d'achat copient l'adresse choisie et ne changent plus ensuite.
 */
@Component({
  selector: 'app-tab-addresses',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon, DeliveryAddresses],
  template: `
    <h2>Adresses du fournisseur</h2>
    @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
    <section class="card billing">
      <div class="top"><h3><app-icon name="receipt_long" />Adresse de facturation</h3>@if (canEdit() && !editing()) {<button mat-stroked-button type="button" (click)="editing.set(true)"><app-icon name="edit" />Modifier</button>}</div>
      @if (editing()) {
        <form [formGroup]="form" class="fields" (submit)="$event.preventDefault()">
          <mat-form-field appearance="outline" class="wide"><mat-label>Adresse complète</mat-label><textarea matInput rows="2" formControlName="street"></textarea></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="city" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="postalCode" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Pays</mat-label><input matInput formControlName="country" /></mat-form-field>
        </form>
        <div class="bar"><button mat-button type="button" (click)="cancel()">Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
      } @else {<p class="addr">{{ billingText() || 'Non renseignée' }}</p>}
    </section>
    <p class="muted small">Adresses chez le fournisseur (livraison ou enlèvement). Le magasin de réception de votre société se choisit sur chaque commande.</p>
    <app-delivery-addresses [base]="'/suppliers/' + c().id" [addresses]="c().deliveryAddresses" [canEdit]="canEdit()" [billing]="c().address" billingLabel="Copier l’adresse de facturation" (changed)="onChanged($event)" />`,
  styles: `h2{margin:0 0 14px;font-size:16px;font-weight:600}.small{font-size:12px}h3{margin:0;font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center}h3 app-icon{color:var(--brand)}
    .billing{margin-bottom:20px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}.addr{margin:0;white-space:pre-wrap;font-size:15px;overflow-wrap:anywhere}
    .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 12px}.wide{grid-column:1/-1}mat-form-field{width:100%}
    .bar{display:flex;justify-content:flex-end;gap:8px}.err{color:var(--danger);display:flex;gap:8px;align-items:center;margin-bottom:12px}`,
})
export class TabAddresses {
  c = input.required<SupplierDto>(); saved = output<SupplierDto>();
  private fb = inject(FormBuilder); private svc = inject(SupplierService); private toast = inject(ToastService); private auth = inject(AuthService);
  form = this.fb.nonNullable.group({ street: ['', Validators.maxLength(200)], city: ['', Validators.maxLength(80)], postalCode: ['', Validators.maxLength(20)], country: ['', Validators.maxLength(60)] });
  editing = signal(false); saving = signal(false); error = signal('');
  canEdit = computed(() => this.auth.has('suppliers:update') && this.c().status !== 'archived');
  billingText = computed(() => line(this.c().address));
  constructor() { effect(() => { const c = this.c(); if (!this.editing()) this.form.setValue(this.pick(c.address)); }); }
  private pick = (a: Address) => ({ street: a.street ?? '', city: a.city ?? '', postalCode: a.postalCode ?? '', country: a.country ?? '' });
  onChanged(c: unknown) { this.saved.emit(c as SupplierDto); }
  cancel() { this.editing.set(false); this.error.set(''); this.form.setValue(this.pick(this.c().address)); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set('');
    this.svc.update(this.c().id, { address: this.form.getRawValue() }).subscribe({
      next: (u) => { this.saving.set(false); this.editing.set(false); this.toast.success('Adresse de facturation enregistrée'); this.saved.emit(u); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
