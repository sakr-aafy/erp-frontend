import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../core/services/api.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { PAYMENT_METHOD_LABELS } from './sales.models';
import { SalesService } from './sales.service';

@Component({
  selector: 'app-payment-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Enregistrer un encaissement</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="c">
        <p class="muted">Facture {{ data.number }} — reste à payer : <strong>{{ ref.format(data.dueMinor) }}</strong></p>
        @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Montant ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="1 / 10 ** ref.decimals()" formControlName="amount" />
          @if (form.controls.amount.invalid) {<mat-error>Montant positif, au plus le reste à payer</mat-error>}</mat-form-field>
        @if (accounts().length) {<mat-form-field appearance="outline"><mat-label>Compte de trésorerie</mat-label><mat-select formControlName="account">@for (a of accounts(); track a.id) {<mat-option [value]="a.id">{{ a.name }}</mat-option>}</mat-select>
          @if (form.controls.account.invalid && form.controls.account.touched) {<mat-error>Compte requis</mat-error>}</mat-form-field>}
        <mat-form-field appearance="outline"><mat-label>Mode de règlement</mat-label><mat-select formControlName="method">@for (m of methods; track m.key) {<mat-option [value]="m.key">{{ m.label }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" formControlName="paidAt" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Référence (n° chèque, virement…)</mat-label><input matInput formControlName="reference" /></mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="loading()">Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: `.c{display:flex;flex-direction:column;min-width:min(420px,84vw)}`,
})
export class PaymentDialog {
  data = inject<{ invoiceId: string; number: string; dueMinor: number }>(MAT_DIALOG_DATA); private ref_ = inject(MatDialogRef<PaymentDialog>); private svc = inject(SalesService); private api = inject(Api); ref = inject(ReferenceDataService);
  methods = Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => ({ key, label }));
  form = new FormBuilder().nonNullable.group({
    amount: [this.ref.fromMinor(this.data.dueMinor), [Validators.required, Validators.min(1 / 10 ** this.ref.decimals()), Validators.max(this.ref.fromMinor(this.data.dueMinor))]],
    method: ['transfer'], account: [''], paidAt: [new Date().toISOString().slice(0, 10), Validators.required], reference: [''],
  });
  loading = signal(false); error = signal(''); accounts = signal<{ id: string; name: string }[]>([]);
  ngOnInit() { this.api.get('/treasury/accounts', { active: true }).subscribe({ next: (a) => { this.accounts.set(a); if (a.length) this.form.controls.account.addValidators(Validators.required); if (a.length === 1) this.form.controls.account.setValue(a[0].id); this.form.controls.account.updateValueAndValidity(); }, error: () => undefined }); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.loading.set(true);
    this.svc.recordPayment(this.data.invoiceId, { amountMinor: this.ref.toMinor(Number(v.amount)), method: v.method, paidAt: v.paidAt, ...(v.reference && { reference: v.reference }), ...(v.account && { treasuryAccountId: v.account }) })
      .subscribe({ next: (r) => this.ref_.close(r), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}
