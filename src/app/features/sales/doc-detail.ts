import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from '../../shared/components/icon';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { DownloadService } from '../../core/services/download.service';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { AddressBody } from '../../shared/components/address-card';
import { PageHeader } from '../../shared/components/page-header';
import { AddressSnapshot } from '../../shared/models/api.models';
import { prompt } from '../../shared/components/prompt-dialog';
import { Skeleton } from '../../shared/components/skeleton';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { PaymentDialog } from './payment-dialog';
import { BlValidateDialog } from './bl-validate-dialog';
import { BL_BILLING_LABELS, CREDIT_EFFECTS, DOC_CONFIG, DocConfig, DocKind, PAYMENT_METHOD_LABELS, PaymentDto, PrintedCustomer, PROGRESS_LABELS, SalesDoc, STATUS_LABELS, WarehouseOption } from './sales.models';
import { Api } from '../../core/services/api.service';
import { CancelProformaDialog } from './cycle/cancel-proforma-dialog';
import { CustomerDetailsDialog } from './customer-details-dialog';
import { CreditDialog } from './cycle/credit-dialog';
import { DeliveryCancelDialog, ReturnDialog } from './cycle/delivery-dialogs';
import { ProformaTracking } from './cycle/proforma-tracking';
import { RelatedDocuments } from './cycle/related-documents';
import { SalesService } from './sales.service';
import { QtyPipe } from '../../shared/pipes/quantity.pipe';

@Component({
  selector: 'app-doc-detail',
  imports: [ProformaTracking, RelatedDocuments, QtyPipe, AddressBody, DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, MoneyPipe],
  template: `
    <div class="page">
      @if (!d()) {<div class="card"><app-skeleton /></div>} @else {
      <app-page-header [title]="title()" [subtitle]="d()!.customer.name + (d()!.customer.taxId ? ' — ' + d()!.customer.taxId : '')">
        <button mat-stroked-button (click)="pdf()"><app-icon name="picture_as_pdf" />PDF / Imprimer</button>
        @if (canMail()) {<button mat-stroked-button (click)="send()"><app-icon name="mail" />Envoyer</button>}
        @for (a of actions(); track a.label) {<button mat-stroked-button [color]="a.color" (click)="a.run()"><app-icon [name]="a.icon" />{{ a.label }}</button>}
        @if (d()!.editable && can('update')) {<a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>}
        @if (primary(); as p) {<button mat-flat-button color="primary" (click)="p.run()"><app-icon [name]="p.icon" />{{ p.label }}</button>}
      </app-page-header>

      <div class="status-row"><span class="chip admin" [class.ok]="good()" [class.off]="bad()">{{ kind() === 'proformas' ? d()!.statusLabel : label(d()!.status) }}</span>
        @if (kind() === 'proformas' && d()!.status !== 'cancelled') {<span class="chip delivery-state" [class.ok]="d()!.deliveryState === 'full'" [class.warn]="d()!.deliveryState === 'partial'">{{ progress.delivery[d()!.deliveryState!] }}</span>
          <span class="chip billing-state" [class.ok]="d()!.billingState === 'full'" [class.warn]="d()!.billingState === 'partial'">{{ progress.billing[d()!.billingState!] }}</span>}
        @if (kind() === 'invoices' && d()!.status === 'validated' && d()!.type === 'invoice') {<span class="chip" [class.ok]="d()!.paymentStatus === 'paid'" [class.off]="d()!.overdue">{{ d()!.overdue ? 'En retard' : label(d()!.paymentStatus!) }}</span>}
        @if (kind() === 'delivery-notes' && d()!.status === 'validated') {<span class="chip billing-state" [class.ok]="d()!.billing === 'full' || d()!.billing === 'source'" [class.warn]="d()!.billing === 'partial'">{{ blBilling[d()!.billing!] }}</span>}
        @if (d()!.creditEffect) {<span class="chip info">{{ effectLabel(d()!.creditEffect!) }}</span>}
        <span class="muted">{{ (d()!.issueDate ?? d()!.deliveryDate) | date: 'dd/MM/yyyy' : 'UTC' }}@if (d()!.validUntil) { — valable jusqu’au {{ d()!.validUntil | date: 'dd/MM/yyyy' : 'UTC' }}}</span>
        @if (d()!.sentAt) {<span class="muted">· envoyé le {{ d()!.sentAt | date: 'dd/MM/yyyy' }}</span>}</div>
      @if (kind() === 'invoices' && d()!.status === 'validated') {<div class="card info"><app-icon name="lock" /> {{ d()!.type === 'credit_note' ? 'Document validé et numéroté : il ne peut plus être modifié ni supprimé. Toute correction passe par une facture d’avoir.' : 'Document validé et numéroté : lignes et montants ne peuvent plus être modifiés ni la facture supprimée. Toute correction de montant passe par une facture d’avoir.' }}</div>}
      @if (d()!.creditedInvoiceId) {<div class="card info"><app-icon name="undo" /> Avoir sur la facture <a [routerLink]="['/invoices', d()!.creditedInvoiceId]">voir</a> — motif : {{ d()!.creditReason }}</div>}
      @if (d()!.status === 'cancelled' && d()!.cancelReason) {<div class="card info cancelled-note"><app-icon name="block" /><span>Annulé{{ d()!.cancelledAt ? ' le ' + (d()!.cancelledAt | date: 'dd/MM/yyyy HH:mm') : '' }}{{ d()!.cancelledByName ? ' par ' + d()!.cancelledByName : '' }} : {{ d()!.cancelReason }}</span></div>}
      @if (d()!.origin === 'delivery' && d()!.status === 'draft') {<div class="card info"><app-icon name="local_shipping" /><span>Facture issue de bons de livraison : quantités, prix et remises sont ceux des livraisons. La créance sera créée à la validation.</span></div>}
      <div class="links">
        @if (d()!.quotationId) {<a [routerLink]="['/quotations', d()!.quotationId]">Devis source{{ d()!.quotationVersion ? ' (version ' + d()!.quotationVersion + ' acceptée)' : '' }}</a>} @if (d()!.proformaId) {<a [routerLink]="['/proformas', d()!.proformaId]">Proforma source</a>}
        @if (d()!.source) {<a [routerLink]="[sourceRoute(), d()!.source!.id]">Source : {{ d()!.source!.number }}</a>}
        @for (b of d()!.invoiceIds ?? []; track b; let i = $index) {<a [routerLink]="['/invoices', b]">Facture liée{{ (d()!.invoiceIds!.length > 1) ? ' ' + (i + 1) : '' }}</a>}
      </div>
      @if (kind() === 'proformas') {<app-proforma-tracking [id]="d()!.id" [refresh]="reloads()" />}

      @if (d()!.deliveryTime) {<div class="card info ship"><app-icon name="local_shipping" /> Délai de livraison : {{ d()!.deliveryTime }}</div>}
      @if (d()!.syncDiscountPct) {<p class="muted">Remise globale de {{ d()!.syncDiscountPct | qty }} % appliquée à chaque article.</p>}
      <div class="card" style="margin-top:16px"><div class="table-wrap"><table class="lines">
        <thead><tr><th>Désignation</th><th class="r">Qté</th>@if (kind() !== 'delivery-notes') {<th class="r">P.U. HT</th><th class="r">Rem. %</th><th>TVA</th><th class="r">Total HT</th>}@if (showDelivered()) {<th class="r">Livré</th>}@if (showBilling()) {<th class="r">Retourné</th><th class="r">Facturé</th><th class="r">À facturer</th>}</tr></thead>
        <tbody>@for (l of d()!.lines; track $index) {<tr><td>{{ l.designation }}@if (l.reference) {<br><small class="muted">{{ l.reference }}</small>}
            @if (l.delivery?.noteNumber) {<br><small>Livré par <a [routerLink]="['/delivery-notes', l.delivery!.noteId]">{{ l.delivery!.noteNumber }}</a></small>}
            @if (l.serials?.length) {<br><small class="serials">N° de série : {{ l.serials!.join(', ') }}</small>}</td><td class="r">{{ l.quantity | qty }} {{ l.unit }}</td>
          @if (kind() !== 'delivery-notes') {<td class="r">{{ l.unitPriceMinor | money }}</td><td class="r">{{ l.discountPct ? (l.discountPct | qty) : '' }}</td><td>{{ vatText(l.vat) }}</td><td class="r">{{ l.netHtMinor | money }}</td>}
          @if (showDelivered()) {<td class="r">{{ (l.deliveredQty ?? 0) | qty }}</td>}
          @if (showBilling()) {<td class="r">{{ (l.returnedQty ?? 0) | qty }}</td><td class="r">{{ d()!.billing === 'source' ? '—' : ((l.billedQty ?? 0) | qty) }}</td><td class="r"><strong>{{ (l.availableToBill ?? 0) | qty }}</strong></td>}</tr>}</tbody></table></div></div>

      @if (d()!.returns?.length) {<div class="card returns" style="margin-top:16px"><h3>Retours physiques</h3>
        @for (r of d()!.returns; track r.id) {<div class="ret"><strong>{{ r.date | date: 'dd/MM/yyyy' : 'UTC' }}</strong> — {{ r.reason }} <span class="muted">· {{ r.userName }}</span>
          <ul>@for (x of r.lines; track x.lineId) {<li>{{ x.designation }} : {{ x.quantity | qty }} {{ x.unit }}@if (x.serials.length) { — {{ x.serials.join(', ') }}}@if (x.creditedQty) { <span class="muted">(dont {{ x.creditedQty | qty }} créditée(s))</span>}</li>}</ul></div>}</div>}

      @if (needsSchedule()) {<div class="card schedule-warn" role="status"><app-icon name="warning" /> Conditions personnalisées sans échéancier : modifiez la facture et saisissez les échéances réelles avant de la valider.</div>}

      @if (kind() !== 'delivery-notes') {
        <div class="bottom">
          @if (d()!.notes || d()!.terms) {<div class="card" style="flex:1;min-width:260px"><h3>Notes</h3><p>{{ d()!.notes }}</p>@if (d()!.terms) {<p class="muted">Conditions : {{ d()!.terms }}</p>}</div>}
          <div class="card totals" style="width:400px;max-width:100%"><h3>Totaux</h3>
            @if (d()!.totals.lineDiscountsMinor) {<div class="line-discounts"><span>Remises sur les lignes</span><span>- {{ d()!.totals.lineDiscountsMinor | money }}</span></div>}
            @if (d()!.totals.globalDiscountMinor) {<div class="extra-discount"><span>{{ d()!.globalDiscountPct ? 'Remise globale (' + (d()!.globalDiscountPct | qty) + ' %, ancienne règle)' : 'Remise supplémentaire' }}</span><span>- {{ d()!.totals.globalDiscountMinor | money }}</span></div>}
            <div class="b"><span>Total HT</span><span>{{ d()!.totals.totalHtMinor | money }}</span></div>
            @for (g of d()!.totals.vatGroups; track g.vatCode) {<div class="s"><span>{{ g.regime === 'taxable' ? 'TVA ' + g.ratePct + ' %' : g.vatCode + ' (' + vatText(g) + ')' }} — base {{ g.baseMinor | money }}</span><span>{{ g.vatMinor | money }}</span></div>}
            <div class="b"><span>Total TTC</span><span>{{ d()!.totals.totalTtcMinor | money }}</span></div>
            @if (d()!.stamp) {<div><span>Timbre fiscal</span><span>{{ d()!.totals.stampMinor | money }}</span></div>}
            @if (d()!.withholding) {<div><span>Retenue à la source ({{ d()!.withholding!.ratePct }} %)</span><span>- {{ d()!.totals.withholdingMinor | money }}</span></div>}
            @if (d()!.stamp || d()!.withholding) {<div class="b"><span>Net à payer</span><span>{{ d()!.totals.totalPayableMinor | money }}</span></div>}
            @if (kind() === 'invoices' && d()!.status === 'validated' && d()!.type === 'invoice') {
              <div class="s"><span>Encaissé</span><span>{{ d()!.paidMinor | money }}</span></div>
              @if (d()!.creditedMinor) {<div class="s"><span>Avoirs</span><span>{{ d()!.creditedMinor | money }}</span></div>}
              <div class="b"><span>Reste à payer</span><span>{{ d()!.balanceDueMinor | money }}</span></div>
              @if (d()!.overpaidMinor) {<div class="s"><span>Excédent (créance client)</span><span>{{ d()!.overpaidMinor | money }}</span></div>}}
          </div>
        </div>
      } @else {<div class="card" style="margin-top:16px"><span class="muted">Transporteur :</span> {{ d()!.carrier || '—' }} @if (warehouse()) {<br><span class="muted">Magasin de sortie :</span> {{ warehouse() }}}
        @if (d()!.validatedAt) {<br><span class="muted">Validé le</span> {{ d()!.validatedAt | date: 'dd/MM/yyyy HH:mm' }}{{ d()!.validatedByName ? ' par ' + d()!.validatedByName : '' }}} @if (d()!.notes) {<br><span class="muted">Notes :</span> {{ d()!.notes }}}</div>}

      @if (delivery() || d()!.paymentTerms) {<div class="bottom">
        @if (delivery(); as a) {<div class="card delivery" style="flex:1;min-width:280px"><h3>Adresse de livraison</h3><strong>{{ a.label }}</strong><app-address-body [a]="a" /></div>}
        @if (d()!.paymentTerms) {<div class="card pay" style="flex:1;min-width:280px"><h3>Conditions de paiement</h3><p class="pre">{{ d()!.paymentTerms }}</p>
          @if (d()!.paymentTermsCustom) {<p class="muted small">Conditions personnalisées : les échéances sont celles saisies dans l’échéancier.</p>}</div>}
      </div>}

      @if (kind() === 'invoices' && d()!.status === 'validated' && d()!.type === 'invoice') {
        <div class="card client" style="margin-top:16px"><div class="client-head"><h3>Coordonnées imprimées sur la facture</h3>
            @if (canCorrectCustomer()) {<button mat-stroked-button type="button" (click)="correctCustomer()"><app-icon name="edit" />Modifier les coordonnées du client</button>}</div>
          <p class="who"><strong>{{ d()!.customer.name }}</strong>@for (line of coordinates(d()!.customer); track $index) {<span>{{ line }}</span>}</p>
          @if (d()!.customerCorrections?.length) {<div class="history"><h4>Historique des corrections</h4>
            @for (c of d()!.customerCorrections!; track $index) {<div class="fix"><span><strong>{{ c.at | date: 'dd/MM/yyyy HH:mm' }}</strong> — {{ c.reason }} <span class="muted">· {{ c.userName }}</span></span>
              <span class="muted">Avant : {{ c.before.name }}@for (line of coordinates(c.before); track $index) { · {{ line }}}</span></div>}</div>}</div>
        <div class="bottom">
          <div class="card" style="flex:1;min-width:300px"><h3>Échéancier</h3>
            @for (s of d()!.schedule; track s.id) {<div class="inst"><span>{{ s.dueDate | date: 'dd/MM/yyyy' : 'UTC' }}</span><span>{{ s.amountMinor | money }}</span><span class="muted">payé {{ s.paidMinor | money }}@if (s.creditedMinor) { · avoir {{ s.creditedMinor | money }}} · reste {{ s.openMinor | money }}</span></div>}</div>
          <div class="card" style="flex:1;min-width:300px"><h3>Encaissements</h3>
            @for (p of payments(); track p.id) {<div class="inst" [class.cancelled]="p.status === 'cancelled'"><span>{{ p.paidAt | date: 'dd/MM/yyyy' : 'UTC' }} — {{ method(p.method) }}{{ p.reference ? ' (' + p.reference + ')' : '' }}</span><span>{{ p.amountMinor | money }}</span>
              @if (p.status === 'active' && can('update')) {<button mat-button (click)="cancelPayment(p)">Annuler</button>} @else if (p.status === 'cancelled') {<span class="muted">annulé : {{ p.cancelReason }}</span>}</div>} @empty {<p class="muted">Aucun encaissement.</p>}</div>
        </div>}
        <app-related-documents [type]="chainType()" [id]="d()!.id" [refresh]="reloads()" />
      }
    </div>`,
  styles: `.status-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.returns .ret{padding:8px 0;border-top:1px solid var(--erp-border)}.returns ul{margin:4px 0 0;padding-left:18px}.serials{overflow-wrap:anywhere}.info{background:var(--brand-50);border-color:var(--brand-200);margin-bottom:12px;display:flex;gap:8px;align-items:center}
    .links{display:flex;gap:16px;flex-wrap:wrap}.ship{margin-top:12px;overflow-wrap:anywhere}.links a{color:var(--brand)}.delivery strong{display:block;margin-bottom:4px}.pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.small{font-size:12px;margin:8px 0 0}.schedule-warn{margin-top:12px;display:flex;gap:8px;align-items:center;background:var(--accent-50);border-color:var(--accent-300);color:var(--accent-ink)}h3{margin:0 0 12px;font-size:16px}.bottom{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;align-items:flex-start}
    .lines{width:100%;border-collapse:collapse;min-width:640px}.lines th,.lines td{padding:8px;border-bottom:1px solid var(--erp-border);text-align:left}.lines th{color:var(--muted);font-weight:500;font-size:13px}.r{text-align:right!important}
    .totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.totals .b{font-weight:600;border-top:1px solid var(--erp-border);margin-top:4px;padding-top:6px}.totals .s{font-size:13px;color:var(--muted)}
    .client-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.client-head h3{margin:0}.who{margin:10px 0 0;overflow-wrap:anywhere}.who span{display:block}.history{margin-top:12px;border-top:1px solid var(--erp-border)}.history h4{margin:10px 0 4px;font-size:13px}.fix{display:flex;flex-direction:column;padding:6px 0;font-size:13px;overflow-wrap:anywhere}
    .inst{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--erp-border);align-items:center}.cancelled{text-decoration:line-through;opacity:.6}`,
})
export class DocDetail {
  kind = input.required<DocKind>(); id = input.required<string>();
  cfg = computed<DocConfig>(() => DOC_CONFIG[this.kind()]);
  private api = inject(Api); private svc = inject(SalesService); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); private dl = inject(DownloadService); private auth = inject(AuthService);
  d = signal<SalesDoc | null>(null); payments = signal<PaymentDto[]>([]);
  /** Recharge le suivi et les documents associés après une action. */
  reloads = signal(0); warehouse = signal('');
  progress = PROGRESS_LABELS; blBilling = BL_BILLING_LABELS; effectLabel = (e: string) => CREDIT_EFFECTS.find((x) => x.value === e)?.label ?? e;
  chainType = () => ({ quotations: 'quotation', proformas: 'proforma', invoices: 'invoice', 'delivery-notes': 'deliveryNote' } as const)[this.kind()];
  label = (s: string) => (s === 'validated' && this.kind() === 'delivery-notes' ? 'Validé' : STATUS_LABELS[s] ?? s); method = (m: string) => PAYMENT_METHOD_LABELS[m] ?? m;
  can = (a: string) => this.auth.has(`${this.cfg().permission}:${a}`);
  good = () => ['accepted', 'validated', 'converted'].includes(this.d()!.status); bad = () => ['refused', 'expired', 'cancelled'].includes(this.d()!.status);
  vatText = (v: { regime: string; ratePct?: number }) => (v.regime === 'taxable' ? `${v.ratePct} %` : ({ zero: '0 %', exempt: 'exonéré', suspended: 'suspension' } as Record<string, string>)[v.regime]);
  title = () => { const d = this.d()!; const t = d.type === 'credit_note' ? 'Facture d’avoir' : this.cfg().singular.charAt(0).toUpperCase() + this.cfg().singular.slice(1); return `${t} ${d.number ?? '(brouillon)'}`; };
  sourceRoute = () => ({ quotation: '/quotations', proforma: '/proformas', invoice: '/invoices' } as Record<string, string>)[this.d()!.source!.type];
  /** Adresse de livraison copiée sur le document (les documents antérieurs portent l'ancien champ du client). */
  delivery = computed<AddressSnapshot | null>(() => {
    const d = this.d(); if (!d) return null; if (d.deliveryAddress) return d.deliveryAddress;
    const s = d.customer.shippingAddress;
    return s && (s.street || s.city) ? { addressId: null, label: 'Adresse de livraison', street: s.street ?? '', city: s.city ?? null, postalCode: s.postalCode ?? null, country: s.country ?? null, contactName: null, contactPhone: null, contactPhoneInfo: null, mapsUrl: null, instructions: null } : null;
  });
  needsSchedule = () => { const d = this.d()!; return this.kind() === 'invoices' && d.status === 'draft' && d.type !== 'credit_note' && !!d.paymentTermsCustom && !d.schedule?.length; };
  // Proforma : le suivi par ligne figure dans le tableau des quantités
  showDelivered = () => this.kind() === 'invoices' && !this.d()!.origin && this.d()!.lines.some((l) => (l.deliveredQty ?? 0) > 0);
  showBilling = () => this.kind() === 'delivery-notes' && this.d()!.status === 'validated';
  canMail = () => this.can('update') && (this.kind() !== 'delivery-notes') && (this.kind() !== 'invoices' || this.d()!.status === 'validated');

  // Recharge quand l'identifiant change (ex. facture → avoir : même composant réutilisé par le routeur)
  constructor() { effect(() => { this.id(); this.kind(); this.d.set(null); this.payments.set([]); this.load(); }); }
  load() {
    this.svc.get(this.kind(), this.id()).subscribe({
      next: (d) => { this.d.set(d); this.reloads.update((v) => v + 1);
        if (this.kind() === 'delivery-notes' && d.warehouseId && this.auth.has('inventory:view')) this.api.get('/warehouses').subscribe({ next: (w: WarehouseOption[]) => this.warehouse.set(w.find((x) => x.id === d.warehouseId)?.name ?? ''), error: () => undefined }); else this.warehouse.set('');
        if (this.kind() === 'invoices' && d.status === 'validated' && d.type === 'invoice') this.svc.payments(d.id).subscribe((p) => this.payments.set(p.items)); },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl(this.cfg().route); },
    });
  }
  private run(obs: import('rxjs').Observable<unknown>, ok: string, then?: (r: never) => void) {
    obs.subscribe({ next: (r) => { this.toast.success(ok); if (then) then(r as never); else this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  private ask(title: string, message: string, confirmLabel: string, fn: () => void, danger = false) { confirm(this.dialog, { title, message, confirmLabel, danger }).subscribe((ok) => ok && fn()); }
  private reason(title: string, fn: (r: string) => void) { prompt(this.dialog, { title, label: 'Motif (obligatoire)', confirmLabel: 'Confirmer' }).subscribe((r) => r && fn(r)); }
  private go(path: string[]) { this.router.navigate(path); }

  private open<R>(c: Parameters<MatDialog['open']>[0], data: object, message: string, then?: (r: R) => void) {
    this.dialog.open(c, { data, maxWidth: '95vw', autoFocus: 'first-tabbable' }).afterClosed().subscribe((r: R | undefined) => { if (!r) return; this.toast.success(message); if (then) then(r); else this.load(); });
  }
  private billable(d: SalesDoc) { return d.status === 'validated' && d.lines.some((l) => (l.availableToBill ?? 0) > 0); }
  /** Action principale (mise en avant) selon le type et le statut. */
  primary(): { label: string; icon: string; run: () => void } | null {
    const d = this.d()!; const k = this.kind();
    if (k === 'invoices' && d.status === 'draft' && this.auth.has('invoices:validate')) return { label: 'Valider la facture', icon: 'verified', run: () => this.ask('Valider', `Valider ${d.type === 'credit_note' ? 'l’avoir' : 'la facture'} ? Un numéro légal sera attribué, le solde du client sera mis à jour et le document ne pourra plus être modifié.`, 'Valider définitivement', () => this.run(this.svc.action(k, d.id, 'validate'), 'Document validé')) };
    if (k === 'invoices' && d.status === 'validated' && d.type === 'invoice' && (d.balanceDueMinor ?? 0) > 0 && this.can('update')) return { label: 'Encaisser', icon: 'payments', run: () => this.dialog.open(PaymentDialog, { data: { invoiceId: d.id, number: d.number, dueMinor: d.balanceDueMinor } }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Encaissement enregistré'); this.load(); } }) };
    if (k === 'delivery-notes' && d.status === 'draft' && this.can('validate')) return { label: 'Valider la livraison', icon: 'verified', run: () => this.open(BlValidateDialog, { id: d.id, warehouseId: d.warehouseId, lines: d.lines }, 'Bon de livraison validé : stock mis à jour') };
    if (k === 'proformas' && d.status === 'pending' && d.deliveryState !== 'full' && this.auth.has('deliveryNotes:create')) return { label: 'Créer un bon de livraison', icon: 'local_shipping', run: () => this.router.navigate(['/delivery-notes/new'], { queryParams: { sourceType: 'proforma', sourceId: d.id } }) };
    if (k === 'delivery-notes' && this.billable(d) && this.auth.has('invoices:create')) return { label: 'Facturer', icon: 'receipt', run: () => this.router.navigate(['/invoices/from-deliveries'], { queryParams: { ids: d.id } }) };
    return null;
  }
  actions() {
    const d = this.d()!; const k = this.kind(); const out: { label: string; icon: string; color?: string; run: () => void }[] = [];
    const bl = this.auth.has('deliveryNotes:create');
    if (k === 'proformas') {
      if (d.status === 'pending' && this.can('update')) out.push({ label: 'Marquer comme envoyée', icon: 'send', run: () => this.ask('Marquer comme envoyée', 'La proforma a été transmise au client par un autre moyen que l’e-mail de l’application.', 'Marquer comme envoyée', () => this.run(this.svc.action(k, d.id, 'mark-sent', { method: 'hand' }), 'Proforma marquée comme envoyée')) });
      if (d.deliveryState !== 'none' && d.billingState !== 'full' && d.status === 'pending' && this.auth.has('invoices:create')) out.push({ label: 'Facturer les BL', icon: 'receipt', run: () => this.router.navigate(['/invoices/from-deliveries'], { queryParams: { sourceId: d.id } }) });
      if (['pending', 'expired', 'converted'].includes(d.status) && this.can('update')) out.push({ label: 'Annuler la proforma', icon: 'cancel', color: 'warn', run: () => this.open(CancelProformaDialog, { id: d.id, number: d.number }, 'Proforma annulée') });
    }
    if (k === 'invoices' && d.status === 'validated' && d.type === 'invoice') {
      if (this.auth.has('invoices:create')) out.push({ label: 'Créer un avoir', icon: 'undo', run: () => this.open(CreditDialog, { id: d.id, number: d.number, lines: d.lines, delivery: d.origin === 'delivery' }, 'Avoir créé en brouillon', (c: SalesDoc) => this.go(['/invoices', c.id])) });
      // Une facture saisie directement reste livrable ; une facture issue de BL est déjà livrée
      if (bl && !d.origin && !d.deliveryNoteIds?.length) out.push({ label: 'Créer un BL', icon: 'local_shipping', run: () => this.router.navigate(['/delivery-notes/new'], { queryParams: { sourceType: 'invoice', sourceId: d.id } }) });
    }
    if (k === 'delivery-notes' && this.can('validate')) {
      if (d.returnable) out.push({ label: 'Enregistrer un retour', icon: 'undo', run: () => this.open(ReturnDialog, { id: d.id, number: d.number, warehouseId: d.warehouseId }, 'Retour enregistré : stock mis à jour') });
      if (d.cancellable) out.push({ label: 'Annuler la livraison', icon: 'cancel', color: 'warn', run: () => this.open(DeliveryCancelDialog, { id: d.id, number: d.number }, 'Bon de livraison annulé') });
    }
    if (this.can('delete') && this.deletable(d)) out.push({ label: 'Supprimer', icon: 'delete', color: 'warn', run: () => this.ask('Supprimer', 'Supprimer définitivement ce document ?', 'Supprimer', () => this.run(this.svc.remove(k, d.id), 'Document supprimé', () => this.go([this.cfg().route])), true) });
    return out;
  }
  private deletable(d: SalesDoc) {
    switch (this.kind()) {
      case 'quotations': return false; // fiche dédiée (quotations/quotation-detail)
      case 'proformas': return d.status === 'pending' && !d.quotationId && !!d.editable;
      case 'invoices': return d.status === 'draft';
      case 'delivery-notes': return d.status === 'draft';
    }
  }
  canCorrectCustomer = () => this.can('update') && this.auth.has('invoices:validate');
  coordinates(c: PrintedCustomer) {
    const a = c.address; const town = [a?.postalCode, a?.city].filter(Boolean).join(' ');
    return [c.taxId && `Matricule fiscal : ${c.taxId}`, [a?.street, town, a?.country].filter(Boolean).join(', '), [c.phone, c.email].filter(Boolean).join(' · ')].filter((x): x is string => !!x);
  }
  correctCustomer() {
    const d = this.d()!;
    this.open(CustomerDetailsDialog, { id: d.id, number: d.number, customer: d.customer }, 'Coordonnées de la facture corrigées');
  }
  pdf() { this.dl.openPdf(`/${this.kind()}/${this.id()}/pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  send() {
    const d = this.d()!;
    prompt(this.dialog, { title: 'Envoyer par e-mail', label: 'Destinataire (vide = e-mail du client)', confirmLabel: 'Envoyer' }).subscribe((to) => {
      if (to === undefined) return;
      this.svc.action<{ sent: boolean; to: string }>(this.kind(), d.id, 'send', to ? { to } : {}).subscribe({ next: (r) => { this.toast.success(`Envoyé à ${r.to}`); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
    });
  }
  cancelPayment(p: PaymentDto) { this.reason('Annuler l’encaissement', (r) => this.run(this.svc.cancelPayment(p.id, r), 'Encaissement annulé')); }
}
