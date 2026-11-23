import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';
import { DOC_CONFIG, DocKind } from './sales.models';

/** Routes d'un type de document : liste, création, modification, fiche. */
export function routesFor(kind: DocKind): Routes {
  const p = DOC_CONFIG[kind].permission; const data = (perm: string) => ({ kind, permission: `${p}:${perm}` });
  return [
    { path: '', data: { kind }, loadComponent: () => import('./doc-list').then((m) => m.DocList) },
    { path: 'new', canActivate: [permissionGuard], data: data('create'), loadComponent: () => import('./doc-form').then((m) => m.DocForm) },
    { path: ':id/edit', canActivate: [permissionGuard], data: data('update'), loadComponent: () => import('./doc-form').then((m) => m.DocForm) },
    { path: ':id', data: { kind }, loadComponent: () => import('./doc-detail').then((m) => m.DocDetail) },
  ];
}
export const QUOTATION_ROUTES = routesFor('quotations'); export const PROFORMA_ROUTES = routesFor('proformas');
export const INVOICE_ROUTES = routesFor('invoices'); export const DELIVERY_ROUTES = routesFor('delivery-notes');
