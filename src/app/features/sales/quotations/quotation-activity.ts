import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { QuotationActivity } from '../sales.models';
import { SalesService } from '../sales.service';

const ICON: Record<string, string> = {
  created: 'note_add', line_added: 'playlist_add', line_removed: 'delete', price_changed: 'payments', discount_changed: 'percent', quantity_changed: 'calculate', designation_changed: 'edit', vat_changed: 'account_balance', lines_reordered: 'swap_vert',
  customer_changed: 'person', payment_terms_changed: 'credit_card', validity_changed: 'calendar', date_changed: 'calendar', delivery_address_changed: 'place', global_discount_changed: 'percent', notes_changed: 'description',
  marked_sent: 'send', email_sent: 'mail', accepted: 'check_circle', refused: 'cancel', expired: 'event_busy', duplicated: 'content_copy', converted_proforma: 'description', converted_invoice: 'receipt', invoice_unlinked: 'undo',
  delivery_time_changed: 'local_shipping', version_created: 'layers', version_abandoned: 'undo', cancelled: 'block', document_added: 'attach_file', document_updated: 'edit', document_removed: 'delete', comment_added: 'chat', comment_edited: 'chat', comment_archived: 'archive', migrated: 'info',
};
const ROUTE: Record<string, string> = { quotation: '/quotations', proforma: '/proformas', invoice: '/invoices' };

/** Onglet Activité : chronologie métier immuable du devis, du plus récent au plus ancien, filtrable et chargée progressivement. */
@Component({
  selector: 'app-quotation-activity',
  imports: [DatePipe, RouterLink, MatButtonModule, MatFormFieldModule, MatSelectModule, Icon, EmptyState, Skeleton],
  template: `
    <div class="top"><h2>Historique du devis</h2>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter"><mat-label>Type d’activité</mat-label>
        <mat-select [value]="kind()" (selectionChange)="kind.set($event.value); load(true)"><mat-option value="">Toutes les activités</mat-option>@for (k of kinds(); track k.value) {<mat-option [value]="k.value">{{ k.label }}</mat-option>}</mat-select></mat-form-field></div>
    @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}<button mat-button type="button" (click)="load(true)">Réessayer</button></div>}
    @if (loading() && !items().length) {<div class="card"><app-skeleton /></div>}
    @else if (!items().length && !error()) {<div class="card"><app-empty-state icon="history" [message]="kind() ? 'Aucune activité de ce type.' : 'Aucune activité enregistrée. Les devis antérieurs à cette fonctionnalité n’ont pas d’historique détaillé.'" /></div>}
    @else {
      <ol class="tl">@for (a of items(); track a.id) {
        <li [class.system]="a.system"><span class="dot" [class.accent]="highlight(a.kind)"><app-icon [name]="icon[a.kind] ?? 'info'" /></span>
          <div class="card body">
            <strong>{{ a.title }}</strong>
            @if (a.line; as l) {<span class="line">Article : @if (l.reference) {<span class="ref">{{ l.reference }}</span> — }{{ l.designation }}</span>}
            @if (a.description) {<span>{{ a.description }}</span>}
            @if (a.valueType && (a.oldValue !== null || a.newValue !== null)) {
              <dl class="values">@if (a.oldValue !== null) {<div><dt>Ancienne valeur</dt><dd class="old">{{ format(a, a.oldValue) }}</dd></div>}<div><dt>{{ a.oldValue !== null ? 'Nouvelle valeur' : 'Montant TTC' }}</dt><dd>{{ format(a, a.newValue) }}</dd></div></dl>}
            @if (a.related; as r) {@if (route(r.type); as base) {<a [routerLink]="[base, r.id]" class="doc"><app-icon name="open_in_new" />{{ r.number ?? 'Voir le document' }}</a>}}
            <span class="meta muted">{{ a.occurredAt | date: 'dd/MM/yyyy HH:mm' }} · {{ a.user ?? 'Utilisateur inconnu' }}</span>
          </div></li>}</ol>
      @if (items().length < total()) {<div class="more"><button mat-stroked-button type="button" (click)="more()" [disabled]="loading()">Voir plus ({{ total() - items().length }})</button></div>}
    }`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.filter{width:280px;max-width:100%}.err{display:flex;gap:8px;align-items:center;color:var(--danger);margin-bottom:12px}
    .tl{list-style:none;margin:0;padding:0 0 0 8px;position:relative}.tl::before{content:'';position:absolute;left:26px;top:8px;bottom:8px;width:2px;background:var(--border)}.tl li{display:flex;gap:14px;margin-bottom:12px;position:relative}
    .dot{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--brand-50);color:var(--brand);flex:none;z-index:1;box-shadow:0 0 0 4px var(--bg)}.dot.accent{background:var(--accent);color:var(--brand-900)}
    .body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;padding:12px 16px;overflow-wrap:anywhere}.line{color:var(--text-2)}.ref{font-weight:600;color:var(--brand)}
    .values{display:flex;gap:10px 28px;flex-wrap:wrap;margin:0}.values div{display:flex;flex-direction:column;min-width:0}.values dt{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}.values dd{margin:0;font-variant-numeric:tabular-nums;white-space:pre-wrap}.old{color:var(--muted)}
    .doc{display:inline-flex;gap:6px;align-items:center;align-self:flex-start;color:var(--brand)}.meta{font-size:12px}.more{display:flex;justify-content:center;margin-top:8px}`,
})
export class QuotationActivityTab {
  id = input.required<string>();
  private svc = inject(SalesService); private ref = inject(ReferenceDataService);
  icon = ICON; items = signal<QuotationActivity[]>([]); total = signal(0); loading = signal(true); error = signal(''); kind = signal(''); kinds = signal<{ value: string; label: string }[]>([]);
  private page = 1; private pending: Subscription | undefined;
  ngOnInit() { this.load(true); }
  load(reset: boolean) {
    if (reset) { this.page = 1; this.items.set([]); } this.loading.set(true); this.error.set(''); this.pending?.unsubscribe();
    this.pending = this.svc.quotationActivities(this.id(), this.page, this.kind()).subscribe({
      next: (r) => { this.items.set(reset ? r.items : [...this.items(), ...r.items]); this.total.set(r.total); this.kinds.set(r.kinds); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
  more() { this.page++; this.load(false); }
  highlight = (k: string) => ['version_created', 'cancelled', 'accepted', 'refused', 'expired', 'email_sent', 'marked_sent', 'converted_invoice', 'converted_proforma'].includes(k);
  route = (t: string) => ROUTE[t] ?? null;
  format(a: QuotationActivity, v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    switch (a.valueType) {
      case 'money': return this.ref.format(Number(v));
      case 'percent': return `${Number(v).toLocaleString('fr-FR')} %`;
      case 'number': return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
      case 'date': return String(v).split('-').reverse().join('/');
      default: return String(v);
    }
  }
}
