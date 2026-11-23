import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';
import { EXPENSE_STATUS } from './expenses';
import { ListConfig } from '../logistics/generic-list';

const guard = (permission: string) => ({ canActivate: [permissionGuard], data: { permission } });
export const EXPENSE_LIST: ListConfig = { title: 'Dépenses', subtitle: 'Saisie, validation et suivi des dépenses : une dépense validée sort de la trésorerie et n’est plus modifiable', endpoint: '/expenses', permission: 'expenses:view', createPermission: 'expenses:create', createLabel: 'Nouvelle dépense', createRoute: '/expenses/new',
  rowRoute: (r) => ['/expenses', r.id], exportPath: '/expenses/export', statuses: Object.entries(EXPENSE_STATUS).map(([value, label]) => ({ value, label })), emptyIcon: 'payments', headerLinks: [{ label: 'Catégories et synthèse', icon: 'category', route: '/expenses/categories' }],
  columns: [{ label: 'N°', value: (r) => r.number, sort: 'number' }, { label: 'Date', value: (r) => r.date, type: 'date', sort: 'date' }, { label: 'Catégorie', value: (r) => r.categoryName }, { label: 'Bénéficiaire', value: (r) => r.beneficiary }, { label: 'Montant', value: (r) => r.amountMinor, type: 'money', sort: 'amountMinor' },
    { label: 'Statut', value: (r) => EXPENSE_STATUS[r.status] ?? r.status, type: 'chip', chip: (r) => (r.status === 'validated' ? 'ok' : r.status === 'cancelled' || r.status === 'rejected' ? 'off' : '') }] };

export const EXPENSE_ROUTES: Routes = [
  { path: '', data: { cfg: EXPENSE_LIST }, loadComponent: () => import('../logistics/generic-list').then((m) => m.GenericList) },
  { path: 'new', ...guard('expenses:create'), loadComponent: () => import('./expenses').then((m) => m.ExpenseForm) },
  { path: 'categories', loadComponent: () => import('./expenses').then((m) => m.ExpenseCategories) },
  { path: ':id/edit', ...guard('expenses:update'), loadComponent: () => import('./expenses').then((m) => m.ExpenseForm) },
  { path: ':id', loadComponent: () => import('./expenses').then((m) => m.ExpenseDetail) }];
export const TREASURY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./treasury').then((m) => m.TreasuryHome) },
  { path: 'movements', loadComponent: () => import('./treasury').then((m) => m.TreasuryMovements) },
  { path: 'reconciliation', ...guard('treasury:validate'), loadComponent: () => import('./treasury').then((m) => m.Reconciliation) },
  { path: 'supplier-payments', loadComponent: () => import('./treasury').then((m) => m.SupplierPayments) }];
export const ACCOUNTING_ROUTES: Routes = [{ path: '', loadComponent: () => import('./accounting').then((m) => m.Accounting) }];
