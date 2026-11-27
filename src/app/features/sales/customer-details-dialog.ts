import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { errorMessage } from '../../core/services/api';
import { Icon } from '../../shared/components/icon';
import { CYCLE_DIALOG } from './cycle/dialog.styles';
import { SalesDoc } from './sales.models';
import { SalesService } from './sales.service';

export interface CustomerDetailsData { id: string; number: string | null; customer: SalesDoc['customer']; canUpdateCustomer: boolean }

/** Coordonnées imprimées d'une facture validée : les montants ne changent pas, chaque correction est conservée. */
@Component({
  selector: 'app-customer-details-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, Icon],
  template: `
    <h2 mat-dialog-title>Coordonnées du client — {{ data.number }}</h2>
    <mat-dialog-content><form class="body" [formGroup]="form" (submit)="$event.preventDefault(); save()">
      @if (error()) {<p class="err" role="alert"><app-icon name="error" />{{ error() }}</p>}
      <p class="note warn" role="status">Cette facture est déjà validée. Seules les coordonnées imprimées changent : numéro, lignes et montants restent identiques, et l’ancienne version est conservée dans l’historique. Faites confirmer cette pratique par votre comptable.</p>
      <div class="grid">
        <mat-form-field appearance="outline" class="wide"><mat-label>Raison sociale / Nom</mat-label><input matInput formControlName="name" maxlength="150" />@if (form.controls.name.invalid) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Matricule fiscal</mat-label><input matInput formControlName="taxId" maxlength="40" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Téléphone</mat-label><input matInput type="tel" formControlName="phone" />@if (form.controls.phone.invalid) {<mat-error>Numéro invalide</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline" class="wide"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" />@if (form.controls.email.invalid) {<mat-error>E-mail invalide</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline" class="wide"><mat-label>Adresse</mat-label><input matInput formControlName="street" maxlength="200" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="city" maxlength="80" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="postalCode" maxlength="20" /></mat-form-field>
        <mat-form-field appearance="outline" class="wide"><mat-label>Pays</mat-label><input matInput formControlName="country" maxlength="60" /></mat-form-field>
        <mat-form-field appearance="outline" class="wide"><mat-label>Motif de la correction</mat-label><input matInput formControlName="reason" maxlength="300" required />@if (form.controls.reason.invalid) {<mat-error>Motif obligatoire (3 caractères minimum)</mat-error>}</mat-form-field>
      </div>
      @if (data.canUpdateCustomer) {<mat-checkbox formControlName="updateCustomer">Mettre aussi à jour la fiche client (prochains documents)</mat-checkbox>}
    </form></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button>
      <button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="save()">Enregistrer la correction</button></mat-dialog-actions>`,
  styles: CYCLE_DIALOG + `.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px}.wide{grid-column:1/-1}@media (max-width:600px){.grid{grid-template-columns:minmax(0,1fr)}}`,
})
export class CustomerDetailsDialog {
  data = inject<CustomerDetailsData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<CustomerDetailsDialog>); private svc = inject(SalesService);
  error = signal(''); busy = signal(false);
  private c = this.data.customer;
  form = inject(FormBuilder).nonNullable.group({
    name: [this.c.name, [Validators.required, Validators.minLength(2)]], taxId: [this.c.taxId ?? ''],
    phone: [this.c.phone ?? '', Validators.pattern(/^\+?[\d\s().\-/]{6,25}$/)], email: [this.c.email ?? '', Validators.email],
    street: [this.c.address?.street ?? ''], city: [this.c.address?.city ?? ''], postalCode: [this.c.address?.postalCode ?? ''], country: [this.c.address?.country ?? ''],
    reason: ['', [Validators.required, Validators.minLength(3)]], updateCustomer: [this.data.canUpdateCustomer],
  });
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Corrigez les champs en erreur.'); return; }
    const { street, city, postalCode, country, ...v } = this.form.getRawValue();
    this.busy.set(true); this.error.set('');
    this.svc.correctCustomer(this.data.id, { ...v, name: v.name.trim(), reason: v.reason.trim(), email: v.email.trim(), phone: v.phone.trim(), address: { street, city, postalCode, country } })
      .subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}
