import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';

export const SUPPLIER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./supplier-list').then((m) => m.SupplierList) },
  { path: 'categories', loadComponent: () => import('./categories-page').then((m) => m.SupplierCategoriesPage) },
  { path: 'new', canActivate: [permissionGuard], data: { permission: 'suppliers:create' }, loadComponent: () => import('./supplier-form').then((m) => m.SupplierFormPage) },
  { path: ':id/edit', canActivate: [permissionGuard], data: { permission: 'suppliers:update' }, loadComponent: () => import('./supplier-form').then((m) => m.SupplierFormPage) },
  { path: ':id', loadComponent: () => import('./supplier-detail').then((m) => m.SupplierDetail) },
];
