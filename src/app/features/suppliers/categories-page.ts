import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from '../../shared/components/icon';
import { PageHeader } from '../../shared/components/page-header';
import { SupplierCategoryManager } from './category-manager';

@Component({
  selector: 'app-supplier-categories-page',
  imports: [RouterLink, MatButtonModule, Icon, PageHeader, SupplierCategoryManager],
  template: `
    <div class="page">
      <app-page-header title="Catégories de fournisseurs" subtitle="Classification des fournisseurs, adaptable à l’évolution de l’activité"><a mat-stroked-button routerLink="/suppliers"><app-icon name="arrow_back" />Fournisseurs</a></app-page-header>
      <section class="card"><app-supplier-category-manager /></section>
    </div>`,
})
export class SupplierCategoriesPage {}
