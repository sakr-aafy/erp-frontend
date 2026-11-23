import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';
import { ListConfig } from './generic-list';

const guard = (permission: string) => ({ canActivate: [permissionGuard], data: { permission } });
const chip = (ok: string[], off: string[] = []) => (r: { status: string }) => (ok.includes(r.status) ? 'ok' as const : off.includes(r.status) ? 'off' as const : '' as const);
const PO_ST = { draft: 'Brouillon', confirmed: 'Confirmée', partially_received: 'Partiellement reçue', received: 'Reçue', cancelled: 'Annulée', validated: 'Validé' } as Record<string, string>;
const st = (r: { status: string }) => PO_ST[r.status] ?? r.status;
const statuses = (m: string[]) => m.map((value) => ({ value, label: PO_ST[value] ?? value }));

export const ORDER_LIST: ListConfig = { title: 'Commandes d’achat', subtitle: 'Commandes aux fournisseurs locaux : confirmation, réceptions partielles ou totales, rapprochement', endpoint: '/purchase-orders', permission: 'purchases:view', createPermission: 'purchases:create', createLabel: 'Nouvelle commande', createRoute: '/purchase-orders/new',
  rowRoute: (r) => ['/purchase-orders', r.id], statuses: statuses(['draft', 'confirmed', 'partially_received', 'received', 'cancelled']), emptyIcon: 'shopping_cart', headerLinks: [{ label: 'Réceptions', icon: 'move_to_inbox', route: '/goods-receipts' }, { label: 'Factures d’achat', icon: 'receipt', route: '/purchase-invoices' }],
  columns: [{ label: 'N°', value: (r) => r.number, sort: 'number' }, { label: 'Fournisseur', value: (r) => r.supplier?.name }, { label: 'Date', value: (r) => r.orderDate, type: 'date', sort: 'orderDate' }, { label: 'Total TTC', value: (r) => r.totals.totalTtcMinor, type: 'money' },
    { label: 'Statut', value: st, type: 'chip', chip: chip(['confirmed', 'received'], ['cancelled']) }] };
export const RECEIPT_LIST: ListConfig = { title: 'Réceptions de marchandises', subtitle: 'La validation d’une réception entre les marchandises en stock et met à jour le coût de revient', endpoint: '/goods-receipts', permission: 'purchases:view', createPermission: 'purchases:create', createLabel: 'Depuis une commande', createRoute: '/purchase-orders',
  rowRoute: (r) => ['/goods-receipts', r.id], statuses: statuses(['draft', 'validated']), emptyIcon: 'move_to_inbox', headerLinks: [{ label: 'Commandes', icon: 'shopping_cart', route: '/purchase-orders' }],
  columns: [{ label: 'N°', value: (r) => r.number }, { label: 'Fournisseur', value: (r) => r.supplier?.name }, { label: 'Date', value: (r) => r.receiptDate, type: 'date' }, { label: 'Origine', value: (r) => (r.importFileId ? 'Importation' : 'Commande') }, { label: 'Statut', value: st, type: 'chip', chip: chip(['validated']) }] };
export const PINV_LIST: ListConfig = { title: 'Factures d’achat', subtitle: 'Contrôle à 3 voies : on ne facture pas plus que reçu ; écarts de prix consignés', endpoint: '/purchase-invoices', permission: 'purchases:view', createPermission: 'purchases:create', createLabel: 'Nouvelle facture d’achat', createRoute: '/purchase-invoices/new',
  rowRoute: (r) => ['/purchase-invoices', r.id], statuses: statuses(['draft', 'validated']), emptyIcon: 'receipt_long', headerLinks: [{ label: 'Commandes', icon: 'shopping_cart', route: '/purchase-orders' }],
  columns: [{ label: 'N° interne', value: (r) => r.number ?? 'Brouillon' }, { label: 'Facture fournisseur', value: (r) => r.supplierInvoiceNumber }, { label: 'Fournisseur', value: (r) => r.supplier?.name }, { label: 'Date', value: (r) => r.invoiceDate, type: 'date' },
    { label: 'Total TTC', value: (r) => r.totals.totalTtcMinor, type: 'money' }, { label: 'Statut', value: st, type: 'chip', chip: chip(['validated']) }] };
export const TRANSFER_LIST: ListConfig = { title: 'Transferts entre magasins', subtitle: 'Sortie et entrée dans une seule transaction, à la valeur du magasin source', endpoint: '/stock-transfers', permission: 'inventory:view', createPermission: 'inventory:create', createLabel: 'Nouveau transfert', createRoute: '/stock-transfers/new',
  rowRoute: (r) => ['/stock-transfers', r.id], statuses: statuses(['draft', 'validated']), emptyIcon: 'sync_alt', headerLinks: [{ label: 'Stock', icon: 'inventory', route: '/stock' }],
  columns: [{ label: 'N°', value: (r) => r.number }, { label: 'Date', value: (r) => r.date, type: 'date' }, { label: 'Articles', value: (r) => r.lines.length, type: 'qty' }, { label: 'Statut', value: st, type: 'chip', chip: chip(['validated']) }] };
export const INVENTORY_LIST: ListConfig = { title: 'Inventaires', subtitle: 'Comptage physique et régularisation contrôlée des écarts (motif obligatoire)', endpoint: '/inventories', permission: 'inventory:view', createPermission: 'inventory:create', createLabel: 'Nouvel inventaire', createRoute: '/inventories/new',
  rowRoute: (r) => ['/inventories', r.id], statuses: statuses(['draft', 'validated']), emptyIcon: 'fact_check', headerLinks: [{ label: 'Stock', icon: 'inventory', route: '/stock' }],
  columns: [{ label: 'N°', value: (r) => r.number }, { label: 'Date', value: (r) => r.date, type: 'date' }, { label: 'Motif', value: (r) => r.reason }, { label: 'Statut', value: st, type: 'chip', chip: chip(['validated']) }] };
const IMP_ST: Record<string, string> = { draft: 'Brouillon', ordered: 'Commandé', shipped: 'Expédié', customs: 'En douane', arrived: 'Arrivé', closed: 'Clôturé', integrated: 'Intégré', cancelled: 'Annulé' };
export const IMPORT_LIST: ListConfig = { title: 'Importations', subtitle: 'Dossiers d’importation : devises, frais annexes, coût de revient rendu et intégration au stock', endpoint: '/imports', permission: 'imports:view', createPermission: 'imports:create', createLabel: 'Nouveau dossier', createRoute: '/imports/new',
  rowRoute: (r) => ['/imports', r.id], statuses: Object.entries(IMP_ST).map(([value, label]) => ({ value, label })), emptyIcon: 'flight_land', headerLinks: [{ label: 'Taux de change', icon: 'currency_exchange', route: '/imports/rates' }],
  columns: [{ label: 'N°', value: (r) => r.number }, { label: 'Fournisseur', value: (r) => r.supplier?.name }, { label: 'Devise', value: (r) => r.currency }, { label: 'Date', value: (r) => r.orderDate, type: 'date' }, { label: 'Coût rendu', value: (r) => r.totals?.landedMinor, type: 'money' },
    { label: 'Statut', value: (r) => IMP_ST[r.status] ?? r.status, type: 'chip', chip: chip(['closed', 'integrated'], ['cancelled']) }] };

const list = (cfg: ListConfig) => ({ path: '', data: { cfg }, loadComponent: () => import('./generic-list').then((m) => m.GenericList) });
export const ORDER_ROUTES: Routes = [list(ORDER_LIST),
  { path: 'new', ...guard('purchases:create'), loadComponent: () => import('./purchases/purchase-forms').then((m) => m.OrderForm) },
  { path: ':id/edit', ...guard('purchases:update'), loadComponent: () => import('./purchases/purchase-forms').then((m) => m.OrderForm) },
  { path: ':id', loadComponent: () => import('./purchases/purchase-details').then((m) => m.OrderDetail) }];
export const RECEIPT_ROUTES: Routes = [list(RECEIPT_LIST),
  { path: 'new', ...guard('purchases:create'), loadComponent: () => import('./purchases/purchase-forms').then((m) => m.ReceiptForm) },
  { path: ':id/edit', ...guard('purchases:update'), loadComponent: () => import('./purchases/purchase-forms').then((m) => m.ReceiptForm) },
  { path: ':id', loadComponent: () => import('./purchases/purchase-details').then((m) => m.ReceiptDetail) }];
export const PINV_ROUTES: Routes = [list(PINV_LIST),
  { path: 'new', ...guard('purchases:create'), loadComponent: () => import('./purchases/purchase-forms').then((m) => m.PurchaseInvoiceForm) },
  { path: ':id/edit', ...guard('purchases:update'), loadComponent: () => import('./purchases/purchase-forms').then((m) => m.PurchaseInvoiceForm) },
  { path: ':id', loadComponent: () => import('./purchases/purchase-details').then((m) => m.PurchaseInvoiceDetail) }];
export const STOCK_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./stock/stock-overview').then((m) => m.StockOverview) },
  { path: 'movements', loadComponent: () => import('./stock/stock-movements').then((m) => m.StockMovements) },
  { path: 'warehouses', loadComponent: () => import('./stock/warehouses').then((m) => m.Warehouses) },
  { path: 'events', ...guard('inventory:validate'), loadComponent: () => import('./stock/stock-events').then((m) => m.StockEvents) }];
export const TRANSFER_ROUTES: Routes = [list(TRANSFER_LIST),
  { path: 'new', ...guard('inventory:create'), loadComponent: () => import('./stock/transfers-inventory').then((m) => m.TransferForm) },
  { path: ':id/edit', ...guard('inventory:update'), loadComponent: () => import('./stock/transfers-inventory').then((m) => m.TransferForm) },
  { path: ':id', loadComponent: () => import('./stock/transfers-inventory').then((m) => m.TransferDetail) }];
export const INVENTORY_ROUTES: Routes = [list(INVENTORY_LIST),
  { path: 'new', ...guard('inventory:create'), loadComponent: () => import('./stock/transfers-inventory').then((m) => m.InventoryStart) },
  { path: ':id', loadComponent: () => import('./stock/transfers-inventory').then((m) => m.InventoryDetail) }];
export const IMPORT_ROUTES: Routes = [list(IMPORT_LIST),
  { path: 'new', ...guard('imports:create'), loadComponent: () => import('./imports/import-form').then((m) => m.ImportForm) },
  { path: 'rates', loadComponent: () => import('./imports/exchange-rates').then((m) => m.ExchangeRates) },
  { path: ':id/edit', ...guard('imports:update'), loadComponent: () => import('./imports/import-form').then((m) => m.ImportForm) },
  { path: ':id', loadComponent: () => import('./imports/import-detail').then((m) => m.ImportDetail) }];
