import { Component, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../../core/services/api.service';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeader } from '../../../shared/components/page-header';
import { Skeleton } from '../../../shared/components/skeleton';
import { LineGroup, LinesEditor, PartyPicker, lineGroup } from '../lines-editor';

const iso = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const today = () => new Date().toISOString().slice(0, 10);

/** Commande d'achat : fournisseur local, lignes avec prix d'achat, remise, TVA. Montants calculés par le serveur à l'enregistrement. */
@Component({
  selector: 'app-order-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, PageHeader, Skeleton, LinesEditor, PartyPicker],
  template: `
    <div class="page"><app-page-header [title]="id() ? 'Modifier la commande d’achat' : 'Nouvelle commande d’achat'" subtitle="Fournisseurs locaux. Les fournisseurs étrangers passent par un dossier d’importation." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card err" role="alert">{{ error() }}</div>}
        <div class="card sec"><div class="form-grid">
          <app-party-picker label="Fournisseur" endpoint="/suppliers" [extra]="{ foreign: false }" [initial]="supplierInit()" (picked)="supplierId.set($event)" />
          <mat-form-field appearance="outline"><mat-label>Date de commande</mat-label><input matInput type="date" formControlName="orderDate" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Livraison prévue</mat-label><input matInput type="date" formControlName="expectedDate" /></mat-form-field></div></div>
        <div class="card sec"><h3>Lignes</h3><app-lines-editor [array]="lines" [opts]="{ price: true, discount: true, vat: true, priceLabel: 'Prix d’achat HT' }" /></div>
        <div class="card sec"><mat-form-field appearance="outline" style="width:100%"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button [routerLink]="id() ? ['/purchase-orders', id()] : ['/purchase-orders']">Annuler</a><button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}</div>`,
  styles: `.sec{margin-bottom:16px}h3{margin:0 0 12px;font-size:16px}.err{color:var(--danger);margin-bottom:16px}`,
})
export class OrderForm {
  id = input<string>();
  private api = inject(Api); private fb = inject(FormBuilder); private router = inject(Router); private toast = inject(ToastService); private ref = inject(ReferenceDataService);
  supplierId = signal(''); supplierInit = signal<{ id: string; name: string } | null>(null); lines: FormArray<LineGroup> = this.fb.array<LineGroup>([]);
  form = this.fb.nonNullable.group({ orderDate: [today()], expectedDate: [''], notes: [''], lines: this.lines });
  loading = signal(false); saving = signal(false); error = signal('');
  ngOnInit() {
    this.ref.load$().subscribe(); const id = this.id(); if (!id) return; this.loading.set(true);
    this.api.get(`/purchase-orders/${id}`).subscribe({ next: (o) => {
      if (!o.editable) { this.toast.error('Seule une commande en brouillon est modifiable'); this.router.navigate(['/purchase-orders', id]); return; }
      this.supplierId.set(o.supplierId); this.supplierInit.set({ id: o.supplierId, name: o.supplier?.name }); this.form.patchValue({ orderDate: iso(o.orderDate), expectedDate: iso(o.expectedDate), notes: o.notes ?? '' });
      o.lines.forEach((l: any) => this.lines.push(lineGroup(this.fb, { productId: l.productId ?? '', reference: l.reference ?? '', designation: l.designation, quantity: l.quantity, unitPrice: this.ref.fromMinor(l.unitPriceMinor), discountPct: l.discountPct, vatCode: l.vat?.code })));  
      this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/purchase-orders']); } });
  }
  save() {
    this.error.set(''); if (!this.supplierId()) { this.error.set('Sélectionnez un fournisseur.'); return; } if (!this.lines.length || this.lines.invalid) { this.error.set('Ajoutez au moins une ligne valide.'); return; }
    const v = this.form.getRawValue(); this.saving.set(true);
    const body = { supplierId: this.supplierId(), orderDate: v.orderDate || undefined, expectedDate: v.expectedDate || undefined, notes: v.notes || undefined,
      lines: this.lines.getRawValue().map((l) => ({ ...(l.productId && { productId: l.productId }), designation: l.designation, quantity: Number(l.quantity), unitPriceMinor: this.ref.toMinor(Number(l.unitPrice)), discountPct: Number(l.discountPct) || 0, ...(l.vatCode && { vatCode: l.vatCode }) })) };
    const id = this.id(); (id ? this.api.put(`/purchase-orders/${id}`, body) : this.api.post('/purchase-orders', body)).subscribe({ next: (o) => { this.toast.success('Commande enregistrée'); this.router.navigate(['/purchase-orders', o.id]); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } });
  }
}

/** Réception de marchandises : depuis une commande (quantités à recevoir, magasin, séries). */
@Component({
  selector: 'app-receipt-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, PageHeader, Skeleton],
  template: `
    <div class="page"><app-page-header title="Nouvelle réception" [subtitle]="order() ? 'Commande ' + order().number + ' — ' + order().supplier?.name : ''" />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card err" role="alert">{{ error() }}</div>}
        <div class="card sec"><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Magasin de réception</mat-label><mat-select formControlName="warehouseId">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select>
            @if (form.controls.warehouseId.invalid && form.controls.warehouseId.touched) {<mat-error>Magasin requis (créez-en dans Stock › Magasins)</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Date de réception</mat-label><input matInput type="date" formControlName="receiptDate" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>N° du bon de livraison fournisseur</mat-label><input matInput formControlName="deliveryNoteRef" /></mat-form-field></div></div>
        <div class="card sec"><h3>Quantités reçues</h3><div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Commandé</th><th class="r">Déjà reçu</th><th class="r">Reste</th><th class="r">Reçu maintenant</th><th>N° de série (un par ligne)</th></tr></thead>
          <tbody formArrayName="rows">@for (g of rows.controls; track $index; let i = $index) {<tr [formGroupName]="i"><td>{{ info[i]?.designation }}</td><td class="r">{{ info[i]?.quantity }}</td><td class="r">{{ info[i]?.receivedQty }}</td><td class="r">{{ info[i]?.remainingQty }}</td>
            <td class="r"><input class="q" type="number" min="0" [max]="info[i]?.remainingQty" step="0.001" formControlName="quantity" aria-label="Quantité reçue" /></td><td><textarea rows="1" formControlName="serials" aria-label="Numéros de série"></textarea></td></tr>}</tbody></table></div>
          <p class="muted">Réception partielle possible : le reste pourra être reçu plus tard. L’entrée en stock a lieu à la validation.</p></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button routerLink="/goods-receipts">Annuler</a><button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}</div>`,
  styles: `.sec{margin-bottom:16px}h3{margin:0 0 12px;font-size:16px}.err{color:var(--danger);margin-bottom:16px}.lines{width:100%;border-collapse:collapse;min-width:640px}.lines th,.lines td{padding:6px 8px;border-bottom:1px solid var(--erp-border);text-align:left}.r{text-align:right!important}.q{width:90px;text-align:right;font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px}textarea{font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px;width:100%}`,
})
export class ReceiptForm {
  id = input<string>(); orderId = input<string | undefined>(undefined, { alias: 'orderId' });
  private api = inject(Api); private fb = inject(FormBuilder); private router = inject(Router); private toast = inject(ToastService);
  rows = this.fb.array([] as ReturnType<ReceiptForm['row']>[]); info: any[] = []; order = signal<any>(null); warehouses = signal<{ id: string; code: string; name: string; isDefault: boolean }[]>([]);  
  form = this.fb.nonNullable.group({ warehouseId: ['', Validators.required], receiptDate: [today()], deliveryNoteRef: [''], rows: this.rows });
  loading = signal(true); saving = signal(false); error = signal('');
  row(q = 0, serials = '') { return this.fb.nonNullable.group({ quantity: [q, [Validators.min(0)]], serials: [serials] }); }
  ngOnInit() {
    this.api.get('/warehouses').subscribe((w) => { this.warehouses.set(w.filter((x: { isActive: boolean }) => x.isActive)); const d = w.find((x: { isDefault: boolean }) => x.isDefault); if (d && !this.form.controls.warehouseId.value) this.form.controls.warehouseId.setValue(d.id); });
    const id = this.id();
    const load = (orderId: string, cur?: Record<string, { quantity: number; serials: string[] }>) => this.api.get(`/purchase-orders/${orderId}`).subscribe({ next: (o) => {
      this.order.set(o); this.info = o.lines.filter((l: any) => l.productId && (cur?.[l.id] || l.remainingQty > 0)).map((l: any) => ({ ...l, remainingQty: cur?.[l.id] ? l.remainingQty : l.remainingQty }));  
      this.info.forEach((l) => this.rows.push(this.row(cur?.[l.id]?.quantity ?? l.remainingQty, (cur?.[l.id]?.serials ?? []).join('\n')))); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/goods-receipts']); } });
    if (id) this.api.get(`/goods-receipts/${id}`).subscribe((r) => { this.form.patchValue({ warehouseId: r.warehouseId, receiptDate: iso(r.receiptDate), deliveryNoteRef: r.deliveryNoteRef ?? '' }); load(r.purchaseOrderId, Object.fromEntries(r.lines.map((l: any) => [l.orderLineId, { quantity: l.quantity, serials: l.serials }]))); });  
    else if (this.orderId()) load(this.orderId()!); else { this.toast.error('Choisissez une commande depuis sa fiche (bouton « Réceptionner »).'); this.router.navigate(['/purchase-orders']); }
  }
  save() {
    this.error.set(''); if (this.form.controls.warehouseId.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); const lines = this.info.map((l, i) => ({ orderLineId: l.id, quantity: Number(v.rows[i]!.quantity), serials: v.rows[i]!.serials.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) })).filter((l) => l.quantity > 0).map((l) => ({ ...l, ...(l.serials.length ? {} : { serials: undefined }) }));
    if (!lines.length) { this.error.set('Indiquez au moins une quantité reçue.'); return; }
    this.saving.set(true); const body = { purchaseOrderId: this.order().id, warehouseId: v.warehouseId, receiptDate: v.receiptDate, deliveryNoteRef: v.deliveryNoteRef || undefined, lines }; const id = this.id();
    (id ? this.api.put(`/goods-receipts/${id}`, body) : this.api.post('/goods-receipts', body)).subscribe({ next: (r) => { this.toast.success('Réception enregistrée'); this.router.navigate(['/goods-receipts', r.id]); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } });
  }
}

/** Facture d'achat : saisie du n° fournisseur, lignes (pré-remplies depuis la commande : quantités reçues non facturées). */
@Component({
  selector: 'app-purchase-invoice-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, PageHeader, Skeleton, LinesEditor, PartyPicker],
  template: `
    <div class="page"><app-page-header [title]="id() ? 'Modifier la facture d’achat' : 'Nouvelle facture d’achat'" subtitle="Contrôle à la validation : on ne facture pas plus que reçu ; les écarts de prix sont consignés." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card err" role="alert">{{ error() }}</div>}
        <div class="card sec"><div class="form-grid">
          <app-party-picker label="Fournisseur" endpoint="/suppliers" [readonly]="!!orderId()" [initial]="supplierInit()" (picked)="supplierId.set($event)" />
          <mat-form-field appearance="outline"><mat-label>N° de la facture fournisseur</mat-label><input matInput formControlName="supplierInvoiceNumber" />@if (form.controls.supplierInvoiceNumber.invalid && form.controls.supplierInvoiceNumber.touched) {<mat-error>Requis</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Date de facture</mat-label><input matInput type="date" formControlName="invoiceDate" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Échéance</mat-label><input matInput type="date" formControlName="dueDate" /></mat-form-field></div></div>
        <div class="card sec"><h3>Lignes</h3><app-lines-editor [array]="lines" [opts]="{ price: true, discount: true, vat: true, priceLabel: 'Prix facturé HT' }" /></div>
        <div class="card sec"><mat-form-field appearance="outline" style="width:100%"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button routerLink="/purchase-invoices">Annuler</a><button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}</div>`,
  styles: `.sec{margin-bottom:16px}h3{margin:0 0 12px;font-size:16px}.err{color:var(--danger);margin-bottom:16px}`,
})
export class PurchaseInvoiceForm {
  id = input<string>(); orderId = input<string | undefined>(undefined, { alias: 'orderId' });
  private api = inject(Api); private fb = inject(FormBuilder); private router = inject(Router); private toast = inject(ToastService); private ref = inject(ReferenceDataService);
  supplierId = signal(''); supplierInit = signal<{ id: string; name: string } | null>(null); lines: FormArray<LineGroup> = this.fb.array<LineGroup>([]); poId = '';
  form = this.fb.nonNullable.group({ supplierInvoiceNumber: ['', Validators.required], invoiceDate: [today()], dueDate: [''], notes: [''], lines: this.lines });
  loading = signal(false); saving = signal(false); error = signal('');
  ngOnInit() {
    this.ref.load$().subscribe(); const id = this.id(); const oid = this.orderId();
    const fill = (lines: any[], supplierId: string, poId: string, name?: string) => { this.supplierId.set(supplierId); if (name) this.supplierInit.set({ id: supplierId, name }); this.poId = poId ?? ''; lines.forEach((l) => this.lines.push(lineGroup(this.fb, { productId: l.productId ?? '', designation: l.designation, quantity: l.quantity, unitPrice: this.ref.fromMinor(l.unitPriceMinor), discountPct: l.discountPct ?? 0, vatCode: l.vatCode ?? l.vat?.code, orderLineId: l.orderLineId ?? '' }))); this.loading.set(false); };  
    if (id) { this.loading.set(true); this.api.get(`/purchase-invoices/${id}`).subscribe({ next: (i) => { if (!i.editable) { this.router.navigate(['/purchase-invoices', id]); return; } this.form.patchValue({ supplierInvoiceNumber: i.supplierInvoiceNumber, invoiceDate: iso(i.invoiceDate), dueDate: iso(i.dueDate), notes: i.notes ?? '' }); fill(i.lines, i.supplierId, i.purchaseOrderId, i.supplier?.name); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/purchase-invoices']); } }); }
    else if (oid) { this.loading.set(true); this.api.get(`/purchase-invoices/from-order/${oid}`).subscribe({ next: (d) => { if (!d.lines.length) { this.toast.error('Rien à facturer : les quantités reçues sont déjà facturées.'); this.router.navigate(['/purchase-orders', oid]); return; } this.api.get(`/suppliers/${d.supplierId}`).subscribe((sp) => this.supplierInit.set({ id: sp.id, name: sp.name })); fill(d.lines, d.supplierId, oid); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/purchase-orders']); } }); }
  }
  save() {
    this.error.set(''); if (!this.supplierId()) { this.error.set('Sélectionnez un fournisseur.'); return; } if (this.form.controls.supplierInvoiceNumber.invalid) { this.form.markAllAsTouched(); return; } if (!this.lines.length || this.lines.invalid) { this.error.set('Ajoutez au moins une ligne valide.'); return; }
    const v = this.form.getRawValue(); this.saving.set(true);
    const body = { supplierId: this.supplierId(), ...(this.poId && { purchaseOrderId: this.poId }), supplierInvoiceNumber: v.supplierInvoiceNumber, invoiceDate: v.invoiceDate || undefined, dueDate: v.dueDate || undefined, notes: v.notes || undefined,
      lines: this.lines.getRawValue().map((l) => ({ ...(l.productId && { productId: l.productId }), ...(l.orderLineId && { orderLineId: l.orderLineId }), designation: l.designation, quantity: Number(l.quantity), unitPriceMinor: this.ref.toMinor(Number(l.unitPrice)), discountPct: Number(l.discountPct) || 0, ...(l.vatCode && { vatCode: l.vatCode }) })) };
    const id = this.id(); (id ? this.api.put(`/purchase-invoices/${id}`, body) : this.api.post('/purchase-invoices', body)).subscribe({ next: (i) => { this.toast.success('Facture d’achat enregistrée'); this.router.navigate(['/purchase-invoices', i.id]); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } });
  }
}
