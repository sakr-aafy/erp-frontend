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
import { SupplierDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { SupplierActions, SupplierStatusAction } from './supplier-actions.service';
import { FINANCE_PERMISSIONS, SUPPLIER_STATUS_CHIP, SUPPLIER_STATUS_HELP, SUPPLIER_STATUS_LABEL } from './supplier.labels';
import { SupplierService } from './supplier.service';
import { SupplierSummary } from './supplier.types';
import { TabActivities } from './tabs/tab-activities';
import { TabAddresses } from './tabs/tab-addresses';
import { TabContacts } from './tabs/tab-contacts';
import { TabDocuments } from './tabs/tab-documents';
import { TabInfo } from './tabs/tab-info';
import { TabPayments } from './tabs/tab-payments';
import { TabSummary } from './tabs/tab-summary';
import { TabTransactions } from './tabs/tab-transactions';

type TabKey = 'summary' | 'info' | 'contacts' | 'addresses' | 'transactions' | 'payments' | 'documents' | 'activities';

/** Fiche fournisseur : même structure que la fiche client (en-tête, indicateurs réels, huit onglets, onglet dans l'URL). */
@Component({
  selector: 'app-supplier-detail',
  imports: [DatePipe, RouterLink, MatButtonModule, MatMenuModule, Icon, Skeleton, MoneyPipe, TabSummary, TabInfo, TabContacts, TabAddresses, TabTransactions, TabPayments, TabDocuments, TabActivities],
  template: `
    <div class="page">
      <a class="back" routerLink="/suppliers"><app-icon name="arrow_back" />Retour aux fournisseurs</a>
      @if (!s()) {<div class="card"><app-skeleton /></div>} @else {
        <section class="card head">
          <span class="logo"><app-icon name="local_shipping" /></span>
          <div class="id">
            <div class="nm"><h1>{{ c()!.name }}</h1><span class="chip {{ chip[c()!.status] }}">{{ status[c()!.status] }}</span></div>
            <div class="sub"><span class="code">{{ c()!.code ?? '—' }}</span><span>·</span><span class="cat">{{ c()!.categoryName ?? 'Non classé' }}</span>@if (c()!.isForeign) {<span>·</span><span>Étranger ({{ c()!.currency }})</span>}
              @if (place()) {<span>·</span><span>{{ place() }}</span>}</div>
          </div>
          <div class="acts">
            @if (canEdit()) {<a mat-stroked-button [routerLink]="['edit']"><app-icon name="edit" />Modifier</a>}
            <button mat-icon-button type="button" [matMenuTriggerFor]="menu" aria-label="Actions sur le fournisseur"><app-icon name="more_vert" /></button>
            <mat-menu #menu="matMenu" xPosition="before">
              <button mat-menu-item type="button" (click)="actions.print(c()!)"><app-icon name="print" />Imprimer la fiche</button>
              @if (order(); as o) {<a mat-menu-item [routerLink]="o.link" [queryParams]="{ supplierId: c()!.id }"><app-icon [name]="o.icon" />{{ o.label }}</a>}
              @for (a of statusActions(); track a.target) {<button mat-menu-item type="button" [class.danger]="a.danger" (click)="changeStatus(a)"><app-icon [name]="a.icon" />{{ a.label }}</button>}
              @if (canDelete()) {<button mat-menu-item type="button" class="danger" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
            </mat-menu>
          </div>
        </section>

        @if (c()!.status !== 'active') {<p class="banner {{ c()!.status }}" role="status"><app-icon [name]="c()!.status === 'blocked' ? 'block' : 'info'" /><span><strong>{{ c()!.statusLabel }}</strong>@if (c()!.statusReason) { — {{ c()!.statusReason }}}. {{ help[c()!.status] }}</span></p>}
        @else if (c()!.ordersBlocked) {<p class="banner blocked" role="status"><app-icon name="warning" /><span><strong>Commandes bloquées</strong> — le solde dû dépasse le seuil ({{ c()!.effectiveThresholdMinor | money }}). Les règlements restent possibles.</span></p>}

        @if (s()!.finance; as f) {
          <div class="kpis">
            <div class="kpi"><span class="muted">Total des achats (HT, facturés)</span><strong>{{ f.purchasesHtMinor | money }}</strong></div>
            <div class="kpi"><span class="muted">Reste à payer</span><strong [class.neg]="f.unpaidMinor > 0">{{ f.unpaidMinor | money }}</strong>@if (f.overdueMinor > 0) {<span class="sm neg">dont {{ f.overdueMinor | money }} échus</span>}</div>
            <div class="kpi"><span class="muted">Dernier achat</span><strong>{{ f.lastPurchaseDate ? (f.lastPurchaseDate | date: 'dd/MM/yyyy' : 'UTC') : '—' }}</strong>@if (f.lastPurchaseNumber) {<span class="sm muted">{{ f.lastPurchaseNumber }}</span>}</div>
            <div class="kpi"><span class="muted">Seuil de blocage</span><strong>{{ f.thresholdMinor === null ? 'Aucun' : (f.thresholdMinor | money) }}</strong>@if (f.ordersBlocked) {<span class="sm neg">Dépassé</span>}</div>
          </div>
        }

        <nav class="tabs" role="tablist" aria-label="Sections de la fiche fournisseur">
          @for (t of tabs(); track t.key) {<button type="button" role="tab" class="tab" [class.on]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="go(t.key)"><app-icon [name]="t.icon" />{{ t.label }}</button>}
        </nav>

        <div class="panel" role="tabpanel">
          @switch (tab()) {
            @case ('summary') {<app-tab-summary [s]="s()!" />}
            @case ('info') {<app-tab-info [c]="c()!" (saved)="onSupplier($event)" />}
            @case ('contacts') {<app-tab-contacts [c]="c()!" (changed)="onSupplier($event)" />}
            @case ('addresses') {<app-tab-addresses [c]="c()!" (saved)="onSupplier($event)" />}
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
    .sub{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:14px;margin-top:4px}.code{font-weight:600;color:var(--brand)}.cat{color:var(--text-2)}.acts{display:flex;gap:8px;align-items:center}
    .danger{color:var(--danger)}.banner{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;padding:10px 14px;border-radius:var(--r-md);border:1px solid var(--accent-300);background:var(--accent-50)}.banner.blocked{border-color:var(--danger-200);background:var(--danger-50)}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:16px 0}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;display:flex;flex-direction:column;gap:4px;box-shadow:var(--shadow-sm)}
    .kpi strong{font-size:20px;font-variant-numeric:tabular-nums}.sm{font-size:12px}.neg{color:var(--danger)}
    .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0}.tab{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border:1px solid var(--border-strong);border-radius:999px;background:var(--surface);color:var(--text-2);font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:all var(--t-fast) var(--ease)}
    .tab:hover{border-color:var(--brand);color:var(--brand)}.tab:focus-visible{outline:none;box-shadow:var(--ring)}.tab.on{background:var(--brand);border-color:var(--brand);color:#fff}.tab app-icon{--icon-size:1rem}
    @media (max-width:600px){.kpis{grid-template-columns:1fr 1fr;gap:8px}.kpi{padding:10px 12px}.kpi strong{font-size:16px}.tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px;margin-right:-16px;padding-right:16px;scrollbar-width:thin}.tab{flex:none}.logo{width:44px;height:44px}h1{font-size:19px}.acts{width:100%;justify-content:flex-end}}`,
})
export class SupplierDetail {
  id = input.required<string>();
  private svc = inject(SupplierService); private toast = inject(ToastService); private router = inject(Router); private route = inject(ActivatedRoute); private auth = inject(AuthService);
  actions = inject(SupplierActions);
  s = signal<SupplierSummary | null>(null);
  c = computed(() => this.s()?.supplier ?? null);
  tab = signal<TabKey>('summary');
  status = SUPPLIER_STATUS_LABEL; chip = SUPPLIER_STATUS_CHIP; help = SUPPLIER_STATUS_HELP;
  place = computed(() => [this.c()?.address.city, this.c()?.address.country].filter(Boolean).join(', '));
  canEdit = computed(() => this.auth.has('suppliers:update') && this.c()?.status !== 'archived');
  canDelete = computed(() => this.auth.has('suppliers:delete'));
  order = computed(() => { const c = this.c(); return c ? this.actions.newOrder(c) : null; });
  statusActions = computed(() => { const c = this.c(); return c ? this.actions.statusActions(c) : []; });
  /** Onglets visibles : un onglet financier n'apparaît que si l'utilisateur a la permission du module concerné (le serveur la revérifie). */
  tabs = computed(() => {
    const a = this.auth; const anyDoc = a.has('purchases:view') || a.has('imports:view'); const money = FINANCE_PERMISSIONS.some((p) => a.has(p));
    return ([
      { key: 'summary', label: 'Résumé', icon: 'dashboard', show: true }, { key: 'info', label: 'Informations', icon: 'info', show: true }, { key: 'contacts', label: 'Contacts', icon: 'group', show: true },
      { key: 'addresses', label: 'Adresses', icon: 'place', show: true }, { key: 'transactions', label: 'Transactions', icon: 'receipt_long', show: anyDoc }, { key: 'payments', label: 'Paiements', icon: 'payments', show: money },
      { key: 'documents', label: 'Documents', icon: 'folder', show: true }, { key: 'activities', label: 'Activités', icon: 'history', show: true },
    ] as { key: TabKey; label: string; icon: string; show: boolean }[]).filter((t) => t.show);
  });

  constructor() {
    this.route.queryParamMap.subscribe((q) => { const t = q.get('tab') as TabKey | null; this.tab.set(t && this.tabs().some((x) => x.key === t) ? t : 'summary'); });
  }
  ngOnInit() { this.refresh(true); }
  refresh(first = false) {
    this.svc.summary(this.id()).subscribe({ next: (s) => this.s.set(s), error: (e) => { this.toast.error(errorMessage(e)); if (first) this.router.navigateByUrl('/suppliers'); } });
  }
  go(t: TabKey) { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t === 'summary' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true }); }
  onSupplier(c: SupplierDto) { const cur = this.s(); if (cur) this.s.set({ ...cur, supplier: c }); this.refresh(); }
  changeStatus(a: SupplierStatusAction) {
    this.actions.changeStatus(this.c()!, a).subscribe({ next: (u) => u && this.onSupplier(u), error: (e) => this.toast.error(errorMessage(e)) });
  }
  remove() { this.actions.remove(this.c()!).subscribe({ next: (ok) => ok && this.router.navigateByUrl('/suppliers'), error: (e) => this.toast.error(errorMessage(e)) }); }
}
