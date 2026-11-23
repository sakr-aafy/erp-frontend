import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/auth.guards';
import { Shell } from './core/layout/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
  { path: 'forgot-password', canActivate: [guestGuard], loadComponent: () => import('./features/auth/forgot-password').then((m) => m.ForgotPassword) },
  { path: 'reset-password', canActivate: [guestGuard], loadComponent: () => import('./features/auth/reset-password').then((m) => m.ResetPassword) },
  {
    path: '', component: Shell, canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'change-password', loadComponent: () => import('./features/auth/change-password').then((m) => m.ChangePassword) },
      { path: 'customers', canActivate: [permissionGuard], data: { permission: 'customers:view' }, loadChildren: () => import('./features/customers/customers.routes').then((m) => m.CUSTOMER_ROUTES) },
      { path: 'products', canActivate: [permissionGuard], data: { permission: 'products:view' }, loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCT_ROUTES) },
      { path: 'suppliers', canActivate: [permissionGuard], data: { permission: 'suppliers:view' }, loadChildren: () => import('./features/suppliers/suppliers.routes').then((m) => m.SUPPLIER_ROUTES) },
      { path: 'quotations', canActivate: [permissionGuard], data: { permission: 'quotations:view' }, loadChildren: () => import('./features/sales/sales.routes').then((m) => m.QUOTATION_ROUTES) },
      { path: 'proformas', canActivate: [permissionGuard], data: { permission: 'proformas:view' }, loadChildren: () => import('./features/sales/sales.routes').then((m) => m.PROFORMA_ROUTES) },
      { path: 'invoices', canActivate: [permissionGuard], data: { permission: 'invoices:view' }, loadChildren: () => import('./features/sales/sales.routes').then((m) => m.INVOICE_ROUTES) },
      { path: 'delivery-notes', canActivate: [permissionGuard], data: { permission: 'deliveryNotes:view' }, loadChildren: () => import('./features/sales/sales.routes').then((m) => m.DELIVERY_ROUTES) },
      { path: 'purchase-orders', canActivate: [permissionGuard], data: { permission: 'purchases:view' }, loadChildren: () => import('./features/logistics/logistics.routes').then((m) => m.ORDER_ROUTES) },
      { path: 'goods-receipts', canActivate: [permissionGuard], data: { permission: 'purchases:view' }, loadChildren: () => import('./features/logistics/logistics.routes').then((m) => m.RECEIPT_ROUTES) },
      { path: 'purchase-invoices', canActivate: [permissionGuard], data: { permission: 'purchases:view' }, loadChildren: () => import('./features/logistics/logistics.routes').then((m) => m.PINV_ROUTES) },
      { path: 'stock', canActivate: [permissionGuard], data: { permission: 'inventory:view' }, loadChildren: () => import('./features/logistics/logistics.routes').then((m) => m.STOCK_ROUTES) },
      { path: 'stock-transfers', canActivate: [permissionGuard], data: { permission: 'inventory:view' }, loadChildren: () => import('./features/logistics/logistics.routes').then((m) => m.TRANSFER_ROUTES) },
      { path: 'inventories', canActivate: [permissionGuard], data: { permission: 'inventory:view' }, loadChildren: () => import('./features/logistics/logistics.routes').then((m) => m.INVENTORY_ROUTES) },
      { path: 'imports', canActivate: [permissionGuard], data: { permission: 'imports:view' }, loadChildren: () => import('./features/logistics/logistics.routes').then((m) => m.IMPORT_ROUTES) },
      { path: 'expenses', canActivate: [permissionGuard], data: { permission: 'expenses:view' }, loadChildren: () => import('./features/finance/finance.routes').then((m) => m.EXPENSE_ROUTES) },
      { path: 'treasury', canActivate: [permissionGuard], data: { permission: 'treasury:view' }, loadChildren: () => import('./features/finance/finance.routes').then((m) => m.TREASURY_ROUTES) },
      { path: 'accounting', canActivate: [permissionGuard], data: { permission: 'accounting:view' }, loadChildren: () => import('./features/finance/finance.routes').then((m) => m.ACCOUNTING_ROUTES) },
      { path: 'reports', canActivate: [permissionGuard], data: { permission: 'reports:view' }, loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORT_ROUTES) },
      { path: 'costs', canActivate: [permissionGuard], data: { permission: 'costCalculation:view' }, loadComponent: () => import('./features/logistics/costs').then((m) => m.Costs) },
      { path: 'users', canActivate: [permissionGuard], data: { permission: 'users:view' }, loadChildren: () => import('./features/users/users.routes').then((m) => m.USER_ROUTES) },
      { path: 'roles', canActivate: [permissionGuard], data: { permission: 'roles:view' }, loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLE_ROUTES) },
      { path: 'settings', canActivate: [permissionGuard], data: { permission: 'settings:view' }, loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage) },
      { path: 'fiscal', canActivate: [permissionGuard], data: { permission: 'settings:view' }, loadComponent: () => import('./features/fiscal/fiscal-page').then((m) => m.FiscalPage) },
      { path: 'audit', canActivate: [permissionGuard], data: { permission: 'audit:view' }, loadComponent: () => import('./features/audit/audit').then((m) => m.AuditPage) },
      { path: 'companies', canActivate: [permissionGuard], data: { platformAdmin: true, permission: '__platform__' }, loadComponent: () => import('./features/companies/companies').then((m) => m.CompaniesPage) },
      { path: 'forbidden', loadComponent: () => import('./features/dashboard/forbidden').then((m) => m.Forbidden) },
    ],
  },
  { path: '**', redirectTo: '' },
];
