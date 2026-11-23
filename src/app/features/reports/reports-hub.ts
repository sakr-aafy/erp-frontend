import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { Icon } from '../../shared/components/icon';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { ReportsStore } from './reports.store';

const GROUP_ICON: Record<string, string> = { commercial: 'receipt', financial: 'account_balance', stock: 'inventory', purchases: 'shopping_cart', imports: 'flight_land' };

/** Hub des rapports : catalogue filtré par les permissions de l'utilisateur (côté serveur), recherche locale. */
@Component({
  selector: 'app-reports-hub',
  imports: [FormsModule, RouterLink, MatFormFieldModule, MatInputModule, PageHeader, Icon, EmptyState, Skeleton],
  template: `<div class="page"><app-page-header title="Rapports" subtitle="Rapports calculés en temps réel à partir de vos données, filtrables et exportables (Excel, CSV, PDF). Seuls les rapports de vos modules autorisés sont listés." />
    @if (!store.catalog()) {<div class="card"><app-skeleton [count]="6" /></div>}
    @else if (!groups().length) {<div class="card"><app-empty-state icon="shield" [message]="q() ? 'Aucun rapport ne correspond à la recherche.' : 'Aucun rapport accessible avec vos permissions.'" /></div>}
    @else {
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:360px;margin-bottom:16px"><mat-label>Rechercher un rapport</mat-label><app-icon matPrefix name="search" /><input matInput [ngModel]="q()" (ngModelChange)="q.set($event)" /></mat-form-field>
      @for (g of groups(); track g.group) {
        <section class="grp"><h2><span class="gi"><app-icon [name]="icon(g.group)" /></span>{{ g.label }}<span class="count">{{ g.reports.length }}</span></h2>
          <div class="grid">@for (r of g.reports; track r.key) {<a class="card link rep" [routerLink]="[r.key]"><strong>{{ r.title }}</strong><p class="muted">{{ r.description }}</p><span class="go">Ouvrir <app-icon name="arrow_forward" /></span></a>}</div></section>
      }
    }</div>`,
  styles: `.grp{margin-bottom:28px}h2{display:flex;align-items:center;gap:10px;font-size:17px;margin:0 0 12px}.gi{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--brand-50);color:var(--brand)}
    .count{font-size:12px;font-weight:500;color:var(--muted);background:#f2f4f7;border-radius:999px;padding:1px 9px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:12px}
    .rep{display:flex;flex-direction:column;text-decoration:none;color:inherit;padding:16px 18px}.rep p{margin:6px 0 12px;font-size:13px;flex:1}.go{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:500;color:var(--brand)}`,
})
export class ReportsHub {
  store = inject(ReportsStore); private toast = inject(ToastService); q = signal('');
  groups = computed(() => { const t = this.q().trim().toLowerCase(); return (this.store.catalog() ?? []).map((g) => ({ ...g, reports: g.reports.filter((r) => !t || `${r.title} ${r.description}`.toLowerCase().includes(t)) })).filter((g) => g.reports.length); });
  icon = (g: string) => GROUP_ICON[g] ?? 'description';
  ngOnInit() { this.store.load().subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
}
