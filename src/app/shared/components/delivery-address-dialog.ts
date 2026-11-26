import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { errorMessage } from '../../core/services/api';
import { Address, DeliveryAddress } from '../models/api.models';
import { Icon } from './icon';

export interface AddressPayload {
  label: string; street: string; city: string; postalCode: string; country: string; contactName: string; contactPhone: string; mapsUrl: string; instructions: string; isDefault: boolean;
}
export interface AddressDialogData {
  address?: DeliveryAddress;
  /** Adresse de facturation (ou principale) proposée à la copie. */
  billing?: Address; billingLabel?: string; copyBilling?: boolean;
  submit: (v: AddressPayload) => Observable<unknown>;
}

const required = (min: number) => [Validators.required, Validators.minLength(min), (c: AbstractControl): ValidationErrors | null => (String(c.value ?? '').trim().length >= min ? null : { required: true })];
const optional = (re: RegExp, key: string) => (c: AbstractControl): ValidationErrors | null => (!c.value || re.test(String(c.value).trim()) ? null : { [key]: true });

@Component({
  selector: 'app-delivery-address-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, Icon],
  template: `
    <h2 mat-dialog-title>{{ data.address ? 'Modifier l’adresse de livraison' : 'Nouvelle adresse de livraison' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="body">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        @if (data.billing?.street || data.billing?.city) {<button mat-stroked-button type="button" class="copy" (click)="copy()"><app-icon name="content_copy" />{{ data.billingLabel ?? 'Copier l’adresse de facturation' }}</button>}
        <mat-form-field appearance="outline" class="full"><mat-label>Libellé</mat-label><input matInput formControlName="label" maxlength="80" placeholder="Siège social, usine, dépôt, magasin…" />
          @if (form.controls.label.invalid) {<mat-error>Libellé requis (2 caractères minimum)</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Adresse complète</mat-label><textarea matInput rows="2" formControlName="street" maxlength="200"></textarea>
          @if (form.controls.street.invalid) {<mat-error>Adresse requise</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="city" maxlength="80" />@if (form.controls.city.invalid) {<mat-error>Ville requise</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="postalCode" maxlength="20" /></mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Pays</mat-label><input matInput formControlName="country" maxlength="60" />@if (form.controls.country.invalid) {<mat-error>Pays requis</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Contact sur place</mat-label><input matInput formControlName="contactName" maxlength="100" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Téléphone du contact</mat-label><input matInput type="tel" formControlName="contactPhone" placeholder="+216 …" />
          @if (form.controls.contactPhone.invalid) {<mat-error>Numéro invalide</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Lien Google Maps</mat-label><input matInput formControlName="mapsUrl" maxlength="300" placeholder="https://maps.google.com/…" />
          @if (form.controls.mapsUrl.invalid) {<mat-error>URL invalide (http:// ou https://)</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline" class="full"><mat-label>Instructions de livraison</mat-label><textarea matInput rows="2" formControlName="instructions" maxlength="500" placeholder="Horaires, quai, accès…"></textarea></mat-form-field>
        <mat-checkbox formControlName="isDefault" class="full">Adresse de livraison par défaut</mat-checkbox>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()"><app-icon name="save" />Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: `.body{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;width:min(560px,96vw);box-sizing:border-box;padding-top:8px!important}.full,.copy,.err{grid-column:1/-1}.copy{justify-self:start;margin-bottom:16px}
    .err{display:flex;gap:8px;align-items:center;color:var(--danger);background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--r-md);padding:8px 12px;margin-bottom:14px}
    mat-checkbox{margin-top:-4px}@media (max-width:560px){.body{grid-template-columns:1fr}.body>*{grid-column:1/-1}}`,
})
export class DeliveryAddressDialog {
  data = inject<AddressDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<DeliveryAddressDialog>);
  private a = this.data.address;
  form = new FormBuilder().nonNullable.group({
    label: [this.a?.label ?? '', required(2)], street: [this.a?.street ?? '', required(3)], city: [this.a?.city ?? '', required(2)], postalCode: [this.a?.postalCode ?? ''],
    country: [this.a ? this.a.country ?? '' : 'Tunisie', required(2)], contactName: [this.a?.contactName ?? ''],
    contactPhone: [this.a?.contactPhoneInfo?.display ?? this.a?.contactPhone ?? '', optional(/^\+?[\d\s().\-/]{6,25}$/, 'phone')], mapsUrl: [this.a?.mapsUrl ?? '', optional(/^https?:\/\/[^\s/$.?#].[^\s]*$/i, 'url')],
    instructions: [this.a?.instructions ?? ''], isDefault: [this.a?.isDefault ?? false],
  });
  busy = signal(false); error = signal('');
  constructor() { if (this.data.copyBilling) this.copy(); }
  copy() {
    const b = this.data.billing; if (!b) return;
    this.form.patchValue({ street: b.street ?? '', city: b.city ?? '', postalCode: b.postalCode ?? '', country: b.country || 'Tunisie' });
    if (!this.form.controls.label.value) this.form.controls.label.setValue('Siège social');
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    const body = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x])) as unknown as AddressPayload;
    this.data.submit(body).subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

export const openAddressDialog = (d: MatDialog, data: AddressDialogData) => d.open(DeliveryAddressDialog, { data, autoFocus: 'first-tabbable', maxWidth: '96vw' }).afterClosed();
