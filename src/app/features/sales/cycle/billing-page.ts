import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { PageHeader } from '../../../shared/components/page-header';
import { Skeleton } from '../../../shared/components/skeleton';
import { DecimalInput, formatDecimal } from '../../../shared/directives/decimal-input.directive';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';
import { Billable, BL_BILLING_LABELS, CalcPreview, SalesDoc } from '../sales.models';
import { SalesService } from '../sales.service';

/** Quantités par unité : des unités différentes ne s'additionnent jamais. */
export function byUnit(lines: Billable['lines'], pick: (l: Billable['lines'][number]) => number) {
  const m = new Map<string, number>();
  for (const l of lines) if (pick(l) > 0) m.set(l.unit ?? '', Math.round(((m.get(l.unit ?? '') ?? 0) + pick(l)) * 1000) / 1000);
  return [...m].map(([u, q]) => `${formatDecimal(q)}${u ? ' ' + u : ''}`).join(' · ') || '—';
}

/** Facturation des bons de livraison : un par un ou regroupés, avec des quantités ajustables et un aperçu calculé par le serveur. */
@Component({
  selector: 'app-billing-page',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, Icon, PageHeader, Skeleton, EmptyState, MoneyPipe, QtyPipe, DecimalInput],
  template: `
    <div class="page">
      <app-page-header title="Facturer des bons de livraison" subtitle="Bons validés ayant une quantité livrée non facturée. Les prix, remises et taxes viennent des documents sources.">
        <a mat-stroked-button routerLink="/delivery-notes"><app-icon name="arrow_back" />Bons de livraison</a>
      </app-page-header>
      @if (error()) {<div class="card err" role="alert"><app-icon name="error" /><span>{{ error() }}</span></div>}
      <div class="card list">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" placeholder="N° de BL, client ou proforma" /></mat-form-field>
          @if (sourceId() || ids()) {<a mat-button routerLink="/invoices/from-deliveries" (click)="clearFilter()">Afficher tous les BL à facturer</a>}
        </div>
        @if (!items()) {<app-skeleton />}
        @else if (!shown().length) {<app-empty-state icon="local_shipping" message="Aucun bon de livraison à facturer : validez d’abord une livraison."><a mat-stroked-button routerLink="/delivery-notes">Voir les bons de livraison</a></app-empty-state>}
        @else {
          <div class="table-wrap"><table class="lines bl"><thead><tr><th><span class="sr">Sélection</span></th><th>Numéro</th><th>Date</th><th>Client</th><th>Proforma / source</th><th class="r">Livré</th><th class="r">À facturer</th><th class="r">Montant TTC</th><th>Statut</th></tr></thead>
            <tbody>@for (d of shown(); track d.id) {
              <tr [class.on]="isPicked(d.id)" [class.dim]="!compatible(d)">
                <td class="pick"><mat-checkbox [checked]="isPicked(d.id)" [disabled]="!compatible(d)" (change)="toggle(d, $event.checked)" [aria-label]="'Sélectionner ' + d.number" /></td>
                <td class="nw" data-label="Numéro"><a [routerLink]="['/delivery-notes', d.id]">{{ d.number }}</a></td>
                <td class="nw" data-label="Date">{{ d.date | date: 'dd/MM/yyyy' : 'UTC' }}</td><td data-label="Client">{{ d.customerName }}</td>
                <td [class.nw]="!!d.source" data-label="Proforma / source">{{ d.source?.number ?? 'Sans document source' }}</td>
                <td class="r nw" data-label="Livré">{{ delivered(d) }}</td><td class="r nw" data-label="À facturer"><strong>{{ available(d) }}</strong></td>
                <td class="r nw" data-label="Montant TTC">{{ d.totalTtcMinor | money }}</td>
                <td data-label="Statut"><span class="chip ok">Validé</span> <span class="chip" [class.warn]="d.billing === 'partial'">{{ billingLabel(d.billing) }}</span></td>
              </tr>}</tbody></table></div>
          @if (mode() === 'grouped' && selected().length) {<p class="muted small" role="status">Les BL grisés appartiennent à un autre client ou à une autre proforma : ils se facturent séparément.</p>}
        }
      </div>

      @if (selected().length) {
        <div class="card compose">
          <div class="top"><h3>{{ selected().length }} BL sélectionné(s)</h3>
            <mat-button-toggle-group [value]="mode()" (change)="setMode($event.value)" aria-label="Mode de facturation">
              <mat-button-toggle value="grouped">Une seule facture</mat-button-toggle><mat-button-toggle value="individual">Une facture par BL</mat-button-toggle></mat-button-toggle-group></div>
          <mat-checkbox [checked]="partial()" (change)="setPartial($event.checked)">Ajuster les quantités à facturer</mat-checkbox>
          @if (partial()) {<div class="table-wrap"><table class="lines"><thead><tr><th>BL</th><th>Désignation</th><th class="r">Disponible</th><th class="r">À facturer</th></tr></thead>
            <tbody>@for (r of rows(); track r.key) {<tr><td>{{ r.number }}</td><td>{{ r.designation }}</td><td class="r">{{ r.available | qty }} {{ r.unit }}</td>
              <td class="r"><input appDecimal class="q" [formControl]="r.control" [class.bad]="over(r)" [attr.aria-label]="'Quantité à facturer ' + r.number + ' ' + r.designation" />@if (over(r)) {<small class="bad-t">Maximum {{ r.available | qty }}</small>}</td></tr>}</tbody></table></div>}
          <div class="foot">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date"><mat-label>Date de facture</mat-label><input matInput type="date" [formControl]="issueDate" /></mat-form-field>
            <div class="sum" aria-live="polite">
              @if (preview(); as p) {<div><span>Total HT</span><strong>{{ p.totals.totalHtMinor | money }}</strong></div>
                @if (p.totals.globalDiscountMinor) {<div><span>dont remise supplémentaire répartie</span><span>- {{ p.totals.globalDiscountMinor | money }}</span></div>}
                <div><span>TVA</span><span>{{ p.totals.totalVatMinor | money }}</span></div><div class="ttc"><span>Net à payer</span><strong>{{ p.totals.totalPayableMinor | money }}</strong></div>}
              @else if (mode() === 'individual') {<div class="ttc"><span>Total TTC indicatif des {{ selected().length }} factures</span><strong>{{ estimate() | money }}</strong></div>}
              @else if (previewError()) {<p class="bad-t" role="alert">{{ previewError() }}</p>} @else {<p class="muted">Calcul en cours…</p>}
            </div>
          </div>
          <p class="muted small">La facture est créée en brouillon : le solde du client n’évolue qu’à sa validation. Aucune sortie de stock supplémentaire.</p>
          <div class="acts"><button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="create()"><app-icon name="receipt" />Facturer les BL sélectionnés</button></div>
        </div>}
    </div>`,
  styles: `.err{display:flex;gap:8px;color:var(--danger);margin-bottom:16px}.lines{min-width:880px}.compose .lines{min-width:520px}.pick{width:44px}.nw{white-space:nowrap}tr.on{background:var(--accent-50)}tr.dim{opacity:.45}.small{font-size:12px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .compose{margin-top:16px;display:flex;flex-direction:column;gap:12px;border-top:3px solid var(--accent)}.top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}h3{margin:0;font-size:16px}input.q{width:90px;font:inherit;text-align:right;border:1px solid var(--border-strong);border-radius:6px;padding:6px 8px}input.q.bad{border-color:var(--danger)}.bad-t{color:var(--danger);display:block;font-size:12px}
    .foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}.date{width:200px}.sum{min-width:min(340px,100%)}.sum div{display:flex;justify-content:space-between;gap:16px;padding:2px 0}.sum .ttc{border-top:1px solid var(--border);margin-top:4px;padding-top:6px;color:var(--brand);font-size:16px}.acts{display:flex;justify-content:flex-end}
    @media (max-width:720px){.list .lines{min-width:0}.list .lines thead{display:none}.list .lines,.list .lines tbody,.list .lines tr{display:block}.list .lines tr{border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:10px;padding:6px 0}.list .lines td{display:flex;justify-content:space-between;gap:12px;border:0;padding:3px 14px;text-align:right}.list .lines td::before{content:attr(data-label);color:var(--muted);font-size:12px;font-weight:600;text-align:left}.pick{width:auto;justify-content:flex-start!important}}`,
})
export class BillingPage {
  /** Préfiltre : proforma (?sourceId=) ou bons présélectionnés (?ids=a,b). */
  sourceId = input<string>(); ids = input<string>();
  private svc = inject(SalesService); private toast = inject(ToastService); private router = inject(Router);
  items = signal<Billable[] | null>(null); selected = signal<string[]>([]); mode = signal<'grouped' | 'individual'>('grouped'); partial = signal(false);
  preview = signal<CalcPreview | null>(null); previewError = signal(''); error = signal(''); busy = signal(false); q = signal('');
  search = new FormControl('', { nonNullable: true }); issueDate = new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true });
  rows = signal<{ key: string; noteId: string; lineId: string; number: string; designation: string; unit: string | null; available: number; control: FormControl<number | null> }[]>([]);
  shown = computed(() => { const q = this.q().trim().toLowerCase(); return (this.items() ?? []).filter((d) => !q || [d.number, d.customerName, d.source?.number ?? ''].some((x) => x.toLowerCase().includes(q))); });
  private picked = computed(() => (this.items() ?? []).filter((d) => this.selected().includes(d.id)));
  estimate = computed(() => this.picked().reduce((s, d) => s + d.totalTtcMinor, 0));
  isPicked = (id: string) => this.selected().includes(id);
  /** Regroupement : même client et même cycle (même proforma, ou BL sans document source). */
  compatible = (d: Billable) => this.mode() === 'individual' || !this.picked().length || this.picked()[0]!.groupKey === d.groupKey;
  delivered = (d: Billable) => byUnit(d.lines, (l) => l.quantity - l.returned);
  available = (d: Billable) => byUnit(d.lines, (l) => l.available);
  billingLabel = (s: string) => BL_BILLING_LABELS[s] ?? s;
  over = (r: { available: number; control: FormControl<number | null> }) => (Number(r.control.value) || 0) > r.available + 1e-9;
  private seq = 0;

  ngOnInit() {
    this.search.valueChanges.subscribe((v) => this.q.set(v));
    this.issueDate.valueChanges.subscribe(() => this.refresh());
    this.load();
  }
  load(select = true) {
    this.svc.billableDeliveries({ ...(this.sourceId() && { sourceId: this.sourceId() }) }).subscribe({
      next: (r) => {
        const wanted = this.ids()?.split(',') ?? [];
        this.items.set(wanted.length ? r.items.filter((d) => wanted.includes(d.id)) : r.items);
        // Depuis une proforma ou un BL : la sélection demandée est préparée (les BL d'un même cycle)
        if (select && (wanted.length || this.sourceId())) { const first = this.items()![0]; this.selected.set(this.items()!.filter((d) => d.groupKey === first?.groupKey).map((d) => d.id)); }
        else this.selected.update((s) => s.filter((id) => this.items()!.some((d) => d.id === id)));
        this.rebuild();
      },
      error: (e) => { this.items.set([]); this.error.set(errorMessage(e)); },
    });
  }
  clearFilter() { setTimeout(() => this.load(false)); }
  toggle(d: Billable, on: boolean) { this.selected.update((s) => (on ? [...s, d.id] : s.filter((x) => x !== d.id))); this.error.set(''); this.rebuild(); }
  setMode(m: 'grouped' | 'individual') {
    this.mode.set(m);
    if (m === 'grouped') { const first = this.picked()[0]; this.selected.set(this.picked().filter((d) => d.groupKey === first?.groupKey).map((d) => d.id)); }
    this.rebuild();
  }
  setPartial(v: boolean) { this.partial.set(v); this.rebuild(); }
  private rebuild() {
    const old = new Map(this.rows().map((r) => [r.key, r.control]));
    this.rows.set(this.picked().flatMap((d) => d.lines.filter((l) => l.available > 0).map((l) => {
      const key = `${d.id}:${l.lineId}`; let control = old.get(key);
      if (!control) { control = new FormControl<number | null>(l.available); control.valueChanges.subscribe(() => this.refresh()); }
      return { key, noteId: d.id, lineId: l.lineId, number: d.number, designation: l.designation, unit: l.unit, available: l.available, control };
    })));
    this.refresh();
  }
  private body() {
    const lines = this.partial() ? this.rows().map((r) => ({ deliveryNoteId: r.noteId, lineId: r.lineId, quantity: Number(r.control.value) || 0 })).filter((l) => l.quantity > 0) : null;
    return { ids: lines ? this.selected().filter((id) => lines.some((l) => l.deliveryNoteId === id)) : this.selected(), lines, issueDate: this.issueDate.value };
  }
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refresh() {
    const seq = ++this.seq; this.preview.set(null); this.previewError.set(''); clearTimeout(this.timer);
    if (!this.selected().length || this.mode() === 'individual') return;
    this.timer = setTimeout(() => {
      const b = this.body();
      if (!b.ids.length) { this.previewError.set('Indiquez au moins une quantité à facturer.'); return; }
      this.svc.previewDeliveryInvoice({ deliveryNoteIds: b.ids, ...(b.lines && { lines: b.lines }), ...(b.issueDate && { issueDate: b.issueDate }) })
        .subscribe({ next: (p) => { if (seq === this.seq) this.preview.set(p); }, error: (e) => { if (seq === this.seq) this.previewError.set(errorMessage(e)); } });
    }, 250);
  }
  create() {
    if (this.partial() && this.rows().some((r) => this.over(r))) { this.error.set('Une quantité dépasse la quantité livrée non facturée.'); return; }
    const b = this.body();
    if (!b.ids.length) { this.error.set('Indiquez au moins une quantité à facturer.'); return; }
    this.busy.set(true); this.error.set('');
    this.svc.invoiceDeliveries({ deliveryNoteIds: b.ids, mode: this.mode(), ...(b.lines && { lines: b.lines }), ...(b.issueDate && { issueDate: b.issueDate }) }).subscribe({
      next: (r) => {
        const many = 'items' in r ? r.items : null;
        if (many && many.length > 1) { this.toast.success(`${many.length} factures brouillon créées`); this.router.navigate(['/invoices']); return; }
        const one = many ? many[0]! : (r as SalesDoc); this.toast.success('Facture brouillon créée'); this.router.navigate(['/invoices', one.id]);
      },
      // Une facturation concurrente est signalée et la liste actualisée
      error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); this.load(false); },
    });
  }
}
