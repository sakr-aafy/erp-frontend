import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../../shared/components/icon';
import { Skeleton } from '../../shared/components/skeleton';
import { ProductDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ProductActions, ProductPhotos, StatusAction } from './product-actions.service';
import { ProductThumb } from './product-thumb';
import { STATUS_CHIP, STATUS_HELP } from './product.labels';
import { ProductService } from './product.service';
import { TabActivities } from './tabs/tab-activities';
import { TabCustoms } from './tabs/tab-customs';
import { TabDocuments } from './tabs/tab-documents';
import { TabGeneral } from './tabs/tab-general';
import { TabPackaging } from './tabs/tab-packaging';
import { TabPrices } from './tabs/tab-prices';
import { TabStock } from './tabs/tab-stock';
import { TabTransactions } from './tabs/tab-transactions';

type TabKey = 'general' | 'packaging' | 'prices' | 'stock' | 'customs' | 'transactions' | 'documents' | 'activities';

/** Fiche article : en-tête (photo principale), indicateurs réels et huit onglets (Général, Dimensions et Poids, Prix, Stock, Douane, Transactions, Documents, Activités). L'onglet actif est dans l'URL (?tab=). */
@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, MatButtonModule, MatMenuModule, Icon, Skeleton, MoneyPipe, ProductThumb, TabGeneral, TabPackaging, TabPrices, TabStock, TabCustoms, TabTransactions, TabDocuments, TabActivities],
  template: `
    <div class="page">
      <a class="back" routerLink="/products"><app-icon name="arrow_back" />Retour aux articles</a>
      @if (!p()) {<div class="card"><app-skeleton /></div>} @else {
        <section class="card head">
          <app-product-thumb [productId]="p()!.id" [photoId]="p()!.mainPhotoId" [kind]="p()!.kind" [alt]="p()!.name" [size]="72" />
          <div class="id">
            <div class="nm"><h1>{{ p()!.name }}</h1><span class="chip {{ chip[p()!.status] }}">{{ p()!.statusLabel }}</span></div>
            <div class="sub"><span class="code">{{ p()!.reference }}</span>@if (p()!.familyName) {<span>·</span><span>{{ p()!.familyName }}@if (p()!.subName) { › {{ p()!.subName }}}</span>}
              <span>·</span><span>{{ p()!.kind === 'service' ? 'Service' : 'Produit' }}</span></div>
          </div>
          <div class="acts">
            @if (canEdit()) {<a mat-stroked-button [routerLink]="['edit']"><app-icon name="edit" />Modifier</a>}
            <button mat-icon-button type="button" [matMenuTriggerFor]="menu" aria-label="Actions sur l’article"><app-icon name="more_vert" /></button>
            <mat-menu #menu="matMenu" xPosition="before">
              @if (auth.has('products:create')) {<button mat-menu-item type="button" (click)="actions.duplicate(p()!)"><app-icon name="content_copy" />Dupliquer</button>}
              <button mat-menu-item type="button" (click)="actions.print(p()!)"><app-icon name="print" />Imprimer la fiche</button>
              @for (a of statusActions(); track a.target) {<button mat-menu-item type="button" [class.danger]="a.danger" (click)="changeStatus(a)"><app-icon [name]="a.icon" />{{ a.label }}</button>}
              @if (auth.has('products:delete')) {<button mat-menu-item type="button" class="danger" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
            </mat-menu>
          </div>
        </section>
        @if (p()!.status !== 'active') {<p class="banner {{ p()!.status }}" role="status"><app-icon [name]="p()!.status === 'blocked' ? 'block' : 'info'" /><span><strong>{{ p()!.statusLabel }}</strong>@if (p()!.statusReason) { — {{ p()!.statusReason }}}. {{ help[p()!.status] }}</span></p>}
        <div class="kpis">
          @if (p()!.access.purchase) {<div class="kpi">
            @if (p()!.estimateRate !== null) {<span class="muted">Prix d’achat estimé</span><strong>{{ p()!.estimatedPurchaseMinor | money }}</strong><span class="sm muted">{{ foreignText() }} au taux estimatif</span>}
            @else {<span class="muted">Prix d’achat HT</span><strong>{{ p()!.purchasePriceMinor | money }}</strong>@if (p()!.purchaseCurrency) {<span class="sm muted">{{ foreignText() }} au taux réel enregistré</span>}}</div>}
          <div class="kpi"><span class="muted">Prix de vente HT</span><strong>{{ p()!.salePriceMinor | money }}</strong>@if (p()!.saleTtcMinor !== null) {<span class="sm muted">{{ p()!.saleTtcMinor | money }} TTC</span>}</div>
          @if (p()!.access.cost) {<div class="kpi"><span class="muted">Coût de revient actuel</span><strong>{{ p()!.effectiveCostMinor | money }}</strong><span class="sm muted">{{ p()!.costPriceMinor === null ? (p()!.estimatedCostMinor !== null ? 'estimé (saisi)' : p()!.estimateRate !== null ? 'estimé au taux interne' : 'basé sur le prix d’achat') : 'calculé (CMP)' }}</span></div>
            <div class="kpi"><span class="muted">Marge HT</span><strong [class.neg]="(p()!.marginMinor ?? 0) < 0">{{ p()!.marginMinor | money }}</strong><span class="sm muted">{{ p()!.marginRatePct === null ? '' : p()!.marginRatePct + ' % du coût' }}</span></div>}
          @if (p()!.access.stock && p()!.kind === 'product') {<div class="kpi"><span class="muted">Stock disponible</span><strong [class.neg]="(p()!.stockQty ?? 0) <= 0">{{ p()!.stockQty }}</strong>@if (p()!.minStock) {<span class="sm muted">minimum {{ p()!.minStock }}</span>}</div>}
        </div>
        <nav class="tabs" role="tablist" aria-label="Sections de la fiche article">
          @for (t of tabs(); track t.key) {<button type="button" role="tab" class="tab" [class.on]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="go(t.key)"><app-icon [name]="t.icon" />{{ t.label }}</button>}
        </nav>
        <div class="panel" role="tabpanel">
          @switch (tab()) {
            @case ('general') {<app-tab-general [p]="p()!" (saved)="onProduct($event)" />}
            @case ('packaging') {<app-tab-packaging [p]="p()!" (saved)="onProduct($event)" />}
            @case ('prices') {<app-tab-prices [p]="p()!" (saved)="onProduct($event)" />}
            @case ('stock') {<app-tab-stock [p]="p()!" (changed)="reload()" />}
            @case ('customs') {<app-tab-customs [p]="p()!" (saved)="onProduct($event)" />}
            @case ('transactions') {<app-tab-transactions [p]="p()!" />}
            @case ('documents') {<app-tab-documents [p]="p()!" (changed)="reload()" />}
            @case ('activities') {<app-tab-activities [p]="p()!" />}
          }
        </div>
      }
    </div>`,
  styles: `.back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;margin-bottom:12px;font-size:14px}.back:hover{color:var(--brand)}
    .head{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:3px solid var(--accent)}.id{flex:1;min-width:220px}.nm{display:flex;align-items:center;gap:12px;flex-wrap:wrap}h1{margin:0;font-size:22px;line-height:30px;font-weight:600;letter-spacing:-.01em;overflow-wrap:anywhere}
    .sub{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:14px;margin-top:4px}.code{font-weight:600;color:var(--brand)}.acts{display:flex;gap:8px;align-items:center}.danger{color:var(--danger)}
    .banner{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;padding:10px 14px;border-radius:var(--r-md);border:1px solid var(--accent-300);background:var(--accent-50)}.banner.blocked{border-color:var(--danger-200);background:var(--danger-50)}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:16px 0}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;display:flex;flex-direction:column;gap:4px;box-shadow:var(--shadow-sm)}.kpi strong{font-size:20px;font-variant-numeric:tabular-nums}.sm{font-size:12px}.neg{color:var(--danger)}
    .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0}.tab{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--border-strong);border-radius:999px;background:var(--surface);color:var(--text-2);font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:all var(--t-fast) var(--ease)}
    .tab:hover{border-color:var(--brand);color:var(--brand)}.tab:focus-visible{outline:none;box-shadow:var(--ring)}.tab.on{background:var(--brand);border-color:var(--brand);color:#fff}.tab app-icon{--icon-size:1rem}
    @media (max-width:600px){.kpis{grid-template-columns:1fr 1fr;gap:8px}.kpi{padding:10px 12px}.kpi strong{font-size:16px}.tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px;margin-right:-16px;padding-right:16px;scrollbar-width:thin}.tab{flex:none}h1{font-size:19px}.acts{width:100%;justify-content:flex-end}}`,
})
export class ProductDetail {
  id = input.required<string>();
  auth = inject(AuthService); actions = inject(ProductActions); private svc = inject(ProductService); private toast = inject(ToastService); private router = inject(Router); private route = inject(ActivatedRoute); private photos = inject(ProductPhotos);
  p = signal<ProductDto | null>(null); private wanted = signal<string | null>(null); chip = STATUS_CHIP; help = STATUS_HELP;
  canEdit = computed(() => this.auth.has('products:update') && this.p()?.status !== 'archived');
  private ref = inject(ReferenceDataService);
  foreignText = () => { const p = this.p(); const c = p?.purchaseCurrency; if (!p || !c) return ''; const d = this.ref.decimalsOf(c); return `${((p.purchasePriceForeignMinor ?? 0) / 10 ** d).toLocaleString('fr-FR', { minimumFractionDigits: d })} ${c}`; };
  statusActions = computed(() => { const p = this.p(); return p ? this.actions.statusActions(p) : []; });
  /** Huit onglets ; Stock et Douane n'apparaissent que pour les utilisateurs autorisés (le serveur revérifie chaque accès). */
  tabs = computed(() => {
    const a = this.auth; const p = this.p();
    const tx = ['purchases:view', 'quotations:view', 'proformas:view', 'invoices:view', 'deliveryNotes:view', 'inventory:view', 'imports:view', 'costCalculation:view'].some((x) => a.has(x));
    return ([
      { key: 'general', label: 'Général', icon: 'info', show: true }, { key: 'packaging', label: 'Dimensions et Poids', icon: 'inventory_2', show: true }, { key: 'prices', label: 'Prix', icon: 'payments', show: true },
      { key: 'stock', label: 'Stock', icon: 'warehouse', show: a.has('inventory:view') }, { key: 'customs', label: 'Douane', icon: 'account_balance', show: !!p?.access.customs },
      { key: 'transactions', label: 'Transactions', icon: 'sync_alt', show: tx }, { key: 'documents', label: 'Documents', icon: 'folder', show: true }, { key: 'activities', label: 'Activités', icon: 'history', show: true },
    ] as { key: TabKey; label: string; icon: string; show: boolean }[]).filter((t) => t.show);
  });
  /** Onglet demandé par l'URL, valable seulement si l'utilisateur y a droit (évalué après le chargement de l'article). */
  tab = computed<TabKey>(() => { const t = this.wanted(); return (this.tabs().find((x) => x.key === t)?.key as TabKey | undefined) ?? 'general'; });
  constructor() { this.route.queryParamMap.subscribe((q) => this.wanted.set(q.get('tab'))); }
  ngOnInit() { this.load(true); }
  load(first = false) { this.svc.get(this.id()).subscribe({ next: (p) => this.p.set(p), error: (e) => { this.toast.error(errorMessage(e)); if (first) this.router.navigateByUrl('/products'); } }); }
  reload() { this.photos.forget(this.id()); this.load(); }
  go(t: TabKey) { this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t === 'general' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true }); }
  onProduct(p: ProductDto) { this.p.set(p); this.load(); }
  changeStatus(a: StatusAction) { this.actions.changeStatus(this.p()!, a).subscribe({ next: (u) => u && this.onProduct(u), error: (e) => this.toast.error(errorMessage(e)) }); }
  remove() { this.actions.remove(this.p()!).subscribe({ next: (ok) => ok && this.router.navigateByUrl('/products'), error: (e) => this.toast.error(errorMessage(e)) }); }
}
