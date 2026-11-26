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
import { DOC_CONFIG, DocConfig, DocKind, PAYMENT_METHOD_LABELS, PaymentDto, SalesDoc, STATUS_LABELS } from './sales.models';
import { SalesService } from './sales.service';

@Component({
  selector: 'app-doc-detail',
  imports: [AddressBody, DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, MoneyPipe],
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

      <div class="status-row"><span class="chip" [class.ok]="good()" [class.off]="bad()">{{ label(d()!.status) }}</span>
        @if (kind() === 'invoices' && d()!.status === 'validated' && d()!.type === 'invoice') {<span class="chip" [class.ok]="d()!.paymentStatus === 'paid'" [class.off]="d()!.overdue">{{ d()!.overdue ? 'En retard' : label(d()!.paymentStatus!) }}</span>}
        @if (kind() === 'delivery-notes' && d()!.invoiced) {<span class="chip ok">Facturé</span>}
        <span class="muted">{{ (d()!.issueDate ?? d()!.deliveryDate) | date: 'dd/MM/yyyy' : 'UTC' }}@if (d()!.validUntil) { — valable jusqu’au {{ d()!.validUntil | date: 'dd/MM/yyyy' : 'UTC' }}}</span>
        @if (d()!.sentAt) {<span class="muted">· envoyé le {{ d()!.sentAt | date: 'dd/MM/yyyy' }}</span>}</div>
      @if (kind() === 'invoices' && d()!.status === 'validated') {<div class="card info"><app-icon name="lock" /> Document validé et numéroté : il ne peut plus être modifié ni supprimé. Toute correction passe par une facture d’avoir.</div>}
      @if (d()!.creditedInvoiceId) {<div class="card info"><app-icon name="undo" /> Avoir sur la facture <a [routerLink]="['/invoices', d()!.creditedInvoiceId]">voir</a> — motif : {{ d()!.creditReason }}</div>}
      @if (d()!.status === 'cancelled' && d()!.cancelReason) {<div class="card info">Annulé : {{ d()!.cancelReason }}</div>}
      <div class="links">
        @if (d()!.quotationId) {<a [routerLink]="['/quotations', d()!.quotationId]">Devis source</a>} @if (d()!.proformaId) {<a [routerLink]="['/proformas', d()!.proformaId]">Proforma</a>}
        @if (d()!.invoiceId) {<a [routerLink]="['/invoices', d()!.invoiceId]">Facture liée</a>}
        @if (d()!.source) {<a [routerLink]="[sourceRoute(), d()!.source!.id]">Source : {{ d()!.source!.number }}</a>}
        @for (b of d()!.deliveryNoteIds ?? []; track b) {<a [routerLink]="['/delivery-notes', b]">Bon de livraison</a>}
      </div>

      <div class="card" style="margin-top:16px"><div class="table-wrap"><table class="lines">
        <thead><tr><th>Désignation</th><th class="r">Qté</th>@if (kind() !== 'delivery-notes') {<th class="r">P.U. HT</th><th class="r">Rem. %</th><th>TVA</th><th class="r">Total HT</th>}@if (showDelivered()) {<th class="r">Livré</th>}</tr></thead>
        <tbody>@for (l of d()!.lines; track $index) {<tr><td>{{ l.designation }}@if (l.reference) {<br><small class="muted">{{ l.reference }}</small>}</td><td class="r">{{ l.quantity }} {{ l.unit }}</td>
          @if (kind() !== 'delivery-notes') {<td class="r">{{ l.unitPriceMinor | money }}</td><td class="r">{{ l.discountPct || '' }}</td><td>{{ vatText(l.vat) }}</td><td class="r">{{ l.netHtMinor | money }}</td>}
          @if (showDelivered()) {<td class="r">{{ l.kind === 'service' ? '—' : (l.deliveredQty ?? 0) }}</td>}</tr>}</tbody></table></div></div>

      @if (needsSchedule()) {<div class="card warn" role="status"><app-icon name="warning" /> Conditions personnalisées sans échéancier : modifiez la facture et saisissez les échéances réelles avant de la valider.</div>}

      @if (kind() !== 'delivery-notes') {
        <div class="bottom">
          @if (d()!.notes || d()!.terms) {<div class="card" style="flex:1;min-width:260px"><h3>Notes</h3><p>{{ d()!.notes }}</p>@if (d()!.terms) {<p class="muted">Conditions : {{ d()!.terms }}</p>}</div>}
          <div class="card totals" style="width:400px;max-width:100%"><h3>Totaux</h3>
            @if (d()!.totals.lineDiscountsMinor + d()!.totals.globalDiscountMinor > 0) {<div><span>Remises</span><span>- {{ d()!.totals.lineDiscountsMinor + d()!.totals.globalDiscountMinor | money }}</span></div>}
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
      } @else {<div class="card" style="margin-top:16px"><span class="muted">Transporteur :</span> {{ d()!.carrier || '—' }} @if (d()!.notes) {<br><span class="muted">Notes :</span> {{ d()!.notes }}}</div>}

      @if (delivery() || d()!.paymentTerms) {<div class="bottom">
        @if (delivery(); as a) {<div class="card delivery" style="flex:1;min-width:280px"><h3>Adresse de livraison</h3><strong>{{ a.label }}</strong><app-address-body [a]="a" /></div>}
        @if (d()!.paymentTerms) {<div class="card pay" style="flex:1;min-width:280px"><h3>Conditions de paiement</h3><p class="pre">{{ d()!.paymentTerms }}</p>
          @if (d()!.paymentTermsCustom) {<p class="muted small">Conditions personnalisées : les échéances sont celles saisies dans l’échéancier.</p>}</div>}
      </div>}

      @if (kind() === 'invoices' && d()!.status === 'validated' && d()!.type === 'invoice') {
        <div class="bottom">
          <div class="card" style="flex:1;min-width:300px"><h3>Échéancier</h3>
            @for (s of d()!.schedule; track s.id) {<div class="inst"><span>{{ s.dueDate | date: 'dd/MM/yyyy' : 'UTC' }}</span><span>{{ s.amountMinor | money }}</span><span class="muted">payé {{ s.paidMinor | money }}@if (s.creditedMinor) { · avoir {{ s.creditedMinor | money }}} · reste {{ s.openMinor | money }}</span></div>}</div>
          <div class="card" style="flex:1;min-width:300px"><h3>Encaissements</h3>
            @for (p of payments(); track p.id) {<div class="inst" [class.cancelled]="p.status === 'cancelled'"><span>{{ p.paidAt | date: 'dd/MM/yyyy' : 'UTC' }} — {{ method(p.method) }}{{ p.reference ? ' (' + p.reference + ')' : '' }}</span><span>{{ p.amountMinor | money }}</span>
              @if (p.status === 'active' && can('update')) {<button mat-button (click)="cancelPayment(p)">Annuler</button>} @else if (p.status === 'cancelled') {<span class="muted">annulé : {{ p.cancelReason }}</span>}</div>} @empty {<p class="muted">Aucun encaissement.</p>}</div>
        </div>}
      }
    </div>`,
  styles: `.status-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.info{background:var(--brand-50);border-color:var(--brand-200);margin-bottom:12px;display:flex;gap:8px;align-items:center}
    .links{display:flex;gap:16px;flex-wrap:wrap}.links a{color:var(--brand)}.delivery strong{display:block;margin-bottom:4px}.pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.small{font-size:12px;margin:8px 0 0}.warn{margin-top:12px;display:flex;gap:8px;align-items:center;background:var(--accent-50);border-color:var(--accent-300);color:var(--accent-ink)}h3{margin:0 0 12px;font-size:16px}.bottom{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;align-items:flex-start}
    .lines{width:100%;border-collapse:collapse;min-width:640px}.lines th,.lines td{padding:8px;border-bottom:1px solid var(--erp-border);text-align:left}.lines th{color:var(--muted);font-weight:500;font-size:13px}.r{text-align:right!important}
    .totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.totals .b{font-weight:600;border-top:1px solid var(--erp-border);margin-top:4px;padding-top:6px}.totals .s{font-size:13px;color:var(--muted)}
    .inst{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--erp-border);align-items:center}.cancelled{text-decoration:line-through;opacity:.6}`,
})
export class DocDetail {
  kind = input.required<DocKind>(); id = input.required<string>();
  cfg = computed<DocConfig>(() => DOC_CONFIG[this.kind()]);
  private svc = inject(SalesService); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); private dl = inject(DownloadService); private auth = inject(AuthService);
  d = signal<SalesDoc | null>(null); payments = signal<PaymentDto[]>([]);
  label = (s: string) => STATUS_LABELS[s] ?? s; method = (m: string) => PAYMENT_METHOD_LABELS[m] ?? m;
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
  showDelivered = () => this.kind() !== 'delivery-notes' && this.d()!.lines.some((l) => (l.deliveredQty ?? 0) > 0);
  canMail = () => this.can('update') && (this.kind() !== 'delivery-notes') && (this.kind() !== 'invoices' || this.d()!.status === 'validated');

  // Recharge quand l'identifiant change (ex. facture → avoir : même composant réutilisé par le routeur)
  constructor() { effect(() => { this.id(); this.kind(); this.d.set(null); this.payments.set([]); this.load(); }); }
  load() {
    this.svc.get(this.kind(), this.id()).subscribe({
      next: (d) => { this.d.set(d); if (this.kind() === 'invoices' && d.status === 'validated' && d.type === 'invoice') this.svc.payments(d.id).subscribe((p) => this.payments.set(p.items)); },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl(this.cfg().route); },
    });
  }
  private run(obs: import('rxjs').Observable<unknown>, ok: string, then?: (r: never) => void) {
    obs.subscribe({ next: (r) => { this.toast.success(ok); if (then) then(r as never); else this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  private ask(title: string, message: string, confirmLabel: string, fn: () => void, danger = false) { confirm(this.dialog, { title, message, confirmLabel, danger }).subscribe((ok) => ok && fn()); }
  private reason(title: string, fn: (r: string) => void) { prompt(this.dialog, { title, label: 'Motif (obligatoire)', confirmLabel: 'Confirmer' }).subscribe((r) => r && fn(r)); }
  private go(path: string[]) { this.router.navigate(path); }

  /** Action principale (mise en avant) selon le type et le statut. */
  primary() {
    const d = this.d()!; const k = this.kind();
    if (k === 'invoices' && d.status === 'draft' && this.auth.has('invoices:validate')) return { label: 'Valider la facture', icon: 'verified', run: () => this.ask('Valider', `Valider ${d.type === 'credit_note' ? 'l’avoir' : 'la facture'} ? Un numéro légal sera attribué, le solde du client sera mis à jour et le document ne pourra plus être modifié.`, 'Valider définitivement', () => this.run(this.svc.action(k, d.id, 'validate'), 'Document validé')) };
    if (k === 'invoices' && d.status === 'validated' && d.type === 'invoice' && (d.balanceDueMinor ?? 0) > 0 && this.can('update')) return { label: 'Encaisser', icon: 'payments', run: () => this.dialog.open(PaymentDialog, { data: { invoiceId: d.id, number: d.number, dueMinor: d.balanceDueMinor } }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Encaissement enregistré'); this.load(); } }) };
    if (k === 'delivery-notes' && d.status === 'draft' && this.can('validate')) return { label: 'Valider la livraison', icon: 'verified', run: () => this.dialog.open(BlValidateDialog, { data: { id: d.id } }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Bon de livraison validé : stock mis à jour'); this.load(); } }) };
    if (k === 'quotations' && d.status === 'pending' && this.can('update')) return { label: 'Accepter', icon: 'check_circle', run: () => this.run(this.svc.action(k, d.id, 'accept'), 'Devis accepté') };
    if (k === 'proformas' && d.status === 'pending' && this.auth.has('invoices:create')) return { label: 'Convertir en facture', icon: 'receipt', run: () => this.run(this.svc.action<{ invoiceId: string }>(k, d.id, 'convert-invoice'), 'Facture brouillon créée', (r: { invoiceId: string }) => this.go(['/invoices', r.invoiceId])) };
    if (k === 'delivery-notes' && d.status === 'validated' && !d.invoiced && this.auth.has('invoices:create')) return { label: 'Facturer', icon: 'receipt', run: () => this.run(this.svc.invoiceFromDeliveryNotes([d.id]), 'Facture brouillon créée', (r: SalesDoc) => this.go(['/invoices', r.id])) };
    return null;
  }
  actions() {
    const d = this.d()!; const k = this.kind(); const out: { label: string; icon: string; color?: string; run: () => void }[] = [];
    const bl = this.auth.has('deliveryNotes:create');
    if (k === 'quotations') {
      if (d.status === 'pending' && this.can('update')) out.push({ label: 'Refuser', icon: 'cancel', run: () => this.ask('Refuser le devis', 'Le devis passera au statut « refusé ».', 'Refuser', () => this.run(this.svc.action(k, d.id, 'refuse'), 'Devis refusé')) });
      if (this.can('create')) out.push({ label: 'Dupliquer', icon: 'content_copy', run: () => this.run(this.svc.action(k, d.id, 'duplicate'), 'Devis dupliqué', (r: SalesDoc) => this.go(['/quotations', r.id, 'edit'])) });
      if (['pending', 'accepted'].includes(d.status) && !d.proformaId && !d.invoiceId && this.can('update')) {
        if (this.auth.has('proformas:create')) out.push({ label: 'Convertir en proforma', icon: 'description', run: () => this.run(this.svc.action<{ proformaId: string }>(k, d.id, 'convert-proforma'), 'Proforma créée', (r: { proformaId: string }) => this.go(['/proformas', r.proformaId])) });
        if (this.auth.has('invoices:create')) out.push({ label: 'Convertir en facture', icon: 'receipt', run: () => this.run(this.svc.action<{ invoiceId: string }>(k, d.id, 'convert-invoice'), 'Facture brouillon créée', (r: { invoiceId: string }) => this.go(['/invoices', r.invoiceId])) });
      }
      if (d.status === 'accepted' && !d.proformaId && !d.invoiceId && bl) out.push({ label: 'Créer un BL', icon: 'local_shipping', run: () => this.router.navigate(['/delivery-notes/new'], { queryParams: { sourceType: 'quotation', sourceId: d.id } }) });
    }
    if (k === 'proformas') {
      if (d.status === 'pending' && this.can('update')) out.push({ label: 'Annuler', icon: 'cancel', run: () => this.ask('Annuler la proforma', 'Elle ne pourra plus être convertie.', 'Annuler la proforma', () => this.run(this.svc.action(k, d.id, 'cancel'), 'Proforma annulée'), true) });
      if (d.status === 'pending' && bl) out.push({ label: 'Créer un BL', icon: 'local_shipping', run: () => this.router.navigate(['/delivery-notes/new'], { queryParams: { sourceType: 'proforma', sourceId: d.id } }) });
    }
    if (k === 'invoices') {
      if (d.status === 'validated' && d.type === 'invoice' && this.auth.has('invoices:create')) out.push({ label: 'Créer un avoir', icon: 'undo', run: () => this.reason('Créer un avoir (total) sur cette facture', (r) => this.run(this.svc.creditNote(d.id, r), 'Avoir créé en brouillon', (c: SalesDoc) => this.go(['/invoices', c.id]))) });
      if (d.status === 'validated' && d.type === 'invoice' && bl) out.push({ label: 'Créer un BL', icon: 'local_shipping', run: () => this.router.navigate(['/delivery-notes/new'], { queryParams: { sourceType: 'invoice', sourceId: d.id } }) });
    }
    if (k === 'delivery-notes' && d.status === 'validated' && !d.invoiced && this.can('validate')) out.push({ label: 'Annuler la livraison', icon: 'cancel', color: 'warn', run: () => this.reason('Annuler le bon de livraison', (r) => this.run(this.svc.action(k, d.id, 'cancel', { reason: r }), 'Bon de livraison annulé')) });
    if (this.can('delete') && this.deletable(d)) out.push({ label: 'Supprimer', icon: 'delete', color: 'warn', run: () => this.ask('Supprimer', 'Supprimer définitivement ce document ?', 'Supprimer', () => this.run(this.svc.remove(k, d.id), 'Document supprimé', () => this.go([this.cfg().route])), true) });
    return out;
  }
  private deletable(d: SalesDoc) {
    switch (this.kind()) {
      case 'quotations': return !d.proformaId && !d.invoiceId && d.status !== 'accepted';
      case 'proformas': return d.status === 'pending' && !d.quotationId;
      case 'invoices': return d.status === 'draft';
      case 'delivery-notes': return d.status === 'draft';
    }
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
