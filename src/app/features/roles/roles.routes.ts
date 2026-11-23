import { Routes } from '@angular/router';
export const ROLE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./role-list').then((m) => m.RoleList) },
  { path: 'new', loadComponent: () => import('./role-editor').then((m) => m.RoleEditor) },
  { path: ':id', loadComponent: () => import('./role-editor').then((m) => m.RoleEditor) },
];
