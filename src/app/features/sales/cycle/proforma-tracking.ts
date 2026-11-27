import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { errorMessage } from '../../../core/services/api';
import { Skeleton } from '../../../shared/components/skeleton';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';
import { Tracking } from '../sales.models';
import { SalesService } from '../sales.service';

/** Suivi d'une proforma : avancements de livraison et de facturation, puis quantités par ligne source (jamais additionnées entre unités). */
@Component({
  selector: 'app-proforma-tracking',
  imports: [MatButtonModule, Skeleton, QtyPipe],
  template: `
    @if (error()) {<div class="card err" role="alert">{{ error() }} <button mat-button type="button" (click)="load()">Réessayer</button></div>}
    @else if (!t()) {<div class="card"><app-skeleton [count]="4" /></div>}
    @else {
      @if (t()!.legacyFlow) {<div class="card info" role="status">Proforma convertie directement en facture (ancien parcours) et conservée telle quelle : ses livraisons ne sont pas suivies par ligne.</div>}
      <div class="progress">
        @for (p of [{ key: 'delivery', title: 'Livraison', v: t()!.delivery, unit: 'Bons de livraison', done: 'validés' }, { key: 'billing', title: 'Facturation', v: t()!.billing, unit: 'Factures', done: 'validées' }]; track p.key) {
          <section class="card gauge {{ p.key }}"><div class="top"><h3>{{ p.title }}</h3><span class="chip" [class.ok]="p.v.state === 'full'" [class.warn]="p.v.state === 'partial'">{{ p.v.label }}</span></div>
            <div class="pct">{{ p.v.pct }} %</div>
            <div class="bar" role="progressbar" [attr.aria-label]="'Progression de la ' + p.title.toLowerCase()" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="p.v.pct"><span [style.width.%]="p.v.pct"></span></div>
            <p class="muted small">{{ p.unit }} : {{ p.v.count }} · {{ p.done }} : {{ p.v.validatedCount }}</p></section>}
      </div>
      <section class="card quantities"><h3>Quantités par ligne</h3>
        <div class="table-wrap"><table class="t qty-table"><thead><tr><th>Référence</th><th>Désignation</th><th>Unité</th><th class="r">Commandée</th><th class="r">Livrée</th><th class="r">Restante à livrer</th><th class="r">Facturée</th><th class="r">Livrée non facturée</th><th class="r">Reste à facturer</th></tr></thead>
          <tbody>@for (l of t()!.lines; track l.lineId) {<tr>
            <td class="ref" data-label="Référence">{{ l.reference || '—' }}</td><td data-label="Désignation">{{ l.designation }}@if (l.kind === 'service') {<small class="muted">Service (sans stock)</small>}</td><td data-label="Unité">{{ l.unit || '—' }}</td>
            <td class="r" data-label="Commandée"><span class="v">{{ l.ordered | qty }}</span></td>
            <td class="r" data-label="Livrée"><span class="v">{{ l.delivered | qty }}</span>@if (l.returned) {<small class="muted">{{ l.returned | qty }} retournée(s)</small>}</td>
            <td class="r" data-label="Restante à livrer"><strong class="v" [class.todo]="l.remainingToDeliver > 0">{{ l.remainingToDeliver | qty }}</strong>@if (l.inDraftDeliveries) {<small class="muted">{{ l.inDraftDeliveries | qty }} en préparation</small>}</td>
            <td class="r" data-label="Facturée"><span class="v">{{ l.invoiced | qty }}</span>@if (l.inDraftInvoices) {<small class="muted">{{ l.inDraftInvoices | qty }} en brouillon</small>}</td>
            <td class="r" data-label="Livrée non facturée"><strong class="v" [class.todo]="l.deliveredNotInvoiced > 0">{{ l.deliveredNotInvoiced | qty }}</strong></td>
            <td class="r" data-label="Reste à facturer"><span class="v">{{ l.remainingToBill | qty }}</span></td></tr>}</tbody></table></div>
        <p class="muted small">{{ t()!.method }}</p>
      </section>
    }`,
  styles: `:host{display:flex;flex-direction:column;gap:16px;margin-top:16px}.progress{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}h3{margin:0;font-size:16px}
    .pct{font-size:28px;font-weight:600;letter-spacing:-.02em;margin:8px 0;font-variant-numeric:tabular-nums}.bar{height:10px;border-radius:999px;background:var(--brand-100);overflow:hidden}.bar span{display:block;height:100%;background:var(--brand);border-radius:999px;transition:width var(--t-med) var(--ease)}.gauge.billing .bar span{background:var(--accent)}.gauge.billing .bar{background:var(--accent-100)}
    .small{font-size:12px;margin:8px 0 0}.quantities h3{margin-bottom:12px}.qty-table{min-width:900px}.qty-table th{white-space:normal;vertical-align:bottom}.qty-table small{display:block;font-size:11px}.ref{color:var(--brand);font-weight:600;overflow-wrap:anywhere}.todo{color:var(--accent-ink);background:var(--accent-100);border-radius:6px;padding:1px 8px}.err{color:var(--danger)}
    @media (max-width:720px){.qty-table{min-width:0}.qty-table thead{display:none}.qty-table,.qty-table tbody,.qty-table tr{display:block}.qty-table tr{border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:10px;padding:6px 0}.qty-table td{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border:0;padding:3px 14px;text-align:right}.qty-table td::before{content:attr(data-label);color:var(--muted);font-size:12px;font-weight:600;text-align:left}.qty-table small{width:100%;text-align:right}}`,
})
export class ProformaTracking {
  id = input.required<string>(); refresh = input<unknown>(0);
  private svc = inject(SalesService);
  t = signal<Tracking | null>(null); error = signal('');
  constructor() { effect(() => { this.id(); this.refresh(); untracked(() => this.load()); }); }
  load() { this.error.set(''); this.svc.tracking(this.id()).subscribe({ next: (t) => this.t.set(t), error: (e) => this.error.set(errorMessage(e)) }); }
}
