import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { FieldsPrices } from '../product-fields';
import { pricesBody } from '../product-form.model';
import { num } from '../product.labels';
import { ProductService } from '../product.service';
import { ActivityDto } from '../product.types';
import { TabEditBase } from './tab-edit-base';

/** Onglet 3 — Prix : achat (devise, fournisseur habituel, coût de revient), vente (HT, TVA, TTC, minimum, remise maximale), marges et historique des prix. */
@Component({
  selector: 'app-tab-prices',
  imports: [DatePipe, MatButtonModule, Icon, MoneyPipe, FieldsPrices],
  template: `
    @if (editing()) {
      @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
      <app-fields-prices [form]="form" [product]="p()" [purchase]="p().access.purchase" />
      <div class="bar"><button mat-button type="button" (click)="cancel()">Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
    } @else {
      <div class="top"><div><h2>Prix</h2><p class="muted">Prix d’achat, de vente, coûts et marges</p></div>@if (canEdit()) {<button mat-stroked-button type="button" (click)="edit()"><app-icon name="edit" />Modifier</button>}</div>
      @if (p().warnings?.length) {<div class="warn" role="alert"><app-icon name="warning" />{{ p().warnings!.join(' ') }}</div>}
      <div class="grid">
        @if (p().access.purchase) {
        <section class="card"><h3><app-icon name="shopping_cart" />Achat</h3><dl>
          <dt>Devise d’achat</dt><dd>{{ p().purchaseCurrency ?? base() }}</dd>
          @if (p().purchaseCurrency) {<dt>Prix d’achat HT en {{ p().purchaseCurrency }}</dt><dd><strong>{{ foreign() }} {{ p().purchaseCurrency }}</strong></dd>}
          @else {<dt>Prix d’achat HT</dt><dd><strong>{{ p().purchasePriceMinor | money }}</strong></dd>}
          @if (p().estimateRate !== null) {<dt>Taux de change estimatif</dt><dd>1 {{ p().purchaseCurrency }} = {{ num(p().estimateRate) }} {{ ref.symbol() }}</dd>
            <dt>Contre-valeur estimée</dt><dd><strong>{{ p().estimatedPurchaseMinor | money }}</strong></dd>}
          @if (p().purchaseRate !== null) {<dt>Contre-valeur au taux réel enregistré</dt><dd>{{ p().purchasePriceMinor | money }} <span class="muted">(1 {{ p().purchaseCurrency }} = {{ num(p().purchaseRate) }} au {{ p().purchaseRateDate | date: 'dd/MM/yyyy' : 'UTC' }})</span></dd>}
          <dt>Fournisseur habituel</dt><dd>@if (p().mainSupplierName) {{{ p().mainSupplierName }}@if (p().mainSupplierCode) { <span class="muted">{{ p().mainSupplierCode }}</span>}@if (p().mainSupplierArchived) { <span class="chip off">Archivé</span>}} @else {—}</dd>
          <dt>Coût de revient estimé</dt><dd><strong>{{ p().estimatedCostValueMinor === null ? '—' : (p().estimatedCostValueMinor | money) }}</strong> <span class="muted">{{ p().estimatedCostMinor !== null ? '(saisi)' : p().estimateRate !== null ? '(contre-valeur estimée)' : '' }}</span></dd>
          @if (p().access.cost) {<dt>Coût de revient réel actuel</dt><dd class="real">{{ p().costPriceMinor === null ? 'Pas encore calculé' : (p().costPriceMinor | money) }}</dd>}</dl>
          @if (p().estimateRate !== null) {<p class="note"><app-icon name="info" />Taux interne utilisé uniquement pour l’estimation du coût de revient.</p>}</section>}
        <section class="card"><h3><app-icon name="payments" />Vente</h3><dl>
          <dt>Prix de vente HT</dt><dd><strong>{{ p().salePriceMinor | money }}</strong></dd><dt>TVA</dt><dd>{{ p().vatRateCode }}@if (p().vatRatePct !== null) { — {{ p().vatRatePct }} %}</dd>
          <dt>Prix de vente TTC</dt><dd><strong>{{ p().saleTtcMinor === null ? '—' : (p().saleTtcMinor | money) }}</strong></dd>
          <dt>Prix minimum de vente HT</dt><dd>{{ p().minSalePriceMinor === null ? '—' : (p().minSalePriceMinor | money) }}</dd><dt>Remise maximale autorisée</dt><dd>{{ p().maxDiscountPct === null ? '—' : p().maxDiscountPct + ' %' }}</dd></dl></section>
      </div>
      @if (p().access.cost) {
        <div class="margins"><div class="kpi"><span class="muted">Marge HT</span><strong [class.neg]="(p().marginMinor ?? 0) < 0">{{ p().marginMinor | money }}</strong></div>
          <div class="kpi"><span class="muted">Taux de marge (sur coût)</span><strong>{{ p().marginRatePct === null ? '—' : p().marginRatePct + ' %' }}</strong></div>
          <div class="kpi"><span class="muted">Taux de marque (sur prix de vente)</span><strong>{{ p().markPct === null ? '—' : p().markPct + ' %' }}</strong></div>
          <div class="kpi"><span class="muted">Marge TTC (indicative)</span><strong>{{ p().marginTtcMinor === null ? '—' : (p().marginTtcMinor | money) }}</strong><span class="muted small">{{ p().marginTtcRatePct === null ? '' : p().marginTtcRatePct + ' %' }}</span></div></div>
        <p class="muted small">Marge HT = prix de vente HT − coût de revient (réel, sinon estimé). Marge TTC indicative = prix TTC − (coût + TVA sur coût) : la TVA n’est pas un bénéfice. Formule à valider avec le comptable.</p>
      } @else {<p class="muted small"><app-icon name="lock" /> Les prix d’achat, coûts et marges nécessitent des permissions supplémentaires.</p>}
      <section class="card" style="margin-top:16px"><h3><app-icon name="history" />Historique des prix</h3>
        @if (!history().length) {<p class="muted">Aucune modification de prix enregistrée depuis la création.</p>} @else {
          <ul class="hist">@for (h of history(); track h.id) {<li><span class="when">{{ h.occurredAt | date: 'dd/MM/yyyy HH:mm' }}</span><strong>{{ h.title }}</strong>
            <span class="muted">{{ detail(h) }}@if (h.user) { · {{ h.user }}}</span></li>}</ul>}
        <p class="muted small">Les documents déjà validés ne sont jamais modifiés par un changement de prix.</p></section>
    }`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}
    h3{margin:0 0 12px;font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center;color:var(--brand)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}dl{margin:0;display:grid;grid-template-columns:minmax(140px,45%) 1fr;gap:10px 16px}dt{color:var(--muted)}dd{margin:0;font-variant-numeric:tabular-nums}dd .muted,dd .chip{margin-left:6px}
    .margins{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;display:flex;flex-direction:column;gap:4px}.kpi strong{font-size:20px;font-variant-numeric:tabular-nums}.neg{color:var(--danger)}.small{font-size:12px}
    .note{display:flex;gap:8px;align-items:center;margin:12px 0 0;font-size:12px;color:var(--muted)}.note app-icon{color:var(--brand)}.real{font-weight:600;color:var(--brand)}
    .warn{display:flex;gap:8px;align-items:center;margin-bottom:12px;padding:8px 12px;background:var(--accent-50);border:1px solid var(--accent-300);border-radius:var(--r-md)}.hist{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:8px}.hist li{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--border)}.when{color:var(--muted);font-size:13px;min-width:130px}
    .bar{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg)}.err{color:var(--danger);display:flex;gap:8px;align-items:center;margin-bottom:12px;background:var(--danger-50);border-color:var(--danger-200)}`,
})
export class TabPrices extends TabEditBase {
  private svc = inject(ProductService); private toast = inject(ToastService); history = signal<ActivityDto[]>([]);
  num = num; base = () => this.ref.data()?.baseCurrency ?? 'TND';
  foreign = () => { const p = this.p(); const d = this.ref.decimalsOf(p.purchaseCurrency ?? ''); return `${((p.purchasePriceForeignMinor ?? 0) / 10 ** d).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })}`; };
  ngOnInit() { this.loadHistory(); }
  private loadHistory() {
    const kinds = ['sale_price_changed', ...(this.p().access.purchase ? ['purchase_price_changed'] : [])];
    kinds.forEach((k) => this.svc.activities(this.p().id, { page: 1, limit: 8, kind: k }).subscribe({ next: (r) => this.history.set([...this.history().filter((x) => x.kind !== k), ...r.items].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)).slice(0, 12)), error: () => undefined }));
  }
  detail(a: ActivityDto): string {
    const m = a.meta ?? {}; const f = (v: unknown) => (v == null ? '—' : this.ref.format(Number(v)));
    if (a.kind === 'sale_price_changed') return [m['saleFrom'] !== m['saleTo'] ? `Prix de vente ${f(m['saleFrom'])} → ${f(m['saleTo'])}` : '', m['minFrom'] !== m['minTo'] ? `Minimum ${f(m['minFrom'])} → ${f(m['minTo'])}` : '', m['discountFrom'] !== m['discountTo'] ? `Remise max. ${m['discountFrom'] ?? '—'} % → ${m['discountTo'] ?? '—'} %` : ''].filter(Boolean).join(' · ');
    const fx = (v: unknown, c: unknown) => (v == null || !c ? '—' : `${(Number(v) / 10 ** this.ref.decimalsOf(String(c))).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${c}`);
    return [m['foreignFrom'] !== m['foreignTo'] || m['currencyFrom'] !== m['currencyTo'] ? `Prix en devise ${fx(m['foreignFrom'], m['currencyFrom'])} → ${fx(m['foreignTo'], m['currencyTo'])}` : '',
      m['purchaseFrom'] !== m['purchaseTo'] && !m['currencyTo'] ? `Prix d’achat ${m['currencyFrom'] ? '—' : f(m['purchaseFrom'])} → ${f(m['purchaseTo'])}` : '', m['estimatedFrom'] !== m['estimatedTo'] ? `Coût estimé ${f(m['estimatedFrom'])} → ${f(m['estimatedTo'])}` : ''].filter(Boolean).join(' · ');
  }
  save() {
    const bad = this.invalidMessage(); if (bad) { this.error.set(bad); return; }
    this.saving.set(true); this.error.set('');
    this.svc.savePrices(this.p().id, pricesBody(this.form, this.ref, true, this.p().access.purchase)).subscribe({
      next: (u) => { this.saving.set(false); this.editing.set(false); this.toast.success('Prix enregistrés'); this.saved.emit(u); this.history.set([]); this.loadHistory(); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
