import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { AddressBody } from '../../../shared/components/address-card';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { AddressSnapshot } from '../../../shared/models/api.models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { DocLine, QUOTATION_STATUS_STYLE, SalesDoc, STATUS_LABELS } from '../sales.models';
import { SalesService } from '../sales.service';
import { QuotationActions } from './quotation-actions.service';
import { QuotationActivityTab } from './quotation-activity';
import { QuotationCommentsTab } from './quotation-comments';
import { QuotationDocumentsTab } from './quotation-documents';
import { QuotationVersionsTab } from './quotation-versions';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';

type Tab = 'details' | 'versions' | 'documents' | 'comments' | 'activity';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'details', label: 'Détails', icon: 'description' }, { id: 'versions', label: 'Versions', icon: 'layers' }, { id: 'documents', label: 'Documents', icon: 'folder' },
  { id: 'comments', label: 'Commentaires', icon: 'chat' }, { id: 'activity', label: 'Activités', icon: 'history' },
];

/** Fiche détaillée d'un devis : en-tête (client, dates, version, statut, montant TTC, actions) et cinq onglets. */
@Component({
  selector: 'app-quotation-detail',
  imports: [QtyPipe, DatePipe, RouterLink, MatButtonModule, Icon, Skeleton, MoneyPipe, AddressBody, QuotationActivityTab, QuotationVersionsTab, QuotationDocumentsTab, QuotationCommentsTab],
  template: `
    <div class="page">
      <a class="back" routerLink="/quotations"><app-icon name="arrow_back" />Retour aux devis</a>
      @if (!d()) {<div class="card"><app-skeleton /></div>} @else {
        <section class="card head">
          <span class="logo"><app-icon name="request_quote" /></span>
          <div class="id">
            <div class="nm"><h1>Devis {{ d()!.number }}</h1><span class="chip status-chip {{ style().chip }}"><app-icon [name]="style().icon" />{{ label(d()!.status) }}</span><span class="chip off version">Version {{ d()!.version }}</span></div>
            <div class="sub"><a [routerLink]="['/customers', d()!.customerId]" class="client">{{ d()!.customer.name }}</a>
              <span>·</span><span>Créé le {{ d()!.issueDate | date: 'dd/MM/yyyy' : 'UTC' }}</span><span>·</span><span>Valable jusqu’au {{ d()!.validUntil | date: 'dd/MM/yyyy' : 'UTC' }}</span></div>
          </div>
          <div class="amount"><span class="muted">Montant TTC</span><strong>{{ d()!.totals.totalTtcMinor | money }}</strong></div>
          <div class="acts">
            <button mat-stroked-button type="button" (click)="actions.print(d()!)"><app-icon name="picture_as_pdf" />PDF / Imprimer</button>
            @for (a of list(); track a.key) {
              @if (a.key === 'edit') {<a mat-stroked-button [routerLink]="['edit']"><app-icon name="edit" />Modifier</a>}
              @else if (a.primary) {<button mat-flat-button color="primary" type="button" (click)="a.run()"><app-icon [name]="a.icon" />{{ a.label }}</button>}
              @else {<button mat-stroked-button type="button" [class.danger]="a.danger" (click)="a.run()"><app-icon [name]="a.icon" />{{ a.label }}</button>}
            }
          </div>
        </section>

        @if (note(); as n) {<p class="banner {{ d()!.status }}" role="status"><app-icon [name]="style().icon" /><span>{{ n }}</span></p>}
        @if (links().length) {<div class="links">@for (l of links(); track l.label) {<a [routerLink]="l.link"><app-icon name="open_in_new" />{{ l.label }}</a>}</div>}

        <nav class="tabs" role="tablist" aria-label="Sections du devis">
          @for (t of tabs; track t.id) {<button type="button" role="tab" class="tab" [class.on]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="go(t.id)"><app-icon [name]="t.icon" />{{ t.label }}</button>}
        </nav>

        <div class="panel" role="tabpanel">
          @if (tab() === 'activity') {@for (v of [reloads()]; track v) {<app-quotation-activity [id]="d()!.id" />}}
          @else if (tab() === 'versions') {@for (v of [reloads()]; track v) {<app-quotation-versions [id]="d()!.id" [number]="d()!.number!" />}}
          @else if (tab() === 'documents') {@for (v of [reloads()]; track v) {<app-quotation-documents [id]="d()!.id" [version]="d()!.version ?? 1" />}}
          @else if (tab() === 'comments') {<app-quotation-comments [id]="d()!.id" />}
          @else {
            <div class="cols">
              <section class="card client-card"><h3>Client</h3><strong>{{ d()!.customer.name }}</strong>@if (d()!.customer.code) {<span class="code">{{ d()!.customer.code }}</span>}@if (d()!.customer.taxId) {<span class="muted">MF : {{ d()!.customer.taxId }}</span>}</section>
              <section class="card billing"><h3>Adresse de facturation</h3>@if (billing()) {<p class="pre">{{ billing() }}</p>} @else {<p class="muted">Non renseignée</p>}</section>
              <section class="card delivery"><h3>Adresse de livraison</h3>@if (delivery(); as a) {<strong>{{ a.label }}</strong><app-address-body [a]="a" />} @else {<p class="muted">Aucune</p>}</section>
              <section class="card delay"><h3>Délai de livraison</h3>@if (d()!.deliveryTime) {<p class="pre">{{ d()!.deliveryTime }}</p>} @else {<p class="muted">Non précisé</p>}</section>
              <section class="card pay"><h3>Conditions de paiement</h3>@if (d()!.paymentTerms) {<p class="pre">{{ d()!.paymentTerms }}</p>@if (d()!.paymentTermsCustom) {<span class="muted small">Conditions personnalisées</span>}} @else {<p class="muted">Non précisées</p>}</section>
            </div>

            <section class="card articles"><div class="table-wrap"><table class="lines">
              <thead><tr><th>Pos.</th><th>Référence</th><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. HT</th><th class="r">Rem.%</th><th class="r">TVA</th><th class="r">Total HT</th></tr></thead>
              <tbody>@for (l of d()!.lines; track l.id) {<tr><td class="pos" data-label="Pos.">{{ l.position }}</td><td class="ref" data-label="Référence">{{ l.reference || '—' }}</td><td class="des" data-label="Désignation">{{ l.designation }}@if (l.description) {<br><small class="muted">{{ l.description }}</small>}</td>
                <td class="r" data-label="Qté">{{ l.quantity | qty }} {{ l.unit }}</td><td class="r" data-label="P.U. HT">{{ l.unitPriceMinor | money }}</td><td class="r" data-label="Rem.%">{{ l.discountPct ? (l.discountPct | qty) + ' %' : '—' }}</td><td class="r" data-label="TVA">{{ vatText(l.vat) }}</td>
                <td class="r" data-label="Total HT"><strong>{{ l.netHtMinor | money }}</strong>@if (delivered(l)) {<br><small class="muted">livré {{ l.deliveredQty | qty }}</small>}</td></tr>}</tbody></table></div></section>

            <div class="bottom">
              @if (d()!.notes || d()!.terms) {<section class="card notes"><h3>Notes et conditions commerciales</h3>@if (d()!.notes) {<p class="pre">{{ d()!.notes }}</p>}@if (d()!.terms) {<p class="muted pre">Conditions : {{ d()!.terms }}</p>}</section>}
              <section class="card totals"><h3>Récapitulatif</h3>
                @if (d()!.totals.lineDiscountsMinor + d()!.totals.globalDiscountMinor > 0) {<div><span>Total brut</span><span>{{ d()!.totals.grossMinor | money }}</span></div>}
                @if (d()!.totals.lineDiscountsMinor) {<div><span>Remises sur les lignes</span><span>- {{ d()!.totals.lineDiscountsMinor | money }}</span></div>}
                @if (d()!.syncDiscountPct) {<div class="s"><span>Remise globale de {{ d()!.syncDiscountPct | qty }} % appliquée à chaque article (comprise ci-dessus)</span></div>}
                @if (d()!.totals.globalDiscountMinor) {<div><span>{{ d()!.globalDiscountPct ? 'Remise globale (' + (d()!.globalDiscountPct | qty) + ' %, ancienne règle)' : 'Remise supplémentaire' }}</span><span>- {{ d()!.totals.globalDiscountMinor | money }}</span></div>}
                <div class="b"><span>Total HT</span><span>{{ d()!.totals.totalHtMinor | money }}</span></div>
                @for (g of d()!.totals.vatGroups; track g.vatCode) {<div class="s"><span>{{ g.regime === 'taxable' ? 'TVA ' + g.ratePct + ' %' : g.vatCode + ' (' + vatText(g) + ')' }} — base {{ g.baseMinor | money }}</span><span>{{ g.vatMinor | money }}</span></div>}
                <div><span>Total TVA</span><span>{{ d()!.totals.totalVatMinor | money }}</span></div>
                <div class="b ttc"><span>Total TTC</span><span>{{ d()!.totals.totalTtcMinor | money }}</span></div>
                @if (d()!.stamp) {<div><span>Timbre fiscal</span><span>{{ d()!.totals.stampMinor | money }}</span></div>}
                @if (d()!.withholding) {<div><span>Retenue à la source ({{ d()!.withholding!.ratePct }} %)</span><span>- {{ d()!.totals.withholdingMinor | money }}</span></div>}
                @if (d()!.stamp || d()!.withholding) {<div class="b"><span>Net à payer</span><span>{{ d()!.totals.totalPayableMinor | money }}</span></div>}
              </section>
            </div>
          }
        </div>
      }
    </div>`,
  styles: `.back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;margin-bottom:12px;font-size:14px}.back:hover{color:var(--brand)}
    .head{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:3px solid var(--accent)}.logo{display:grid;place-items:center;width:56px;height:56px;border-radius:var(--r-lg);background:var(--brand);color:#fff;flex:none;--icon-size:1.6rem}
    .id{flex:1;min-width:240px}.nm{display:flex;align-items:center;gap:12px;flex-wrap:wrap}h1{margin:0;font-size:22px;line-height:30px;font-weight:600;letter-spacing:-.01em;overflow-wrap:anywhere}.status-chip::before{display:none}.status-chip app-icon{--icon-size:.85rem}
    .sub{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:14px;margin-top:4px}.client{color:var(--brand);font-weight:600;text-decoration:none}.client:hover{text-decoration:underline}
    .amount{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.amount strong{font-size:22px;color:var(--brand);font-variant-numeric:tabular-nums;white-space:nowrap}.acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;width:100%;border-top:1px solid var(--border);padding-top:12px}.danger{color:var(--danger)}
    .banner{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;padding:10px 14px;border-radius:var(--r-md);border:1px solid var(--brand-200);background:var(--brand-50)}.banner.expired,.banner.draft{border-color:var(--accent-300);background:var(--accent-50)}.banner.refused{border-color:var(--danger-200);background:var(--danger-50)}
    .links{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px}.links a{display:inline-flex;gap:6px;align-items:center;color:var(--brand)}
    .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0}.version::before{display:none}.tab{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border:1px solid var(--border-strong);border-radius:999px;background:var(--surface);color:var(--text-2);font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:all var(--t-fast) var(--ease)}
    .tab:hover{border-color:var(--brand);color:var(--brand)}.tab:focus-visible{outline:none;box-shadow:var(--ring)}.tab.on{background:var(--brand);border-color:var(--brand);color:#fff}.tab app-icon{--icon-size:1rem}
    .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:16px}.cols section{display:flex;flex-direction:column;gap:4px;overflow-wrap:anywhere}h3{margin:0 0 8px;font-size:14px;font-weight:600}.code{font-weight:600;color:var(--brand)}.pre{margin:0;white-space:pre-wrap}.small{font-size:12px}.cols p{margin:0}
    .lines{width:100%;border-collapse:collapse;min-width:760px}.lines th,.lines td{padding:10px 8px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}.lines th{color:var(--muted);font-weight:600;font-size:12px;white-space:nowrap}.r{text-align:right!important;font-variant-numeric:tabular-nums}.pos{font-weight:600}.ref{color:var(--brand);overflow-wrap:anywhere}.des{min-width:200px;overflow-wrap:anywhere}td.r{white-space:nowrap}
    .bottom{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;align-items:flex-start;justify-content:flex-end}.notes{flex:1;min-width:260px}.totals{width:420px;max-width:100%}.totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.totals .b{font-weight:600;border-top:1px solid var(--border);margin-top:4px;padding-top:6px}.totals .s{font-size:13px;color:var(--muted)}.ttc{font-size:16px;color:var(--brand)}
    @media (max-width:720px){.lines{min-width:0}.lines thead{display:none}.lines,.lines tbody,.lines tr{display:block}.lines tr{border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:10px;padding:6px 0}.lines td{display:flex;justify-content:space-between;gap:16px;border:0;padding:3px 14px;text-align:right!important;min-width:0;white-space:normal}.lines td::before{content:attr(data-label);color:var(--muted);font-size:12px;font-weight:600;flex:none;text-align:left}}
    @media (max-width:600px){.amount{align-items:flex-start;width:100%}.logo{width:44px;height:44px}h1{font-size:19px}.acts{justify-content:flex-start}}`,
})
export class QuotationDetail {
  id = input.required<string>();
  private svc = inject(SalesService); private toast = inject(ToastService); private router = inject(Router); private route = inject(ActivatedRoute); private auth = inject(AuthService);
  actions = inject(QuotationActions);
  d = signal<SalesDoc | null>(null); tab = signal<Tab>('details'); tabs = TABS;
  /** Recharge les onglets après une action. */
  reloads = signal(0);
  label = (s: string) => STATUS_LABELS[s] ?? s; style = () => QUOTATION_STATUS_STYLE[this.d()!.status]!;
  list = computed(() => { const d = this.d(); return d ? this.actions.list(d, () => this.load()) : []; });
  vatText = (v: { regime: string; ratePct?: number }) => (v.regime === 'taxable' ? `${v.ratePct} %` : ({ zero: '0 %', exempt: 'exonéré', suspended: 'suspension' } as Record<string, string>)[v.regime]);
  delivered = (l: DocLine) => (l.deliveredQty ?? 0) > 0 && l.kind !== 'service';
  billing = () => { const a = (this.d()!.customer as { address?: { street?: string; city?: string; postalCode?: string; country?: string } }).address; return a ? [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join('\n') : ''; };
  delivery = computed<AddressSnapshot | null>(() => {
    const d = this.d(); if (!d) return null; if (d.deliveryAddress) return d.deliveryAddress;
    const s = d.customer.shippingAddress; // documents antérieurs aux adresses multiples
    return s && (s.street || s.city) ? { addressId: null, label: 'Adresse de livraison', street: s.street ?? '', city: s.city ?? null, postalCode: s.postalCode ?? null, country: s.country ?? null, contactName: null, contactPhone: null, contactPhoneInfo: null, mapsUrl: null, instructions: null } : null;
  });
  /** Résumé de la dernière étape : envoi, décision ou expiration. */
  note = computed(() => {
    const d = this.d(); if (!d) return '';
    const on = (x?: string | null) => (x ? new Date(x).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
    const by = (u?: string | null) => (u ? ` par ${u}` : '');
    switch (d.status) {
      case 'draft': return (d.version ?? 1) > 1 ? `Brouillon de la version ${d.version}. Les versions précédentes sont conservées ; elles ne peuvent plus être acceptées tant que ce brouillon existe.` : '';
      case 'sent': return `Version ${d.version} envoyée le ${on(d.sentAt)}${by(d.sentBy)}${d.sentMethodLabel ? ` — ${d.sentMethodLabel}` : ''}${d.sentTo ? ` à ${d.sentTo}` : ''}. Pour la réviser, créez une nouvelle version.`;
      case 'accepted': return `Version ${d.acceptedVersion ?? d.version} acceptée le ${on(d.acceptedAt)}${by(d.acceptedBy)}${d.acceptanceNote ? ` — ${d.acceptanceNote}` : ''}. Elle est figée ; pour une modification, dupliquez le devis (nouveau numéro).`;
      case 'refused': return `Refusé le ${on(d.refusedAt)}${by(d.refusedBy)}${d.refusalReason ? ` — ${d.refusalReason}` : ''}.`;
      case 'expired': return 'La date de validité est dépassée sans décision du client. Créez une nouvelle version pour la proposer à nouveau.';
      case 'cancelled': return `Annulé${d.cancelledAt ? ` le ${on(d.cancelledAt)}` : ''}${d.cancelReason ? ` — ${d.cancelReason}` : ''}. Vous pouvez le dupliquer.`;
      default: return '';
    }
  });
  links = computed(() => {
    const d = this.d(); if (!d) return [] as { label: string; link: string[] }[];
    return [d.proformaId && { label: 'Proforma générée', link: ['/proformas', d.proformaId] }, d.invoiceId && { label: 'Facture liée', link: ['/invoices', d.invoiceId] }, d.duplicatedFromId && { label: 'Devis d’origine', link: ['/quotations', d.duplicatedFromId] }]
      .filter((x): x is { label: string; link: string[] } => !!x);
  });

  constructor() {
    this.route.queryParamMap.subscribe((q) => this.tab.set(TABS.find((t) => t.id === q.get('tab'))?.id ?? 'details'));
    effect(() => { this.id(); this.d.set(null); this.load(); });
  }
  load() {
    this.svc.get('quotations', this.id()).subscribe({ next: (d) => { this.d.set(d); this.reloads.update((v) => v + 1); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/quotations'); } });
  }
  go(t: Tab) { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t === 'details' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true }); }
}
