import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { SupplierDto } from '../../../shared/models/api.models';
import { openActivityDialog } from '../../customers/customer-dialogs';
import { SUPPLIER_ACTIVITY_ICON, SUPPLIER_ACTIVITY_KINDS } from '../supplier.labels';
import { SupplierService } from '../supplier.service';
import { SupplierActivityDto } from '../supplier.types';

const PAGE = 15;
/** Onglet Activités : chronologie des activités manuelles et des événements automatiques (fiche et documents d'achat) — distincte du journal d'audit. */
@Component({
  selector: 'app-tab-activities',
  imports: [DatePipe, RouterLink, MatButtonModule, Icon, EmptyState, Skeleton],
  template: `
    <div class="top"><h2>Historique des activités</h2>@if (canEdit()) {<button mat-flat-button color="primary" type="button" (click)="add()"><app-icon name="add" />Ajouter une activité</button>}</div>
    @if (loading() && !items().length) {<div class="card"><app-skeleton /></div>}
    @else if (!items().length) {<div class="card"><app-empty-state icon="history" message="Aucune activité enregistrée." /></div>}
    @else {
      <ol class="tl">@for (a of items(); track a.id) {
        <li [class.auto]="a.auto"><span class="dot"><app-icon [name]="icon[a.kind] ?? 'info'" /></span>
          <div class="card body">
            <div class="h"><strong>{{ a.title }}</strong>
              <span class="tag" [class.manual]="!a.auto">{{ a.auto ? 'Automatique' : a.kindLabel }}</span></div>
            @if (a.description) {<p>{{ a.description }}</p>}
            <div class="meta muted">{{ a.occurredAt | date: 'dd/MM/yyyy HH:mm' }}@if (a.user) { · {{ a.user }}}
              @if (a.ref?.number) { · @if (link(a); as l) {<a [routerLink]="l">{{ a.ref!.number }}</a>} @else {{{ a.ref!.number }}}}</div>
            @if (a.editable && canEdit()) {<div class="acts"><button mat-icon-button type="button" (click)="edit(a)" aria-label="Modifier l’activité" title="Modifier"><app-icon name="edit" /></button>
              <button mat-icon-button type="button" class="del" (click)="remove(a)" aria-label="Supprimer l’activité" title="Supprimer"><app-icon name="delete" /></button></div>}
          </div></li>}</ol>
      @if (items().length < total()) {<div class="more"><button mat-stroked-button type="button" (click)="more()" [disabled]="loading()">Voir plus ({{ total() - items().length }})</button></div>}
    }`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.tl{list-style:none;margin:0;padding:0 0 0 8px;position:relative}
    .tl::before{content:'';position:absolute;left:26px;top:8px;bottom:8px;width:2px;background:var(--border)}.tl li{display:flex;gap:14px;margin-bottom:12px;position:relative}
    .dot{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--accent);color:var(--brand-900);flex:none;z-index:1;box-shadow:0 0 0 4px var(--bg)}.auto .dot{background:var(--brand-50);color:var(--brand)}
    .body{flex:1;min-width:0;padding:12px 16px;position:relative}.h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tag{font-size:11px;padding:1px 8px;border-radius:999px;background:#f2f4f7;color:var(--muted)}.tag.manual{background:var(--accent-100);color:var(--brand-900)}
    p{margin:6px 0 0;white-space:pre-wrap}.meta{font-size:12px;margin-top:6px}.acts{position:absolute;top:4px;right:4px;display:flex}.acts button{color:var(--muted)}.acts .del:hover{color:var(--danger)}.more{display:flex;justify-content:center;margin-top:8px}`,
})
export class TabActivities {
  c = input.required<SupplierDto>();
  private svc = inject(SupplierService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService);
  items = signal<SupplierActivityDto[]>([]); total = signal(0); loading = signal(true); icon = SUPPLIER_ACTIVITY_ICON; private page = 1;
  canEdit = computed(() => this.auth.has('suppliers:update') && this.c().status !== 'archived');
  ngOnInit() { this.load(true); }
  load(reset: boolean) {
    if (reset) this.page = 1; this.loading.set(true);
    this.svc.activities(this.c().id, this.page, PAGE).subscribe({
      next: (r) => { this.items.set(reset ? r.items : [...this.items(), ...r.items]); this.total.set(r.total); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  more() { this.page++; this.load(false); }
  private paths: Record<string, string> = { purchase_order: '/purchase-orders', goods_receipt: '/goods-receipts', purchase_invoice: '/purchase-invoices', import_file: '/imports' };
  link(a: SupplierActivityDto): unknown[] | null { const base = this.paths[a.ref!.type]; return base ? [base, a.ref!.id] : null; }
  add() { openActivityDialog(this.dialog, { kinds: SUPPLIER_ACTIVITY_KINDS, submit: (v) => this.svc.addActivity(this.c().id, v) }).subscribe((r) => { if (r) { this.toast.success('Activité ajoutée'); this.load(true); } }); }
  edit(a: SupplierActivityDto) { openActivityDialog(this.dialog, { activity: a, kinds: SUPPLIER_ACTIVITY_KINDS, submit: (v) => this.svc.updateActivity(this.c().id, a.id, v) }).subscribe((r) => { if (r) { this.toast.success('Activité modifiée'); this.load(true); } }); }
  remove(a: SupplierActivityDto) {
    confirm(this.dialog, { title: 'Supprimer l’activité', message: `Supprimer « ${a.title} » ?`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.svc.removeActivity(this.c().id, a.id).subscribe({ next: () => { this.toast.success('Activité supprimée'); this.load(true); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
