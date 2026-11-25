import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../shared/guards/unsaved.guard';

export const PRODUCT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./product-list').then((m) => m.ProductList) },
  { path: 'new', canActivate: [permissionGuard], canDeactivate: [unsavedChangesGuard], data: { permission: 'products:create' }, loadComponent: () => import('./product-form').then((m) => m.ProductForm) },
  { path: 'catalog', loadComponent: () => import('./catalog').then((m) => m.CatalogPage) },
  { path: 'import', canActivate: [permissionGuard], data: { permission: 'products:create' }, loadComponent: () => import('./product-import').then((m) => m.ProductImport) },
  { path: ':id/edit', canActivate: [permissionGuard], canDeactivate: [unsavedChangesGuard], data: { permission: 'products:update' }, loadComponent: () => import('./product-form').then((m) => m.ProductForm) },
  { path: ':id', loadComponent: () => import('./product-detail').then((m) => m.ProductDetail) },
];
