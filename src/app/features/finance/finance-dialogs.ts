import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Api } from '../../core/services/api.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { PAYMENT_METHOD_LABELS } from '../sales/sales.models';

const COL = 'display:flex;flex-direction:column;min-width:min(440px,84vw)';
export const METHODS = Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => ({ key, label }));

/** Compte de trésorerie : création / modification. */
@Component({
  selector: 'app-account-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `<h2 mat-dialog-title>{{ data ? 'Modifier le compte' : 'Nouveau compte de trésorerie' }}</h2>
    <form [formGroup]="form"><mat-dialog-content [style]="col">
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      <mat-form-field appearance="outline"><mat-label>Type</mat-label><mat-select formControlName="type"><mat-option value="bank">Banque</mat-option><mat-option value="cash">Caisse</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Code</mat-label><input matInput formControlName="code" />@if (form.controls.code.invalid && form.controls.code.touched) {<mat-error>Requis (lettres, chiffres, . _ -)</mat-error>}</mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Libellé</mat-label><input matInput formControlName="name" /></mat-form-field>
      @if (form.controls.type.value === 'bank') {<mat-form-field appearance="outline"><mat-label>Banque</mat-label><input matInput formControlName="bankName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>IBAN / RIB</mat-label><input matInput formControlName="iban" /></mat-form-field>}
      <mat-form-field appearance="outline"><mat-label>Code comptable (facultatif)</mat-label><input matInput formControlName="accountCode" /><mat-hint>Saisi par votre comptable : aucun code n’est imposé</mat-hint></mat-form-field>
      <mat-form-field appearance="outline" style="margin-top:8px"><mat-label>Solde d’ouverture ({{ ref.symbol() }})</mat-label><input matInput type="number" [step]="1 / 10 ** ref.decimals()" formControlName="opening" />
        @if (data) {<mat-hint>Modifiable tant que le compte n’a aucun mouvement</mat-hint>}</mat-form-field>
      <mat-slide-toggle formControlName="allowNegative" style="margin-top:12px">Autoriser le découvert (solde négatif)</mat-slide-toggle></mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" type="button" (click)="save()">Enregistrer</button></mat-dialog-actions></form>`,
})
export class AccountDialog {
  data = inject<any | null>(MAT_DIALOG_DATA); private dlg = inject(MatDialogRef<AccountDialog>); private api = inject(Api); ref = inject(ReferenceDataService); col = COL; error = signal('');  
  form = new FormBuilder().nonNullable.group({ type: [this.data?.type ?? 'bank'], code: [this.data?.code ?? '', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]+$/)]], name: [this.data?.name ?? '', [Validators.required, Validators.minLength(2)]],
    bankName: [this.data?.bankName ?? ''], iban: [this.data?.iban ?? ''], accountCode: [this.data?.accountCode ?? ''], opening: [this.ref.fromMinor(this.data?.openingBalanceMinor ?? 0)], allowNegative: [this.data?.allowNegative ?? false] });
  constructor() { if (this.data) this.form.controls.type.disable(); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; } const v = this.form.getRawValue();
    const body = { code: v.code, name: v.name, bankName: v.type === 'bank' && v.bankName ? v.bankName : undefined, iban: v.type === 'bank' && v.iban ? v.iban : undefined, accountCode: v.accountCode || undefined, openingBalanceMinor: this.ref.toMinor(Number(v.opening)), allowNegative: v.allowNegative };
    (this.data ? this.api.put(`/treasury/accounts/${this.data.id}`, body) : this.api.post('/treasury/accounts', { ...body, type: v.type })).subscribe({ next: (r) => this.dlg.close(r), error: (e) => this.error.set(errorMessage(e)) });
  }
}

/** Virement interne entre deux comptes (banque ↔ caisse…). */
@Component({
  selector: 'app-transfer-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `<h2 mat-dialog-title>Virement interne</h2>
    <form [formGroup]="form"><mat-dialog-content [style]="col">
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      <mat-form-field appearance="outline"><mat-label>Compte source</mat-label><mat-select formControlName="from">@for (a of data.accounts; track a.id) {<mat-option [value]="a.id">{{ a.name }} ({{ ref.format(a.balanceMinor) }})</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Compte destination</mat-label><mat-select formControlName="to">@for (a of data.accounts; track a.id) {<mat-option [value]="a.id" [disabled]="a.id === form.controls.from.value">{{ a.name }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Montant ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="1 / 10 ** ref.decimals()" formControlName="amount" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" [max]="today" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Note</mat-label><input matInput formControlName="note" /></mat-form-field></mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="loading()" (click)="save()">Effectuer le virement</button></mat-dialog-actions></form>`,
})
export class TransferDialog {
  data = inject<{ accounts: any[] }>(MAT_DIALOG_DATA); private dlg = inject(MatDialogRef<TransferDialog>); private api = inject(Api); ref = inject(ReferenceDataService); col = COL; error = signal(''); loading = signal(false); today = new Date().toISOString().slice(0, 10);  
  form = new FormBuilder().nonNullable.group({ from: ['', Validators.required], to: ['', Validators.required], amount: [0, [Validators.required, Validators.min(1 / 10 ** this.ref.decimals())]], date: [this.today, Validators.required], note: [''] });
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; } const v = this.form.getRawValue(); this.loading.set(true);
    this.api.post('/treasury/transfers', { fromAccountId: v.from, toAccountId: v.to, amountMinor: this.ref.toMinor(Number(v.amount)), date: v.date, ...(v.note && { note: v.note }) }).subscribe({ next: (r) => this.dlg.close(r), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}

/** Règlement d'un fournisseur : affectation (partielle ou groupée) aux factures d'achat validées restant dues. */
@Component({
  selector: 'app-pay-supplier-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `<h2 mat-dialog-title>Régler un fournisseur</h2>
    <form [formGroup]="form"><mat-dialog-content [style]="col">
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      @if (!data.supplierId) {<mat-form-field appearance="outline"><mat-label>Fournisseur</mat-label><mat-select formControlName="supplier" (selectionChange)="pickSupplier($event.value)">@for (s of suppliers(); track s.id) {<mat-option [value]="s.id">{{ s.name }} — dû {{ ref.format(s.balanceMinor) }}</mat-option>}</mat-select></mat-form-field>}
      @else {<p class="muted">Fournisseur : <strong>{{ data.supplierName }}</strong></p>}
      <mat-form-field appearance="outline"><mat-label>Compte de trésorerie</mat-label><mat-select formControlName="account">@for (a of accounts(); track a.id) {<mat-option [value]="a.id">{{ a.name }} ({{ ref.format(a.balanceMinor) }})</mat-option>}</mat-select>@if (form.controls.account.invalid && form.controls.account.touched) {<mat-error>Requis</mat-error>}</mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Mode de règlement</mat-label><mat-select formControlName="method">@for (m of methods; track m.key) {<mat-option [value]="m.key">{{ m.label }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" formControlName="paidAt" [max]="today" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Référence (n° chèque, virement…)</mat-label><input matInput formControlName="reference" /></mat-form-field>
      <strong>Affectation aux factures</strong>
      @if (!invoices().length) {<p class="muted">Aucune facture d’achat validée restant due.</p>}
      @for (i of invoices(); track i.id) {<div style="display:flex;gap:10px;align-items:center;margin-top:8px"><div style="flex:1"><strong>{{ i.number }}</strong> <span class="muted">({{ i.supplierInvoiceNumber }})</span><br><span class="muted">Reste dû {{ ref.format(i.balanceDueMinor) }}</span></div>
        <mat-form-field appearance="outline" style="width:150px" subscriptSizing="dynamic"><mat-label>Montant</mat-label><input matInput type="number" min="0" [step]="1 / 10 ** ref.decimals()" [value]="amounts()[i.id] ?? ''" (input)="setAmount(i, $any($event.target).value)" /></mat-form-field></div>}
      <p style="margin-top:12px"><strong>Total : {{ ref.format(total()) }}</strong></p></mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="loading() || total() <= 0" (click)="save()">Enregistrer le règlement</button></mat-dialog-actions></form>`,
})
export class PaySupplierDialog {
  data = inject<{ supplierId?: string; supplierName?: string; invoice?: any }>(MAT_DIALOG_DATA); private dlg = inject(MatDialogRef<PaySupplierDialog>); private api = inject(Api); ref = inject(ReferenceDataService); col = COL; methods = METHODS;  
  error = signal(''); loading = signal(false); today = new Date().toISOString().slice(0, 10); accounts = signal<any[]>([]); suppliers = signal<any[]>([]); invoices = signal<any[]>([]); amounts = signal<Record<string, number>>({});  
  form = new FormBuilder().nonNullable.group({ supplier: [this.data.supplierId ?? ''], account: ['', Validators.required], method: ['transfer'], paidAt: [this.today, Validators.required], reference: [''] });
  total = () => Object.values(this.amounts()).reduce((s, v) => s + v, 0);
  ngOnInit() {
    this.api.get('/treasury/accounts', { active: true }).subscribe((a) => { this.accounts.set(a); if (a.length === 1) this.form.controls.account.setValue(a[0].id); });
    if (this.data.supplierId) this.pickSupplier(this.data.supplierId); else this.api.get('/suppliers', { limit: 100, withBalance: true }).subscribe((r) => this.suppliers.set(r.items));
  }
  pickSupplier(id: string) {
    this.amounts.set({});
    this.api.get('/purchase-invoices', { supplierId: id, status: 'validated', limit: 100, sort: 'invoiceDate' }).subscribe((r) => {
      const open = r.items.filter((i: any) => (i.balanceDueMinor ?? 0) > 0); this.invoices.set(open);  
      if (this.data.invoice) { const i = open.find((x: any) => x.id === this.data.invoice.id); if (i) this.amounts.set({ [i.id]: i.balanceDueMinor }); }  
    });
  }
  setAmount(i: { id: string }, raw: string) { const m = this.ref.toMinor(Number(raw)); this.amounts.update((a) => { const n = { ...a }; if (m > 0) n[i.id] = m; else delete n[i.id]; return n; }); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; } const v = this.form.getRawValue(); this.loading.set(true);
    this.api.post('/supplier-payments', { supplierId: this.data.supplierId ?? v.supplier, treasuryAccountId: v.account, method: v.method, paidAt: v.paidAt, ...(v.reference && { reference: v.reference }),
      allocations: Object.entries(this.amounts()).map(([purchaseInvoiceId, amountMinor]) => ({ purchaseInvoiceId, amountMinor })) }).subscribe({ next: (r) => this.dlg.close(r), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}
