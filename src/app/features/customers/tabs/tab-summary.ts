import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../shared/components/icon';
import { PhoneLink } from '../../../shared/components/phone-link';
import { EmptyState } from '../../../shared/components/empty-state';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { KIND_ICON, KIND_LABEL, METHOD_LABEL, txStatus } from '../customer.labels';
import { CustomerSummary } from '../customer.types';

interface Op { key: string; icon: string; title: string; date: string; status: { label: string; chip: string } | null; amount: number | null; link: unknown[] }

/** Onglet Résumé : coordonnées principales, situation commerciale et dernières opérations réelles (devis, factures, avoirs, BL, paiements). */
@Component({
  selector: 'app-tab-summary',
  imports: [RouterLink, DatePipe, Icon, EmptyState, MoneyPipe, PhoneLink],
  template: `
    <h2 class="h">Vue d’ensemble</h2>
    <div class="cols">
      <section class="card">
        <h3>Coordonnées principales</h3>
        <ul class="info">
          @if (c().phone) {<li><app-icon name="phone" /><span class="v"><small>Téléphone de l’entreprise</small><app-phone [info]="c().phoneInfo" [value]="c().phone" /></span></li>}
          @if (c().secondaryPhone) {<li><app-icon name="phone" /><span class="v"><small>Téléphone secondaire</small><app-phone [info]="c().secondaryPhoneInfo" [value]="c().secondaryPhone" /></span></li>}
          @if (c().email) {<li><app-icon name="mail" /><span class="v"><small>E-mail de l’entreprise</small><a [href]="'mailto:' + c().email">{{ c().email }}</a></span></li>}
          @if (address()) {<li><app-icon name="place" /><span class="v"><small>Adresse</small><span>{{ address() }}</span></span></li>}
          <li class="primary"><app-icon name="person" /><span class="v"><small>Contact principal</small>
            @if (primary(); as k) {
              <span><strong class="pname">{{ k.name }}</strong>@if (k.role) {<span class="role"> — {{ k.role }}</span>}</span>
              @if (k.phone) {<span class="sub"><app-icon name="phone" /><app-phone [info]="k.phoneInfo" [value]="k.phone" /></span>}
              @if (k.email) {<span class="sub"><app-icon name="mail" /><a [href]="'mailto:' + k.email">{{ k.email }}</a></span>}
            } @else {<span class="muted">Aucun contact principal défini. <a [routerLink]="[]" [queryParams]="{ tab: 'contacts' }">Gérer les contacts</a></span>}
          </span></li>
          @if (c().website) {<li><app-icon name="public" /><span class="v"><small>Site web</small><a [href]="c().website" target="_blank" rel="noopener noreferrer">{{ c().website }}</a></span></li>}
          @if (c().mapsUrl) {<li class="maps"><app-icon name="place" /><span class="v"><small>Localisation Google Maps</small><a [href]="c().mapsUrl" target="_blank" rel="noopener noreferrer">Voir sur Google Maps <app-icon name="open_in_new" class="ext" /></a></span></li>}
          @for (so of socials(); track so.label) {<li><app-icon name="link" /><a [href]="so.url" target="_blank" rel="noopener noreferrer">{{ so.label }}</a></li>}
        </ul>
      </section>

      <section class="card">
        <h3>Situation commerciale</h3>
        <div class="terms"><small>Conditions de paiement</small><span>{{ c().paymentTerms || '—' }}</span></div>
        @if (s().finance; as f) {
          <dl class="kv">
            <dt>Chiffre d’affaires (HT, net des avoirs)</dt><dd>{{ f.revenueHtMinor | money }}</dd>
            <dt>Total facturé (TTC)</dt><dd>{{ f.billedMinor | money }}</dd>
            <dt>Total encaissé</dt><dd>{{ f.paidMinor | money }}</dd>
            <dt>Solde restant</dt><dd [class.neg]="f.balanceMinor > 0"><strong>{{ f.balanceMinor | money }}</strong></dd>
            <dt>Plafond de crédit</dt><dd>{{ f.creditLimitMinor === null ? 'Illimité' : (f.creditLimitMinor | money) }}@if (f.creditExceeded) { <span class="chip danger">Dépassé</span>}</dd>
            @if (f.availableCreditMinor !== null) {<dt>Crédit disponible</dt><dd>{{ f.availableCreditMinor | money }}</dd>}
          </dl>
          @if (f.overdueMinor > 0) {<p class="alert"><app-icon name="warning" />{{ f.overdueMinor | money }} échus sur {{ f.overdueInvoices }} facture(s).</p>}
        } @else {<p class="muted"><app-icon name="lock" /> Les informations financières nécessitent la permission « Factures — consulter ».</p>}
      </section>
    </div>

    <section class="card" style="margin-top:16px">
      <h3>Dernières opérations</h3>
      @if (ops().length) {
        <ul class="ops">@for (o of ops(); track o.key) {
          <li><span class="oi"><app-icon [name]="o.icon" /></span>
            <div class="ot"><a [routerLink]="o.link"><strong>{{ o.title }}</strong></a><span class="muted">{{ o.date | date: 'dd/MM/yyyy' : 'UTC' }}@if (o.status) { · <span class="chip {{ o.status.chip }}">{{ o.status.label }}</span>}</span></div>
            <strong class="amt">{{ o.amount | money }}</strong></li>}</ul>
      } @else {<app-empty-state icon="receipt_long" message="Aucune opération pour ce client." />}
    </section>`,
  styles: `.h{margin:0 0 14px;font-size:16px;font-weight:600}h3{margin:0 0 12px;font-size:15px;font-weight:600}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
    .info{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}.info li{display:flex;align-items:flex-start;gap:12px;min-width:0;overflow-wrap:anywhere}.info app-icon{color:var(--brand);margin-top:2px;flex:none}.ext{--icon-size:.875rem;margin:0!important}
    .v{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.v small,.terms small{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}
    .primary{padding:10px 12px;margin:2px -12px;background:var(--brand-50);border-radius:var(--r-md)}.pname{font-weight:600}.role{color:var(--text-2)}.sub{display:flex;align-items:center;gap:8px;margin-top:2px}.sub app-icon{--icon-size:.95rem;margin:0}
    .terms{display:flex;flex-direction:column;gap:2px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--border);white-space:pre-wrap;overflow-wrap:anywhere}
    .kv{margin:0;display:grid;grid-template-columns:1fr auto;gap:8px 16px}.kv dt{color:var(--muted)}.kv dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}.neg{color:var(--danger)}
    .alert{display:flex;gap:8px;align-items:center;margin:12px 0 0;padding:8px 12px;background:var(--accent-50);border:1px solid var(--accent-300);border-radius:var(--r-md)}
    .ops{list-style:none;margin:0;padding:0}.ops li{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}.ops li:last-child{border-bottom:0}
    .oi{display:grid;place-items:center;width:36px;height:36px;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);flex:none}.ot{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.ot a{color:inherit;text-decoration:none}.ot a:hover{text-decoration:underline}.amt{white-space:nowrap}`,
})
export class TabSummary {
  s = input.required<CustomerSummary>();
  c = computed(() => this.s().customer);
  address = computed(() => { const a = this.c().address; return [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', '); });
  /** Contact désigné « principal » dans l'onglet Contacts (lu à la source : aucune copie). */
  primary = computed(() => this.c().contacts.find((k) => k.isPrimary) ?? null);
  socials = computed(() => [{ label: 'Facebook', url: this.c().social.facebook }, { label: 'LinkedIn', url: this.c().social.linkedin }, { label: 'Instagram', url: this.c().social.instagram }].filter((x): x is { label: string; url: string } => !!x.url));
  hasContact = computed(() => !!(this.c().phone || this.c().email || this.address() || this.c().contacts.length || this.c().website));
  ops = computed<Op[]>(() => {
    const docs: Op[] = this.s().recent.documents.map((d) => ({
      key: `${d.kind}:${d.id}`, icon: KIND_ICON[d.kind], title: `${KIND_LABEL[d.kind]} ${d.number ?? '(brouillon)'}`, date: d.date, status: txStatus(d), amount: d.payableMinor ?? d.totalTtcMinor, link: d.webPath.split('/').filter(Boolean).map((x, i) => (i === 0 ? `/${x}` : x)),
    }));
    const pays: Op[] = this.s().recent.payments.map((p) => ({ key: `pay:${p.id}`, icon: 'payments', title: `Paiement ${p.invoiceNumber ?? ''} — ${METHOD_LABEL[p.method] ?? p.method}`.trim(), date: p.paidAt, status: null, amount: p.amountMinor, link: ['/invoices', p.invoiceId] }));
    return [...docs, ...pays].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8);
  });
}
