import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';

export const CUSTOMER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./customer-list').then((m) => m.CustomerList) },
  { path: 'new', canActivate: [permissionGuard], data: { permission: 'customers:create' }, loadComponent: () => import('./customer-form').then((m) => m.CustomerForm) },
  { path: ':id/edit', canActivate: [permissionGuard], data: { permission: 'customers:update' }, loadComponent: () => import('./customer-form').then((m) => m.CustomerForm) },
  { path: ':id', loadComponent: () => import('./customer-detail').then((m) => m.CustomerDetail) },
];
