import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from '../../shared/components/icon';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { UnitDto } from '../../shared/models/api.models';
import { CategoryTree } from './category-tree';
import { ProductService } from './product.service';

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, MatButtonModule, Icon, PageHeader, CategoryTree],
  template: `
    <div class="page">
      <app-page-header title="Catégories & unités" subtitle="Catégories, sous-catégories et unités de mesure du catalogue"><a mat-stroked-button routerLink="/products"><app-icon name="arrow_back" />Articles</a></app-page-header>
      <div class="cols">
        <section class="card"><h3>Catégories et sous-catégories</h3><app-category-tree /></section>
        <div class="card"><h3>Unités de mesure</h3>
          <p class="muted small">Trois unités fixes ; la précision des quantités en dépend.</p>
          @for (u of fixed(); track u.id) {<div class="item"><span><strong>{{ u.name }}</strong>&ngsp;<span class="muted">{{ u.code }}</span></span><span class="spacer"></span><span class="muted">{{ u.decimals === 0 ? 'entier' : u.decimals + ' décimale' }}</span></div>}
          @if (historical().length) {
            <h4>Unités historiques</h4><p class="muted small">Conservées sur les articles qui les utilisent ; non proposées pour les autres.</p>
            @for (u of historical(); track u.id) {<div class="item"><span>{{ u.name }} <span class="muted">{{ u.code }}</span></span><span class="spacer"></span>
              @if (canDelete) {<button mat-icon-button type="button" (click)="removeUnit(u)" aria-label="Supprimer {{ u.name }}"><app-icon name="delete" /></button>}</div>}}
        </div>
      </div>
    </div>`,
  styles: `.cols{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start}@media (max-width:1100px){.cols{grid-template-columns:minmax(0,1fr)}}h3{margin:0 0 6px;font-size:16px}h4{margin:16px 0 4px;font-size:14px}.small{font-size:12px;margin:0 0 8px}.add{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
    .item{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 0;border-bottom:1px solid var(--erp-border)}.spacer{flex:1}`,
})
export class CatalogPage {
  private svc = inject(ProductService); private toast = inject(ToastService); private dialog = inject(MatDialog); private auth = inject(AuthService);
  canDelete = this.auth.has('products:delete');
  units = signal<UnitDto[]>([]);
  fixed = () => this.units().filter((u) => u.fixed); historical = () => this.units().filter((u) => !u.fixed);
  constructor() { this.load(); }
  load() { this.svc.units().subscribe((u) => this.units.set(u)); }
  private done = (msg: string) => ({ next: () => { this.toast.success(msg); this.load(); }, error: (e: unknown) => this.toast.error(errorMessage(e)) });
  removeUnit(u: UnitDto) { confirm(this.dialog, { title: 'Supprimer l’unité', message: `Supprimer « ${u.name} » ?`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.svc.deleteUnit(u.id).subscribe(this.done('Unité supprimée'))); }
}
