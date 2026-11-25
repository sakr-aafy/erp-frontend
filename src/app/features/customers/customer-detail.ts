import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../../shared/components/icon';
import { Skeleton } from '../../shared/components/skeleton';
import { Customer2 } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { CustomerActions, StatusAction } from './customer-actions.service';
import { STATUS_CHIP, STATUS_HELP, STATUS_LABEL, TYPE_ICON, TYPE_LABEL } from './customer.labels';
import { CustomerService } from './customer.service';
import { CustomerSummary } from './customer.types';
import { TabActivities } from './tabs/tab-activities';
import { TabAddresses } from './tabs/tab-addresses';
import { TabContacts } from './tabs/tab-contacts';
import { TabDocuments } from './tabs/tab-documents';
import { TabInfo } from './tabs/tab-info';
import { TabPayments } from './tabs/tab-payments';
import { TabSummary } from './tabs/tab-summary';
import { TabTransactions } from './tabs/tab-transactions';

type TabKey = 'summary' | 'info' | 'contacts' | 'addresses' | 'transactions' | 'payments' | 'documents' | 'activities';

/** Fiche client : en-tête, indicateurs réels (calculés par le serveur) et huit onglets. L'onglet actif est dans l'URL (?tab=…), donc partageable. */
@Component({
  selector: 'app-customer-detail',
  imports: [DatePipe, RouterLink, MatButtonModule, MatMenuModule, Icon, Skeleton, MoneyPipe, TabSummary, TabInfo, TabContacts, TabAddresses, TabTransactions, TabPayments, TabDocuments, TabActivities],
  template: `
    <div class="page">
      <a class="back" routerLink="/customers"><app-icon name="arrow_back" />Retour aux clients</a>
      @if (!s()) {<div class="card"><app-skeleton /></div>} @else {
        <section class="card head">
          <span class="logo"><app-icon [name]="typeIcon[c()!.type]" /></span>
          <div class="id">
            <div class="nm"><h1>{{ c()!.name }}</h1><span class="chip {{ chip[c()!.status] }}">{{ status[c()!.status] }}</span></div>
            <div class="sub"><span class="code">{{ c()!.code ?? '—' }}</span><span>·</span><span>{{ typeLabel[c()!.type] === 'Société' ? 'Client professionnel' : 'Client passager' }}</span>
              @if (place()) {<span>·</span><span>{{ place() }}</span>}</div>
          </div>
          <div class="acts">
            @if (canEdit()) {<a mat-stroked-button [routerLink]="['edit']"><app-icon name="edit" />Modifier</a>}
            <button mat-icon-button type="button" [matMenuTriggerFor]="menu" aria-label="Actions sur le client"><app-icon name="more_vert" /></button>
            <mat-menu #menu="matMenu" xPosition="before">
              <button mat-menu-item type="button" (click)="actions.print(c()!)"><app-icon name="print" />Imprimer la fiche</button>
              @if (canQuote()) {<a mat-menu-item [routerLink]="['/quotations', 'new']" [queryParams]="{ customerId: c()!.id }"><app-icon name="request_quote" />Créer un devis</a>}
              @for (a of statusActions(); track a.target) {<button mat-menu-item type="button" [class.danger]="a.danger" (click)="changeStatus(a)"><app-icon [name]="a.icon" />{{ a.label }}</button>}
              @if (canDelete()) {<button mat-menu-item type="button" class="danger" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
            </mat-menu>
          </div>
        </section>

        @if (c()!.status !== 'active') {<p class="banner {{ c()!.status }}" role="status"><app-icon [name]="c()!.status === 'blocked' ? 'block' : 'info'" /><span><strong>{{ c()!.statusLabel }}</strong>@if (c()!.statusReason) { — {{ c()!.statusReason }}}. {{ help[c()!.status] }}</span></p>}

        @if (s()!.finance; as f) {
          <div class="kpis">
            <div class="kpi"><span class="muted">CA total (HT, net des avoirs)</span><strong>{{ f.revenueHtMinor | money }}</strong></div>
            <div class="kpi"><span class="muted">Factures impayées</span><strong [class.neg]="f.unpaidMinor > 0">{{ f.unpaidMinor | money }}</strong>@if (f.overdueMinor > 0) {<span class="sm neg">dont {{ f.overdueMinor | money }} échus</span>}</div>
            <div class="kpi"><span class="muted">Dernière vente</span><strong>{{ f.lastSaleDate ? (f.lastSaleDate | date: 'dd/MM/yyyy' : 'UTC') : '—' }}</strong>@if (f.lastInvoiceNumber) {<span class="sm muted">{{ f.lastInvoiceNumber }}</span>}</div>
            <div class="kpi"><span class="muted">Crédit disponible</span><strong>{{ f.availableCreditMinor === null ? 'Illimité' : (f.availableCreditMinor | money) }}</strong>@if (f.creditLimitMinor !== null) {<span class="sm muted">sur {{ f.creditLimitMinor | money }}</span>}</div>
          </div>
        }

        <nav class="tabs" role="tablist" aria-label="Sections de la fiche client">
          @for (t of tabs(); track t.key) {<button type="button" role="tab" class="tab" [class.on]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="go(t.key)"><app-icon [name]="t.icon" />{{ t.label }}</button>}
        </nav>

        <div class="panel" role="tabpanel">
          @switch (tab()) {
            @case ('summary') {<app-tab-summary [s]="s()!" />}
            @case ('info') {<app-tab-info [c]="c()!" (saved)="onCustomer($event)" />}
            @case ('contacts') {<app-tab-contacts [c]="c()!" (changed)="onCustomer($event)" />}
            @case ('addresses') {<app-tab-addresses [c]="c()!" (saved)="onCustomer($event)" />}
            @case ('transactions') {<app-tab-transactions [c]="c()!" [allowed]="s()!.allowedKinds" />}
            @case ('payments') {<app-tab-payments [c]="c()!" (changed)="refresh()" />}
            @case ('documents') {<app-tab-documents [c]="c()!" />}
            @case ('activities') {<app-tab-activities [c]="c()!" />}
          }
        </div>
      }
    </div>`,
  styles: `.back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;margin-bottom:12px;font-size:14px}.back:hover{color:var(--brand)}
    .head{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:3px solid var(--accent)}.logo{display:grid;place-items:center;width:56px;height:56px;border-radius:var(--r-lg);background:var(--brand);color:#fff;flex:none;--icon-size:1.6rem}
    .id{flex:1;min-width:220px}.nm{display:flex;align-items:center;gap:12px;flex-wrap:wrap}h1{margin:0;font-size:22px;line-height:30px;font-weight:600;letter-spacing:-.01em;overflow-wrap:anywhere}
    .sub{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:14px;margin-top:4px}.code{font-weight:600;color:var(--brand)}.acts{display:flex;gap:8px;align-items:center}
    .danger{color:var(--danger)}.banner{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;padding:10px 14px;border-radius:var(--r-md);border:1px solid var(--accent-300);background:var(--accent-50)}.banner.blocked{border-color:var(--danger-200);background:var(--danger-50)}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:16px 0}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;display:flex;flex-direction:column;gap:4px;box-shadow:var(--shadow-sm)}
    .kpi strong{font-size:20px;font-variant-numeric:tabular-nums}.sm{font-size:12px}.neg{color:var(--danger)}
    .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0}.tab{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border:1px solid var(--border-strong);border-radius:999px;background:var(--surface);color:var(--text-2);font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:all var(--t-fast) var(--ease)}
    .tab:hover{border-color:var(--brand);color:var(--brand)}.tab:focus-visible{outline:none;box-shadow:var(--ring)}.tab.on{background:var(--brand);border-color:var(--brand);color:#fff}.tab app-icon{--icon-size:1rem}
    @media (max-width:600px){.kpis{grid-template-columns:1fr 1fr;gap:8px}.kpi{padding:10px 12px}.kpi strong{font-size:16px}.tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px;margin-right:-16px;padding-right:16px;scrollbar-width:thin}.tab{flex:none}.logo{width:44px;height:44px}h1{font-size:19px}.acts{width:100%;justify-content:flex-end}}`,
})
export class CustomerDetail {
  id = input.required<string>();
  private svc = inject(CustomerService); private toast = inject(ToastService); private router = inject(Router); private route = inject(ActivatedRoute); private auth = inject(AuthService);
  actions = inject(CustomerActions);
  s = signal<CustomerSummary | null>(null);
  c = computed(() => this.s()?.customer ?? null);
  tab = signal<TabKey>('summary');
  typeIcon = TYPE_ICON; typeLabel = TYPE_LABEL; status = STATUS_LABEL; chip = STATUS_CHIP; help = STATUS_HELP;
  place = computed(() => [this.c()?.address.city, this.c()?.address.country].filter(Boolean).join(', '));
  canEdit = computed(() => this.auth.has('customers:update') && this.c()?.status !== 'archived');
  canDelete = computed(() => this.auth.has('customers:delete'));
  canQuote = computed(() => this.auth.has('quotations:create') && !!this.c()?.canSell);
  statusActions = computed(() => { const c = this.c(); return c ? this.actions.statusActions(c) : []; });
  /** Onglets visibles : un onglet financier n'apparaît que si l'utilisateur a la permission du module concerné (le serveur la revérifie). */
  tabs = computed(() => {
    const a = this.auth; const anyDoc = ['quotations:view', 'proformas:view', 'invoices:view', 'deliveryNotes:view'].some((p) => a.has(p));
    return ([
      { key: 'summary', label: 'Résumé', icon: 'dashboard', show: true }, { key: 'info', label: 'Informations', icon: 'info', show: true }, { key: 'contacts', label: 'Contacts', icon: 'group', show: true },
      { key: 'addresses', label: 'Adresses', icon: 'place', show: true }, { key: 'transactions', label: 'Transactions', icon: 'receipt_long', show: anyDoc }, { key: 'payments', label: 'Paiements', icon: 'payments', show: a.has('invoices:view') },
      { key: 'documents', label: 'Documents', icon: 'folder', show: true }, { key: 'activities', label: 'Activités', icon: 'history', show: true },
    ] as { key: TabKey; label: string; icon: string; show: boolean }[]).filter((t) => t.show);
  });

  constructor() {
    this.route.queryParamMap.subscribe((q) => { const t = q.get('tab') as TabKey | null; this.tab.set(t && this.tabs().some((x) => x.key === t) ? t : 'summary'); });
  }
  ngOnInit() { this.refresh(true); }
  refresh(first = false) {
    this.svc.summary(this.id()).subscribe({ next: (s) => this.s.set(s), error: (e) => { this.toast.error(errorMessage(e)); if (first) this.router.navigateByUrl('/customers'); } });
  }
  go(t: TabKey) { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t === 'summary' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true }); }
  onCustomer(c: Customer2) { const cur = this.s(); if (cur) this.s.set({ ...cur, customer: c }); this.refresh(); }
  changeStatus(a: StatusAction) {
    this.actions.changeStatus(this.c()!, a).subscribe({ next: (u) => u && this.onCustomer(u), error: (e) => this.toast.error(errorMessage(e)) });
  }
  remove() { this.actions.remove(this.c()!).subscribe({ next: (ok) => ok && this.router.navigateByUrl('/customers'), error: (e) => this.toast.error(errorMessage(e)) }); }
}
