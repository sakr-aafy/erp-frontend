import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../shared/components/icon';
import { EmptyState } from '../../../shared/components/empty-state';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { KIND_ICON, KIND_LABEL, METHOD_LABEL, txStatus } from '../customer.labels';
import { CustomerSummary } from '../customer.types';

interface Op { key: string; icon: string; title: string; date: string; status: { label: string; chip: string } | null; amount: number | null; link: unknown[] }

/** Onglet Résumé : coordonnées principales, situation commerciale et dernières opérations réelles (devis, factures, avoirs, BL, paiements). */
@Component({
  selector: 'app-tab-summary',
  imports: [RouterLink, DatePipe, Icon, EmptyState, MoneyPipe],
  template: `
    <h2 class="h">Vue d’ensemble</h2>
    <div class="cols">
      <section class="card">
        <h3>Coordonnées principales</h3>
        <ul class="info">
          @if (c().phone || c().primaryContact?.phone; as p) {<li><app-icon name="phone" /><a [href]="'tel:' + p">{{ p }}</a></li>}
          @if (c().secondaryPhone) {<li><app-icon name="phone" /><a [href]="'tel:' + c().secondaryPhone">{{ c().secondaryPhone }}</a><span class="muted">(secondaire)</span></li>}
          @if (c().email || c().primaryContact?.email; as m) {<li><app-icon name="mail" /><a [href]="'mailto:' + m">{{ m }}</a></li>}
          @if (address()) {<li><app-icon name="place" /><span>{{ address() }}</span></li>}
          @if (c().primaryContact; as k) {<li><app-icon name="person" /><span><strong>{{ k.name }}</strong>@if (k.role) { — {{ k.role }}}</span></li>}
          @if (c().website) {<li><app-icon name="public" /><a [href]="c().website" target="_blank" rel="noopener noreferrer">{{ c().website }}</a></li>}
          @for (s of socials(); track s.label) {<li><app-icon name="link" /><a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }}</a></li>}
          @if (c().mapsUrl) {<li><app-icon name="place" /><a [href]="c().mapsUrl" target="_blank" rel="noopener noreferrer">Voir sur Google Maps <app-icon name="open_in_new" class="ext" /></a></li>}
        </ul>
        @if (!hasContact()) {<p class="muted">Aucune coordonnée renseignée. Complétez l’onglet « Informations ».</p>}
      </section>

      <section class="card">
        <h3>Situation commerciale</h3>
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
    .info{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}.info li{display:flex;align-items:flex-start;gap:10px;min-width:0;overflow-wrap:anywhere}.info app-icon{color:var(--brand);margin-top:2px;flex:none}.ext{font-size:14px;vertical-align:-2px}
    .kv{margin:0;display:grid;grid-template-columns:1fr auto;gap:8px 16px}.kv dt{color:var(--muted)}.kv dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}.neg{color:var(--danger)}
    .alert{display:flex;gap:8px;align-items:center;margin:12px 0 0;padding:8px 12px;background:var(--accent-50);border:1px solid var(--accent-300);border-radius:var(--r-md)}
    .ops{list-style:none;margin:0;padding:0}.ops li{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}.ops li:last-child{border-bottom:0}
    .oi{display:grid;place-items:center;width:36px;height:36px;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);flex:none}.ot{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.ot a{color:inherit;text-decoration:none}.ot a:hover{text-decoration:underline}.amt{white-space:nowrap}`,
})
export class TabSummary {
  s = input.required<CustomerSummary>();
  c = computed(() => this.s().customer);
  address = computed(() => { const a = this.c().address; return [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', '); });
  socials = computed(() => [{ label: 'Facebook', url: this.c().social.facebook }, { label: 'LinkedIn', url: this.c().social.linkedin }, { label: 'Instagram', url: this.c().social.instagram }].filter((x): x is { label: string; url: string } => !!x.url));
  hasContact = computed(() => !!(this.c().phone || this.c().email || this.address() || this.c().primaryContact || this.c().website));
  ops = computed<Op[]>(() => {
    const docs: Op[] = this.s().recent.documents.map((d) => ({
      key: `${d.kind}:${d.id}`, icon: KIND_ICON[d.kind], title: `${KIND_LABEL[d.kind]} ${d.number ?? '(brouillon)'}`, date: d.date, status: txStatus(d), amount: d.payableMinor ?? d.totalTtcMinor, link: d.webPath.split('/').filter(Boolean).map((x, i) => (i === 0 ? `/${x}` : x)),
    }));
    const pays: Op[] = this.s().recent.payments.map((p) => ({ key: `pay:${p.id}`, icon: 'payments', title: `Paiement ${p.invoiceNumber ?? ''} — ${METHOD_LABEL[p.method] ?? p.method}`.trim(), date: p.paidAt, status: null, amount: p.amountMinor, link: ['/invoices', p.invoiceId] }));
    return [...docs, ...pays].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8);
  });
}
