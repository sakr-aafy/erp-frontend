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
/** Les devis ont leur liste et leur fiche (statuts, activité) ; le formulaire est commun aux documents de vente. */
export const QUOTATION_ROUTES: Routes = routesFor('quotations').map((r) => (r.path === '' ? { ...r, loadComponent: () => import('./quotations/quotation-list').then((m) => m.QuotationList) }
  : r.path === ':id' ? { ...r, loadComponent: () => import('./quotations/quotation-detail').then((m) => m.QuotationDetail) } : r));
export const PROFORMA_ROUTES = routesFor('proformas');
/** La facturation des bons de livraison (individuelle ou groupée) précède la route « :id ». */
export const INVOICE_ROUTES: Routes = [
  { path: 'from-deliveries', canActivate: [permissionGuard], data: { permission: 'invoices:create' }, loadComponent: () => import('./cycle/billing-page').then((m) => m.BillingPage) },
  ...routesFor('invoices'),
];
export const DELIVERY_ROUTES = routesFor('delivery-notes');
