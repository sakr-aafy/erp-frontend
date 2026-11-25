import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { ProductDto } from '../../../shared/models/api.models';
import { openActivityDialog } from '../product-dialogs';
import { ACTIVITY_ICON, ACTIVITY_KINDS } from '../product.labels';
import { ProductService } from '../product.service';
import { ActivityDto } from '../product.types';

const PAGE = 15;
/** Onglet 8 — Activités : activités manuelles (appel, réunion, tâche, rappel, note) et événements automatiques issus des opérations réelles — distinct du journal d'audit. */
@Component({
  selector: 'app-tab-activities',
  imports: [DatePipe, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon, EmptyState, Skeleton],
  template: `
    <div class="top"><div><h2>Activités de l’article</h2><p class="muted">Suivi des actions et de l’historique</p></div>@if (canEdit()) {<button mat-flat-button color="primary" type="button" (click)="add()"><app-icon name="add" />Ajouter une activité</button>}</div>
    <div class="filters">
      <button type="button" class="pill" [class.on]="!kind() && !open()" (click)="setKind('')">Toutes</button>
      @for (k of kinds; track k.value) {<button type="button" class="pill" [class.on]="kind() === k.value" (click)="setKind(k.value)"><app-icon [name]="k.icon" />{{ k.label }}</button>}
      <button type="button" class="pill" [class.on]="open()" (click)="toggleOpen()"><app-icon name="schedule" />Tâches ouvertes</button>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="d"><mat-label>Du</mat-label><input matInput type="date" [value]="from()" (change)="from.set($any($event.target).value); reload()" /></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="d"><mat-label>Au</mat-label><input matInput type="date" [value]="to()" (change)="to.set($any($event.target).value); reload()" /></mat-form-field>
    </div>
    @if (loading() && !items().length) {<div class="card"><app-skeleton /></div>}
    @else if (!items().length) {<div class="card"><app-empty-state icon="history" message="Aucune activité pour ces critères." /></div>}
    @else {
      <ol class="tl">@for (a of items(); track a.id) {
        <li [class.auto]="a.auto" [class.done]="a.done"><span class="dot"><app-icon [name]="icon[a.kind] ?? 'info'" /></span>
          <div class="card body">
            <div class="h"><strong>{{ a.title }}</strong><span class="tag" [class.manual]="!a.auto">{{ a.auto ? 'Automatique' : a.kindLabel }}</span>
              @if (a.dueDate) {<span class="chip" [class.danger]="a.overdue" [class.ok]="a.done" [class.warn]="!a.done && !a.overdue">{{ a.done ? 'Terminée' : 'Échéance ' + (a.dueDate | date: 'dd/MM/yyyy' : 'UTC') }}{{ a.overdue ? ' — en retard' : '' }}</span>}</div>
            @if (a.description) {<p>{{ a.description }}</p>}
            @if (detail(a); as d) {<p class="muted detail">{{ d }}</p>}
            <div class="meta muted">{{ a.occurredAt | date: 'dd/MM/yyyy HH:mm' }}@if (a.user) { · {{ a.user }}}@if (a.link) { · <a [routerLink]="[a.link]">Voir le module</a>}</div>
            @if (a.editable && canEdit()) {<div class="acts">@if (a.done !== null) {<button mat-button type="button" (click)="toggleDone(a)">{{ a.done ? 'Rouvrir' : 'Marquer terminée' }}</button>}
              <button mat-icon-button type="button" (click)="edit(a)" aria-label="Modifier l’activité" title="Modifier"><app-icon name="edit" /></button>
              <button mat-icon-button type="button" class="del" (click)="remove(a)" aria-label="Supprimer l’activité" title="Supprimer"><app-icon name="delete" /></button></div>}
          </div></li>}</ol>
      @if (items().length < total()) {<div class="more"><button mat-stroked-button type="button" (click)="more()" [disabled]="loading()">Voir plus</button></div>}
    }`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}
    .filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center}.pill{display:inline-flex;gap:6px;align-items:center;padding:5px 12px;border:1px solid var(--border-strong);border-radius:999px;background:var(--surface);font:inherit;font-size:13px;color:var(--text-2);cursor:pointer}
    .pill:hover{border-color:var(--brand);color:var(--brand)}.pill:focus-visible{outline:none;box-shadow:var(--ring)}.pill.on{background:var(--brand);border-color:var(--brand);color:#fff}.pill app-icon{--icon-size:.95rem}.d{width:150px}
    .tl{list-style:none;margin:0;padding:0 0 0 8px;position:relative}.tl::before{content:'';position:absolute;left:26px;top:8px;bottom:8px;width:2px;background:var(--border)}.tl li{display:flex;gap:14px;margin-bottom:12px;position:relative}
    .dot{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--accent);color:var(--brand-900);flex:none;z-index:1;box-shadow:0 0 0 4px var(--bg)}.auto .dot{background:var(--brand-50);color:var(--brand)}.done .dot{background:var(--brand);color:#fff}
    .body{flex:1;min-width:0;padding:12px 16px;position:relative}.h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tag{font-size:11px;padding:1px 8px;border-radius:999px;background:#f2f4f7;color:var(--muted)}.tag.manual{background:var(--accent-100);color:var(--brand-900)}
    p{margin:6px 0 0;white-space:pre-wrap}.detail{font-size:13px}.meta{font-size:12px;margin-top:6px}.acts{display:flex;align-items:center;gap:2px;margin-top:6px}.acts button{color:var(--muted)}.del:hover{color:var(--danger)}.more{display:flex;justify-content:center;margin-top:8px}`,
})
export class TabActivities {
  p = input.required<ProductDto>();
  private svc = inject(ProductService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService); private ref = inject(ReferenceDataService);
  items = signal<ActivityDto[]>([]); total = signal(0); loading = signal(true); icon = ACTIVITY_ICON; kinds = ACTIVITY_KINDS; private page = 1;
  kind = signal(''); open = signal(false); from = signal(''); to = signal('');
  canEdit = computed(() => this.auth.has('products:update') && this.p().status !== 'archived');
  ngOnInit() { this.load(true); }
  setKind(k: string) { this.kind.set(k); this.open.set(false); this.reload(); }
  toggleOpen() { this.open.set(!this.open()); this.kind.set(''); this.reload(); }
  reload() { this.load(true); }
  load(reset: boolean) {
    if (reset) this.page = 1; this.loading.set(true);
    this.svc.activities(this.p().id, { page: this.page, limit: PAGE, kind: this.kind(), from: this.from() ? new Date(`${this.from()}T00:00:00`).toISOString() : '', to: this.to() ? new Date(`${this.to()}T23:59:59`).toISOString() : '', open: this.open() }).subscribe({
      next: (r) => { this.items.set(reset ? r.items : [...this.items(), ...r.items]); this.total.set(r.total); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  more() { this.page++; this.load(false); }
  /** Détail lisible des événements de prix (montants formatés selon la devise de base). */
  detail(a: ActivityDto): string {
    const m = a.meta; if (!m) return ''; const f = (v: unknown) => (v == null ? '—' : this.ref.format(Number(v)));
    if (a.kind === 'sale_price_changed') return [m['saleFrom'] !== m['saleTo'] ? `Prix de vente : ${f(m['saleFrom'])} → ${f(m['saleTo'])}` : '', m['minFrom'] !== m['minTo'] ? `Minimum : ${f(m['minFrom'])} → ${f(m['minTo'])}` : ''].filter(Boolean).join(' · ');
    if (a.kind === 'cost_changed') return m['costTo'] == null ? '' : `Coût de revient : ${f(m['costFrom'])} → ${f(m['costTo'])}`;
    if (a.kind === 'purchase_price_changed') return [m['purchaseFrom'] !== m['purchaseTo'] ? `Prix d’achat : ${f(m['purchaseFrom'])} → ${f(m['purchaseTo'])}` : '', m['estimatedFrom'] !== m['estimatedTo'] ? `Coût estimé : ${f(m['estimatedFrom'])} → ${f(m['estimatedTo'])}` : ''].filter(Boolean).join(' · ');
    return '';
  }
  add() { openActivityDialog(this.dialog, { submit: (v) => this.svc.addActivity(this.p().id, v) }).subscribe((r) => { if (r) { this.toast.success('Activité ajoutée'); this.load(true); } }); }
  edit(a: ActivityDto) { openActivityDialog(this.dialog, { activity: a, submit: (v) => this.svc.updateActivity(this.p().id, a.id, v) }).subscribe((r) => { if (r) { this.toast.success('Activité modifiée'); this.load(true); } }); }
  toggleDone(a: ActivityDto) { this.svc.updateActivity(this.p().id, a.id, { done: !a.done }).subscribe({ next: () => { this.toast.success(a.done ? 'Tâche rouverte' : 'Tâche terminée'); this.load(true); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  remove(a: ActivityDto) {
    confirm(this.dialog, { title: 'Supprimer l’activité', message: `Supprimer « ${a.title} » ?`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.svc.removeActivity(this.p().id, a.id).subscribe({ next: () => { this.toast.success('Activité supprimée'); this.load(true); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
