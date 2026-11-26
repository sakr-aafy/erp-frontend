import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from '../../../shared/components/icon';
import { Api } from '../../../core/services/api.service';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { AddressBody } from '../../../shared/components/address-card';
import { PageHeader } from '../../../shared/components/page-header';
import { prompt } from '../../../shared/components/prompt-dialog';
import { Skeleton } from '../../../shared/components/skeleton';
import { PaySupplierDialog } from '../../finance/finance-dialogs';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

const LABELS: Record<string, string> = { draft: 'Brouillon', confirmed: 'Confirmée', partially_received: 'Partiellement reçue', received: 'Reçue', cancelled: 'Annulée', validated: 'Validée' };
const good = (s: string) => ['confirmed', 'received', 'validated'].includes(s); const bad = (s: string) => s === 'cancelled';
const common = `.addresses{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:16px;margin-bottom:16px}.addresses strong{display:block;margin-bottom:4px}.addresses p{margin:0}.status-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}h3{margin:0 0 12px;font-size:16px}.lines{width:100%;border-collapse:collapse;min-width:640px}.lines th,.lines td{padding:8px;border-bottom:1px solid var(--erp-border);text-align:left}.lines th{color:var(--muted);font-weight:500;font-size:13px}.r{text-align:right!important}
  .totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.totals .b{font-weight:600;border-top:1px solid var(--erp-border);margin-top:4px;padding-top:6px}.bottom{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;align-items:flex-start}.info{background:var(--brand-50);border-color:var(--brand-200);margin-bottom:12px}.warn{background:var(--accent-50);border-color:var(--accent-300)}`;

/** Fiche de commande d'achat : statut, lignes (reçu / facturé), actions, rapprochement commande / réception / facture. */
@Component({
  selector: 'app-order-detail',
  imports: [AddressBody, DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, MoneyPipe],
  template: `
    <div class="page">@if (!d()) {<div class="card"><app-skeleton /></div>} @else {
      <app-page-header [title]="'Commande d’achat ' + d().number" [subtitle]="d().supplier?.name">
        @if (d().editable && auth.has('purchases:update')) {<a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>}
        @if (d().editable && auth.has('purchases:delete')) {<button mat-stroked-button color="warn" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
        @if (['confirmed', 'partially_received'].includes(d().status) && auth.has('purchases:create')) {<a mat-stroked-button routerLink="/goods-receipts/new" [queryParams]="{ orderId: d().id }"><app-icon name="move_to_inbox" />Réceptionner</a>}
        @if (['confirmed', 'partially_received', 'received'].includes(d().status) && auth.has('purchases:create')) {<a mat-stroked-button routerLink="/purchase-invoices/new" [queryParams]="{ orderId: d().id }"><app-icon name="receipt" />Facture d’achat</a>}
        @if (d().status === 'confirmed' && auth.has('purchases:validate')) {<button mat-stroked-button color="warn" (click)="cancel()"><app-icon name="cancel" />Annuler</button>}
        @if (d().status === 'draft' && auth.has('purchases:validate')) {<button mat-flat-button color="primary" (click)="confirm()"><app-icon name="verified" />Confirmer la commande</button>}
      </app-page-header>
      <div class="status-row"><span class="chip" [class.ok]="good(d().status)" [class.off]="bad(d().status)">{{ label(d().status) }}</span><span class="muted">{{ d().orderDate | date: 'dd/MM/yyyy' : 'UTC' }}@if (d().expectedDate) { — livraison prévue le {{ d().expectedDate | date: 'dd/MM/yyyy' : 'UTC' }}}</span></div>
      @if (d().cancelReason) {<div class="card info">Annulée : {{ d().cancelReason }}</div>}
      @if (d().supplierAddress || d().receivingAddress) {<div class="addresses">
        <div class="card"><h3>Adresse du fournisseur</h3>@if (d().supplierAddress; as a) {<strong>{{ a.label }}</strong><app-address-body [a]="a" />} @else {<p class="muted">Non précisée</p>}</div>
        <div class="card"><h3>Adresse de réception (notre entreprise)</h3>@if (d().receivingAddress; as r) {<strong>{{ r.name }}</strong><p class="muted">{{ r.address || 'Adresse non renseignée' }}</p>} @else {<p class="muted">Non précisée</p>}</div>
      </div>}
      <div class="card"><div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Commandé</th><th class="r">Reçu</th><th class="r">Facturé</th><th class="r">P.U. HT</th><th>TVA</th><th class="r">Total HT</th></tr></thead>
        <tbody>@for (l of d().lines; track l.id) {<tr><td>{{ l.designation }}@if (l.reference) {<br><small class="muted">{{ l.reference }}</small>}</td><td class="r">{{ l.quantity }}</td><td class="r">{{ l.receivedQty }}</td><td class="r">{{ l.invoicedQty }}</td><td class="r">{{ l.unitPriceMinor | money }}</td><td>{{ l.vat?.code }}</td><td class="r">{{ l.netHtMinor | money }}</td></tr>}</tbody></table></div></div>
      <div class="bottom"><div class="card" style="flex:1;min-width:280px"><h3>Notes</h3><p>{{ d().notes || '—' }}</p></div>
        <div class="card totals" style="width:360px;max-width:100%"><h3>Totaux</h3><div><span>Total HT</span><span>{{ d().totals.totalHtMinor | money }}</span></div><div><span>TVA</span><span>{{ d().totals.totalVatMinor | money }}</span></div><div class="b"><span>Total TTC</span><span>{{ d().totals.totalTtcMinor | money }}</span></div></div></div>
      @if (rec()) {<div class="card" style="margin-top:16px"><h3>Rapprochement commande / réception / facture</h3><div class="table-wrap"><table class="lines"><thead><tr><th>Ligne</th><th class="r">Commandé</th><th class="r">Reçu</th><th class="r">Facturé</th><th class="r">Écart de prix</th><th>Alertes</th></tr></thead>
        <tbody>@for (l of rec().lines; track l.lineId) {<tr><td>{{ l.designation }}</td><td class="r">{{ l.ordered }}</td><td class="r">{{ l.received }}</td><td class="r">{{ l.invoiced }}</td><td class="r">{{ l.priceDiffMinor | money }}</td><td>@for (f of l.flags; track f) {<span class="chip off" style="margin-right:4px">{{ f }}</span>} @empty {<span class="chip ok">Conforme</span>}</td></tr>}</tbody></table></div></div>}
    }</div>`,
  styles: common,
})
export class OrderDetail {
  id = input.required<string>(); d = signal<any>(null); rec = signal<any>(null);  
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); auth = inject(AuthService);
  label = (s: string) => LABELS[s] ?? s; good = good; bad = bad;
  ngOnInit() { this.load(); }
  load() { this.api.get(`/purchase-orders/${this.id()}`).subscribe({ next: (o) => { this.d.set(o); if (o.status !== 'draft') this.api.get(`/purchase-orders/${this.id()}/reconciliation`).subscribe((r) => this.rec.set(r)); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/purchase-orders']); } }); }
  private run(o: import('rxjs').Observable<unknown>, ok: string) { o.subscribe({ next: () => { this.toast.success(ok); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  confirm() { confirm(this.dialog, { title: 'Confirmer la commande', message: 'La commande sera validée (contrôle du blocage fournisseur) et pourra être réceptionnée.', confirmLabel: 'Confirmer' }).subscribe((ok) => ok && this.run(this.api.post(`/purchase-orders/${this.id()}/confirm`), 'Commande confirmée')); }
  cancel() { prompt(this.dialog, { title: 'Annuler la commande', label: 'Motif (obligatoire)', confirmLabel: 'Annuler la commande' }).subscribe((r) => r && this.run(this.api.post(`/purchase-orders/${this.id()}/cancel`, { reason: r }), 'Commande annulée')); }
  remove() { confirm(this.dialog, { title: 'Supprimer la commande', message: 'Supprimer ce brouillon ?', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/purchase-orders/${this.id()}`).subscribe({ next: () => { this.toast.success('Supprimée'); this.router.navigate(['/purchase-orders']); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}

@Component({
  selector: 'app-receipt-detail',
  imports: [AddressBody, DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, MoneyPipe],
  template: `
    <div class="page">@if (!d()) {<div class="card"><app-skeleton /></div>} @else {
      <app-page-header [title]="'Réception ' + d().number" [subtitle]="d().supplier?.name">
        @if (d().editable && auth.has('purchases:update')) {<a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>}
        @if (d().status === 'draft' && !d().importFileId && auth.has('purchases:delete')) {<button mat-stroked-button color="warn" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
        @if (d().status === 'draft' && auth.has('purchases:validate')) {<button mat-flat-button color="primary" (click)="validate()"><app-icon name="verified" />Valider la réception</button>}
      </app-page-header>
      <div class="status-row"><span class="chip" [class.ok]="d().status === 'validated'">{{ label(d().status) }}</span><span class="muted">{{ d().receiptDate | date: 'dd/MM/yyyy' : 'UTC' }}</span>
        @if (d().purchaseOrderId) {<a [routerLink]="['/purchase-orders', d().purchaseOrderId]">Commande source</a>} @if (d().importFileId) {<a [routerLink]="['/imports', d().importFileId]">Dossier d’importation</a>}</div>
      @if (d().status === 'validated') {<div class="card info"><app-icon name="inventory" /> Réception validée : le stock a été mis à jour (mouvements consultables dans Stock › Mouvements).</div>}
      @if (d().supplierAddress || d().receivingAddress) {<div class="addresses">
        <div class="card"><h3>Adresse du fournisseur</h3>@if (d().supplierAddress; as a) {<strong>{{ a.label }}</strong><app-address-body [a]="a" />} @else {<p class="muted">Non précisée</p>}</div>
        <div class="card"><h3>Adresse de réception (notre entreprise)</h3>@if (d().receivingAddress; as r) {<strong>{{ r.name }}</strong><p class="muted">{{ r.address || 'Adresse non renseignée' }}</p>} @else {<p class="muted">Non précisée</p>}</div>
      </div>}
      <div class="card"><div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Quantité</th><th class="r">Coût unitaire</th><th class="r">Frais annexes / unité</th><th class="r">Valeur</th><th>Séries</th></tr></thead>
        <tbody>@for (l of d().lines; track l.id) {<tr><td>{{ l.designation }}</td><td class="r">{{ l.quantity }}</td><td class="r">{{ l.unitCostMinor | money }}</td><td class="r">{{ l.extraUnitCostMinor | money }}</td><td class="r">{{ l.valueMinor | money }}</td><td>{{ l.serials.join(', ') }}</td></tr>}</tbody></table></div></div>
    }</div>`,
  styles: common,
})
export class ReceiptDetail {
  id = input.required<string>(); d = signal<any>(null);  
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); auth = inject(AuthService);
  label = (s: string) => LABELS[s] ?? s;
  ngOnInit() { this.load(); }
  load() { this.api.get(`/goods-receipts/${this.id()}`).subscribe({ next: (r) => this.d.set(r), error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/goods-receipts']); } }); }
  validate() { confirm(this.dialog, { title: 'Valider la réception', message: 'Les marchandises entrent en stock et le coût de revient est recalculé. Cette action est définitive.', confirmLabel: 'Valider' }).subscribe((ok) => ok && this.api.post(`/goods-receipts/${this.id()}/validate`).subscribe({ next: () => { this.toast.success('Réception validée : stock mis à jour'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) })); }
  remove() { confirm(this.dialog, { title: 'Supprimer la réception', message: 'Supprimer ce brouillon ?', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/goods-receipts/${this.id()}`).subscribe({ next: () => { this.toast.success('Supprimée'); this.router.navigate(['/goods-receipts']); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}

@Component({
  selector: 'app-purchase-invoice-detail',
  imports: [DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, MoneyPipe],
  template: `
    <div class="page">@if (!d()) {<div class="card"><app-skeleton /></div>} @else {
      <app-page-header [title]="'Facture d’achat ' + (d().number ?? '(brouillon)')" [subtitle]="d().supplier?.name + ' — facture fournisseur n° ' + d().supplierInvoiceNumber">
        @if (d().editable && auth.has('purchases:update')) {<a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>}
        @if (d().editable && auth.has('purchases:delete')) {<button mat-stroked-button color="warn" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
        @if (d().editable && auth.has('purchases:validate')) {<button mat-flat-button color="primary" (click)="validate()"><app-icon name="verified" />Valider la facture</button>}
        @if (d().status === 'validated' && d().balanceDueMinor > 0 && auth.has('treasury:create')) {<button mat-flat-button color="primary" (click)="pay()"><app-icon name="payments" />Régler</button>}
      </app-page-header>
      <div class="status-row"><span class="chip" [class.ok]="d().status === 'validated'">{{ label(d().status) }}</span>@if (d().status === 'validated') {<span class="chip" [class.ok]="d().paymentStatus === 'paid'">{{ d().paymentStatus === 'paid' ? 'Réglée' : d().paymentStatus === 'partial' ? 'Partiellement réglée' : 'Non réglée' }}</span><span class="muted">Payé {{ d().paidMinor | money }} — reste dû {{ d().balanceDueMinor | money }}</span>}<span class="muted">{{ d().invoiceDate | date: 'dd/MM/yyyy' : 'UTC' }}</span>@if (d().purchaseOrderId) {<a [routerLink]="['/purchase-orders', d().purchaseOrderId]">Commande source</a>}</div>
      @if (d().variances.length) {<div class="card warn"><strong>Écarts constatés à la validation</strong>@for (v of d().variances; track $index) {<div>{{ v.message }} : commandé {{ v.orderPriceMinor | money }} / facturé {{ v.invoicePriceMinor | money }}</div>}</div>}
      <div class="card"><div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. HT</th><th class="r">Rem. %</th><th>TVA</th><th class="r">Total HT</th></tr></thead>
        <tbody>@for (l of d().lines; track l.id) {<tr><td>{{ l.designation }}</td><td class="r">{{ l.quantity }}</td><td class="r">{{ l.unitPriceMinor | money }}</td><td class="r">{{ l.discountPct || '' }}</td><td>{{ l.vat?.code }}</td><td class="r">{{ l.netHtMinor | money }}</td></tr>}</tbody></table></div></div>
      <div class="bottom"><div class="card" style="flex:1;min-width:280px"><h3>Notes</h3><p>{{ d().notes || '—' }}</p></div>
        <div class="card totals" style="width:360px;max-width:100%"><h3>Totaux</h3><div><span>Total HT</span><span>{{ d().totals.totalHtMinor | money }}</span></div><div><span>TVA déductible</span><span>{{ d().totals.totalVatMinor | money }}</span></div><div class="b"><span>Total TTC</span><span>{{ d().totals.totalTtcMinor | money }}</span></div></div></div>
    }</div>`,
  styles: common,
})
export class PurchaseInvoiceDetail {
  id = input.required<string>(); d = signal<any>(null);  
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); auth = inject(AuthService);
  label = (s: string) => LABELS[s] ?? s;
  ngOnInit() { this.load(); }
  load() { this.api.get(`/purchase-invoices/${this.id()}`).subscribe({ next: (r) => this.d.set(r), error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/purchase-invoices']); } }); }
  pay() { this.dialog.open(PaySupplierDialog, { data: { supplierId: this.d().supplierId, supplierName: this.d().supplier?.name, invoice: this.d() } }).afterClosed().subscribe((r) => { if (r) { this.toast.success(`Règlement ${r.number} enregistré`); this.load(); } }); }
  validate() { confirm(this.dialog, { title: 'Valider la facture d’achat', message: 'Contrôle à 3 voies (quantités reçues) ; un numéro interne est attribué et le solde dû au fournisseur augmente. Le document ne sera plus modifiable.', confirmLabel: 'Valider' }).subscribe((ok) => ok && this.api.post(`/purchase-invoices/${this.id()}/validate`).subscribe({ next: () => { this.toast.success('Facture validée'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) })); }
  remove() { confirm(this.dialog, { title: 'Supprimer', message: 'Supprimer ce brouillon ?', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/purchase-invoices/${this.id()}`).subscribe({ next: () => { this.toast.success('Supprimée'); this.router.navigate(['/purchase-invoices']); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}
