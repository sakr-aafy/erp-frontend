import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { errorMessage } from '../../../core/services/api';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ChainItem, ChainType, CycleEventDto } from '../sales.models';
import { SalesService } from '../sales.service';

const ICONS: Record<ChainType, string> = { quotation: 'request_quote', proforma: 'description', deliveryNote: 'local_shipping', invoice: 'receipt' };
const NAMES: Record<ChainType, string> = { quotation: 'devis', proforma: 'proformas', deliveryNote: 'bons de livraison', invoice: 'factures et avoirs' };

/**
 * « Documents associés » et chronologie d'un cycle commercial : uniquement les documents réellement liés, filtrés par le serveur
 * selon les permissions. Se recharge quand `refresh` change (après une action sur la fiche).
 */
@Component({
  selector: 'app-related-documents',
  imports: [DatePipe, RouterLink, MatButtonModule, Icon, Skeleton, MoneyPipe],
  template: `
    <section class="card related"><h3>Documents associés</h3>
      @if (error()) {<p class="err" role="alert">{{ error() }} <button mat-button type="button" (click)="load()">Réessayer</button></p>}
      @else if (!items()) {<app-skeleton [count]="3" />}
      @else {
        <div class="table-wrap"><table class="t docs"><thead><tr><th>Document</th><th>Numéro</th><th>Date</th><th>Statut</th><th class="r">Montant TTC</th><th><span class="sr">Ouvrir</span></th></tr></thead>
          <tbody>@for (d of items()!; track d.id) {<tr [class.current]="d.current">
            <td data-label="Document"><span class="doc"><app-icon [name]="icon(d.type)" />{{ d.label }}</span></td>
            <td data-label="Numéro"><a [routerLink]="d.route">{{ d.number ?? 'Brouillon' }}</a>@if (d.detail) {<small class="muted">{{ d.detail }}</small>}</td>
            <td data-label="Date">{{ d.date | date: 'dd/MM/yyyy' : 'UTC' }}</td>
            <td data-label="Statut"><span class="chip" [class.ok]="good(d)" [class.off]="d.status === 'cancelled' || d.status === 'expired'" [class.warn]="d.status === 'draft'">{{ d.statusLabel }}</span></td>
            <td class="r" data-label="Montant TTC">{{ d.amountMinor | money }}</td>
            <td class="open" data-label="">@if (d.current) {<span class="muted small">Document affiché</span>} @else {<a mat-button [routerLink]="d.route" [attr.aria-label]="'Ouvrir ' + d.label + ' ' + (d.number ?? 'brouillon')">Ouvrir<app-icon name="chevron_right" /></a>}</td></tr>}</tbody></table></div>
        @if (items()!.length === 1) {<p class="muted small">Aucun autre document n’est encore lié à celui-ci.</p>}
        @if (hidden()) {<p class="muted small"><app-icon name="lock" /> Non affichés faute de droit de consultation : {{ hidden() }}.</p>}
      }
    </section>
    @if (history()) {
      <section class="card history"><h3>Activités du cycle</h3>
        @if (!events()) {<app-skeleton [count]="3" />}
        @else if (!events()!.length) {<p class="muted">Aucune activité enregistrée (les opérations antérieures à ce suivi ne sont pas reconstituées).</p>}
        @else {<ol>@for (e of shown(); track e.id) {<li><span class="dot" aria-hidden="true"></span><div><strong>{{ e.title }}</strong>@if (e.number) { <span class="num">{{ e.number }}</span>}
              @if (e.description) {<p>{{ e.description }}</p>}<small class="muted">{{ e.at | date: 'dd/MM/yyyy HH:mm' }} · {{ e.user }}</small></div></li>}</ol>
          @if (events()!.length > 8) {<button mat-button type="button" (click)="all.set(!all())">{{ all() ? 'Réduire' : 'Afficher les ' + events()!.length + ' activités' }}</button>}}
      </section>}`,
  styles: `:host{display:flex;flex-direction:column;gap:16px;margin-top:16px}h3{margin:0 0 12px;font-size:16px}.docs{min-width:640px}.doc{display:inline-flex;align-items:center;gap:8px}.doc app-icon{color:var(--brand)}td a{font-weight:600}td small{display:block;font-size:12px}
    tr.current{background:var(--accent-50)}tr.current td:first-child{box-shadow:inset 3px 0 0 var(--accent)}.open{text-align:right;white-space:nowrap}.small{font-size:12px}.err{color:var(--danger)}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    ol{list-style:none;margin:0;padding:0}li{display:flex;gap:12px;position:relative;padding-bottom:12px}li:not(:last-child)::before{content:'';position:absolute;left:4px;top:14px;bottom:0;width:2px;background:var(--border)}.dot{width:10px;height:10px;border-radius:50%;background:var(--brand);margin-top:6px;flex:none}li p{margin:2px 0;overflow-wrap:anywhere}li div{min-width:0}.num{color:var(--brand);font-weight:600;margin-left:6px}li small{display:block}
    @media (max-width:720px){.docs{min-width:0}.docs thead{display:none}.docs,.docs tbody,.docs tr{display:block}.docs tr{border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:10px;padding:6px 0}.docs td{display:flex;justify-content:space-between;align-items:center;gap:12px;border:0;padding:4px 14px;text-align:right}.docs td::before{content:attr(data-label);color:var(--muted);font-size:12px;font-weight:600;flex:none;text-align:left}td small{text-align:right}}`,
})
export class RelatedDocuments {
  type = input.required<ChainType>(); id = input.required<string>(); history = input(true); refresh = input<unknown>(0);
  private svc = inject(SalesService);
  items = signal<ChainItem[] | null>(null); events = signal<CycleEventDto[] | null>(null); hidden = signal(''); error = signal(''); all = signal(false);
  shown = () => (this.all() ? this.events()! : this.events()!.slice(0, 8));
  icon = (t: ChainType) => ICONS[t]; good = (d: ChainItem) => ['accepted', 'validated', 'converted'].includes(d.status);
  constructor() { effect(() => { this.type(); this.id(); this.refresh(); untracked(() => this.load()); }); }
  load() {
    this.error.set('');
    this.svc.chain(this.type(), this.id()).subscribe({ next: (r) => { this.items.set(r.items); this.hidden.set(r.restricted.map((t) => NAMES[t]).join(', ')); }, error: (e) => this.error.set(errorMessage(e)) });
    if (this.history()) this.svc.chainActivities(this.type(), this.id()).subscribe({ next: (r) => this.events.set(r.items), error: () => this.events.set([]) });
  }
}
