import { Component, computed, inject, input, signal } from '@angular/core';
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
import { AddressSelect } from '../../../shared/components/address-select';
import { PageHeader } from '../../../shared/components/page-header';
import { AddressSnapshot, SupplierDto } from '../../../shared/models/api.models';
import { Skeleton } from '../../../shared/components/skeleton';
import { LineGroup, LinesEditor, PartyPicker, lineGroup } from '../lines-editor';

interface Warehouse { id: string; code: string; name: string; address?: string | null; isDefault: boolean; isActive: boolean }
interface ReceivingAddress { warehouseId: string | null; name: string; address?: string | null }
const ADDRESS_STYLES = `.addr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:20px;align-items:start}h4{margin:0 0 8px;font-size:13px;font-weight:600;color:var(--text-2)}.full{width:100%}
  .ours{display:flex;flex-direction:column;gap:2px;margin-top:8px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--r-md);background:var(--accent-50);font-size:14px;overflow-wrap:anywhere}`;
const iso = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const today = () => new Date().toISOString().slice(0, 10);

/** Commande d'achat : fournisseur local, lignes avec prix d'achat, remise, TVA. Montants calculés par le serveur à l'enregistrement. */
@Component({
  selector: 'app-order-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, PageHeader, Skeleton, LinesEditor, PartyPicker, AddressSelect],
  template: `
    <div class="page"><app-page-header [title]="id() ? 'Modifier la commande d’achat' : 'Nouvelle commande d’achat'" subtitle="Fournisseurs locaux. Les fournisseurs étrangers passent par un dossier d’importation." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card err" role="alert">{{ error() }}</div>}
        <div class="card sec"><div class="form-grid">
          <app-party-picker label="Fournisseur" endpoint="/suppliers" [extra]="{ foreign: false }" [initial]="supplierInit()" (picked)="pickSupplier($event)" />
          <mat-form-field appearance="outline"><mat-label>Date de commande</mat-label><input matInput type="date" formControlName="orderDate" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Livraison prévue</mat-label><input matInput type="date" formControlName="expectedDate" /></mat-form-field></div></div>
        <div class="card sec"><h3>Adresses</h3><div class="addr-grid">
          <section><h4>Adresse du fournisseur</h4>
            @if (supplierId()) {<app-address-select label="Adresse du fournisseur" noneLabel="Aucune (adresse principale)" [addresses]="supplier()?.deliveryAddresses ?? []" [current]="currentAddress()" [(value)]="addressId" />}
            @else {<p class="muted">Sélectionnez un fournisseur.</p>}</section>
          <section><h4>Adresse de réception (notre entreprise)</h4>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full"><mat-label>Magasin de réception</mat-label>
              <mat-select [value]="warehouseId()" (selectionChange)="pickWarehouse($event.value)"><mat-option value="">Non précisé</mat-option>@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
            @if (receiving(); as r) {<div class="ours"><strong>{{ r.name }}</strong><span>{{ r.address || 'Adresse non renseignée (Stock › Magasins)' }}</span></div>}</section>
        </div></div>
        <div class="card sec"><h3>Lignes</h3><app-lines-editor [array]="lines" [opts]="{ price: true, discount: true, vat: true, priceLabel: 'Prix d’achat HT' }" /></div>
        <div class="card sec"><mat-form-field appearance="outline" style="width:100%"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button [routerLink]="id() ? ['/purchase-orders', id()] : ['/purchase-orders']">Annuler</a><button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}</div>`,
  styles: `.sec{margin-bottom:16px}h3{margin:0 0 12px;font-size:16px}.err{color:var(--danger);margin-bottom:16px}${ADDRESS_STYLES}`,
})
export class OrderForm {
  id = input<string>();
  private api = inject(Api); private fb = inject(FormBuilder); private router = inject(Router); private toast = inject(ToastService); private ref = inject(ReferenceDataService);
  supplierId = signal(''); supplierInit = signal<{ id: string; name: string } | null>(null); lines: FormArray<LineGroup> = this.fb.array<LineGroup>([]);
  form = this.fb.nonNullable.group({ orderDate: [today()], expectedDate: [''], notes: [''], lines: this.lines });
  loading = signal(false); saving = signal(false); error = signal('');
  // Adresses : celle du fournisseur (copiée sur la commande) et le magasin qui réceptionne
  supplier = signal<SupplierDto | null>(null); addressId = signal(''); currentAddress = signal<AddressSnapshot | null>(null);
  warehouses = signal<Warehouse[]>([]); warehouseId = signal(''); currentReceiving = signal<ReceivingAddress | null>(null);
  private keptAddress: string | undefined; private addressReady = false; private keptWarehouse: string | undefined; private warehouseTouched = false;
  receiving = computed(() => { const id = this.warehouseId(); if (!id) return null; const c = this.currentReceiving(); return c?.warehouseId === id ? c : this.warehouses().find((w) => w.id === id) ?? null; });
  pickWarehouse(v: string) { this.warehouseId.set(v); this.warehouseTouched = true; }
  pickSupplier(id: string) {
    this.supplierId.set(id); this.supplier.set(null); this.currentAddress.set(null); this.addressId.set(''); this.keptAddress = undefined; this.addressReady = false;
    if (id) this.loadSupplier(id, true);
  }
  private loadSupplier(id: string, useDefault: boolean) {
    this.api.get<SupplierDto>(`/suppliers/${id}`).subscribe({ next: (s) => {
      if (this.supplierId() !== id) return; this.supplier.set(s);
      if (useDefault) { this.addressId.set(s.deliveryAddresses.find((a) => a.isDefault && !a.archived)?.id ?? ''); this.addressReady = true; }
    }, error: () => undefined }); // sans « fournisseurs : consulter », le serveur applique l'adresse par défaut
  }
  ngOnInit() {
    this.ref.load$().subscribe(); const id = this.id();
    this.api.get<Warehouse[]>('/warehouses').subscribe((w) => {
      this.warehouses.set(w.filter((x) => x.isActive));
      if (!this.id() && !this.warehouseTouched) this.warehouseId.set(w.find((x) => x.isActive && x.isDefault)?.id ?? '');
    });
    if (!id) return; this.loading.set(true);
    this.api.get(`/purchase-orders/${id}`).subscribe({ next: (o) => {
      if (!o.editable) { this.toast.error('Seule une commande en brouillon est modifiable'); this.router.navigate(['/purchase-orders', id]); return; }
      this.currentAddress.set(o.supplierAddress); this.addressId.set(o.supplierAddress?.addressId ?? ''); this.keptAddress = o.supplierAddress?.addressId ?? ''; this.addressReady = true;
      this.currentReceiving.set(o.receivingAddress); this.warehouseId.set(o.receivingAddress?.warehouseId ?? ''); this.keptWarehouse = o.receivingAddress?.warehouseId ?? '';
      this.supplierId.set(o.supplierId); this.loadSupplier(o.supplierId, false); this.supplierInit.set({ id: o.supplierId, name: o.supplier?.name }); this.form.patchValue({ orderDate: iso(o.orderDate), expectedDate: iso(o.expectedDate), notes: o.notes ?? '' });
      o.lines.forEach((l: any) => this.lines.push(lineGroup(this.fb, { productId: l.productId ?? '', reference: l.reference ?? '', designation: l.designation, quantity: l.quantity, unitPrice: this.ref.fromMinor(l.unitPriceMinor), discountPct: l.discountPct, vatCode: l.vat?.code })));  
      this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/purchase-orders']); } });
  }
  save() {
    this.error.set(''); if (!this.supplierId()) { this.error.set('Sélectionnez un fournisseur.'); return; } if (!this.lines.length || this.lines.invalid) { this.error.set('Ajoutez au moins une ligne valide.'); return; }
    const v = this.form.getRawValue(); this.saving.set(true);
    const addresses = {
      ...(this.addressReady && this.addressId() !== this.keptAddress && { supplierAddressId: this.addressId() || null }),
      // Nouvelle commande sans choix explicite : le serveur retient le magasin par défaut
      ...((this.id() ? this.warehouseId() !== this.keptWarehouse : this.warehouseTouched || !!this.warehouseId()) && { receivingWarehouseId: this.warehouseId() || null }),
    };
    const body = { ...addresses, supplierId: this.supplierId(), orderDate: v.orderDate || undefined, expectedDate: v.expectedDate || undefined, notes: v.notes || undefined,
      lines: this.lines.getRawValue().map((l) => ({ ...(l.productId && { productId: l.productId }), designation: l.designation, quantity: Number(l.quantity), unitPriceMinor: this.ref.toMinor(Number(l.unitPrice)), discountPct: Number(l.discountPct) || 0, ...(l.vatCode && { vatCode: l.vatCode }) })) };
    const id = this.id(); (id ? this.api.put(`/purchase-orders/${id}`, body) : this.api.post('/purchase-orders', body)).subscribe({ next: (o) => { this.toast.success('Commande enregistrée'); this.router.navigate(['/purchase-orders', o.id]); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } });
  }
}

/** Réception de marchandises : depuis une commande (quantités à recevoir, magasin, séries). */
@Component({
  selector: 'app-receipt-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, PageHeader, Skeleton, AddressSelect],
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
        <div class="card sec"><h3>Adresses</h3><div class="addr-grid">
          <section><h4>Adresse du fournisseur</h4><app-address-select label="Adresse du fournisseur" noneLabel="Aucune (adresse principale)" [addresses]="supplier()?.deliveryAddresses ?? []" [current]="currentAddress()" [(value)]="addressId" /></section>
          <section><h4>Adresse de réception (notre entreprise)</h4>
            @if (receiving(); as r) {<div class="ours"><strong>{{ r.name }}</strong><span>{{ r.address || 'Adresse non renseignée (Stock › Magasins)' }}</span></div>}
            @else {<p class="muted">Choisissez le magasin de réception ci-dessus.</p>}</section>
        </div></div>
        <div class="card sec"><h3>Quantités reçues</h3><div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Commandé</th><th class="r">Déjà reçu</th><th class="r">Reste</th><th class="r">Reçu maintenant</th><th>N° de série (un par ligne)</th></tr></thead>
          <tbody formArrayName="rows">@for (g of rows.controls; track $index; let i = $index) {<tr [formGroupName]="i"><td>{{ info[i]?.designation }}</td><td class="r">{{ info[i]?.quantity }}</td><td class="r">{{ info[i]?.receivedQty }}</td><td class="r">{{ info[i]?.remainingQty }}</td>
            <td class="r"><input class="q" type="number" min="0" [max]="info[i]?.remainingQty" step="0.001" formControlName="quantity" aria-label="Quantité reçue" /></td><td><textarea rows="1" formControlName="serials" aria-label="Numéros de série"></textarea></td></tr>}</tbody></table></div>
          <p class="muted">Réception partielle possible : le reste pourra être reçu plus tard. L’entrée en stock a lieu à la validation.</p></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button routerLink="/goods-receipts">Annuler</a><button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}</div>`,
  styles: `.sec{margin-bottom:16px}h3{margin:0 0 12px;font-size:16px}.err{color:var(--danger);margin-bottom:16px}.lines{width:100%;border-collapse:collapse;min-width:640px}.lines th,.lines td{padding:6px 8px;border-bottom:1px solid var(--erp-border);text-align:left}.r{text-align:right!important}.q{width:90px;text-align:right;font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px}textarea{font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px;width:100%}${ADDRESS_STYLES}`,
})
export class ReceiptForm {
  id = input<string>(); orderId = input<string | undefined>(undefined, { alias: 'orderId' });
  private api = inject(Api); private fb = inject(FormBuilder); private router = inject(Router); private toast = inject(ToastService);
  rows = this.fb.array([] as ReturnType<ReceiptForm['row']>[]); info: any[] = []; order = signal<any>(null); warehouses = signal<Warehouse[]>([]);
  supplier = signal<SupplierDto | null>(null); addressId = signal(''); currentAddress = signal<AddressSnapshot | null>(null); private keptAddress: string | undefined; private addressReady = false;
  private selectedWarehouse = signal('');
  receiving = computed(() => this.warehouses().find((w) => w.id === this.selectedWarehouse()) ?? null);
  /** Copie de la commande (ou de la réception) puis adresses disponibles du fournisseur. */
  private initAddress(snapshot: AddressSnapshot | null) { this.currentAddress.set(snapshot); this.addressId.set(snapshot?.addressId ?? ''); this.keptAddress = snapshot?.addressId ?? ''; this.addressReady = true; }  
  form = this.fb.nonNullable.group({ warehouseId: ['', Validators.required], receiptDate: [today()], deliveryNoteRef: [''], rows: this.rows });
  loading = signal(true); saving = signal(false); error = signal('');
  row(q = 0, serials = '') { return this.fb.nonNullable.group({ quantity: [q, [Validators.min(0)]], serials: [serials] }); }
  ngOnInit() {
    this.form.controls.warehouseId.valueChanges.subscribe((v) => this.selectedWarehouse.set(v));
    this.api.get('/warehouses').subscribe((w) => { this.warehouses.set(w.filter((x: { isActive: boolean }) => x.isActive)); const d = w.find((x: { isDefault: boolean }) => x.isDefault); if (d && !this.form.controls.warehouseId.value) this.form.controls.warehouseId.setValue(d.id); });
    const id = this.id();
    const load = (orderId: string, cur?: Record<string, { quantity: number; serials: string[] }>) => this.api.get(`/purchase-orders/${orderId}`).subscribe({ next: (o) => {
      this.order.set(o); if (!this.id()) { this.initAddress(o.supplierAddress); if (o.receivingAddress?.warehouseId) this.form.controls.warehouseId.setValue(o.receivingAddress.warehouseId); }
      this.api.get<SupplierDto>(`/suppliers/${o.supplierId}`).subscribe({ next: (s) => this.supplier.set(s), error: () => undefined });
      this.info = o.lines.filter((l: any) => l.productId && (cur?.[l.id] || l.remainingQty > 0)).map((l: any) => ({ ...l, remainingQty: cur?.[l.id] ? l.remainingQty : l.remainingQty }));  
      this.info.forEach((l) => this.rows.push(this.row(cur?.[l.id]?.quantity ?? l.remainingQty, (cur?.[l.id]?.serials ?? []).join('\n')))); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/goods-receipts']); } });
    if (id) this.api.get(`/goods-receipts/${id}`).subscribe((r) => { this.initAddress(r.supplierAddress); this.form.patchValue({ warehouseId: r.warehouseId, receiptDate: iso(r.receiptDate), deliveryNoteRef: r.deliveryNoteRef ?? '' }); load(r.purchaseOrderId, Object.fromEntries(r.lines.map((l: any) => [l.orderLineId, { quantity: l.quantity, serials: l.serials }]))); });  
    else if (this.orderId()) load(this.orderId()!); else { this.toast.error('Choisissez une commande depuis sa fiche (bouton « Réceptionner »).'); this.router.navigate(['/purchase-orders']); }
  }
  save() {
    this.error.set(''); if (this.form.controls.warehouseId.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); const lines = this.info.map((l, i) => ({ orderLineId: l.id, quantity: Number(v.rows[i]!.quantity), serials: v.rows[i]!.serials.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) })).filter((l) => l.quantity > 0).map((l) => ({ ...l, ...(l.serials.length ? {} : { serials: undefined }) }));
    if (!lines.length) { this.error.set('Indiquez au moins une quantité reçue.'); return; }
    this.saving.set(true); const body = { ...(this.addressReady && this.addressId() !== this.keptAddress && { supplierAddressId: this.addressId() || null }), purchaseOrderId: this.order().id, warehouseId: v.warehouseId, receiptDate: v.receiptDate, deliveryNoteRef: v.deliveryNoteRef || undefined, lines }; const id = this.id();
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
