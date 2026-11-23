export interface NavItem { label: string; icon: string; route: string; permission?: string; platformAdmin?: boolean; query?: Record<string, string> }
export interface NavGroup { title: string; icon: string; items: NavItem[]; /** Groupe sans titre déroulant (entrée de premier niveau). */ flat?: boolean }

/**
 * Menu par modules. Chaque entrée correspond à une page réelle ; l'affichage est filtré par les permissions RBAC
 * (le serveur reste l'autorité). Aucun module non implémenté n'est listé.
 */
export const NAV: NavGroup[] = [
  { title: 'Tableau de bord', icon: 'dashboard', flat: true, items: [{ label: 'Tableau de bord', icon: 'dashboard', route: '/dashboard' }] },
  {
    title: 'Référentiels', icon: 'groups',
    items: [
      { label: 'Clients', icon: 'groups', route: '/customers', permission: 'customers:view' },
      { label: 'Produits / Articles', icon: 'inventory_2', route: '/products', permission: 'products:view' },
      { label: 'Fournisseurs', icon: 'local_shipping', route: '/suppliers', permission: 'suppliers:view' },
    ],
  },
  {
    title: 'Gestion commerciale', icon: 'receipt',
    items: [
      { label: 'Devis', icon: 'request_quote', route: '/quotations', permission: 'quotations:view' },
      { label: 'Proforma', icon: 'description', route: '/proformas', permission: 'proformas:view' },
      { label: 'Factures de vente', icon: 'receipt', route: '/invoices', permission: 'invoices:view' },
      { label: 'Avoirs', icon: 'undo', route: '/invoices', query: { type: 'credit_note' }, permission: 'invoices:view' },
      { label: 'Bons de livraison', icon: 'local_shipping', route: '/delivery-notes', permission: 'deliveryNotes:view' },
    ],
  },
  {
    title: 'Logistique', icon: 'inventory',
    items: [
      { label: 'Achats', icon: 'shopping_cart', route: '/purchase-orders', permission: 'purchases:view' },
      { label: 'Réceptions', icon: 'move_to_inbox', route: '/goods-receipts', permission: 'purchases:view' },
      { label: 'Factures d’achat', icon: 'receipt_long', route: '/purchase-invoices', permission: 'purchases:view' },
      { label: 'Stock / Magasins', icon: 'inventory', route: '/stock', permission: 'inventory:view' },
      { label: 'Mouvements', icon: 'swap_vert', route: '/stock/movements', permission: 'inventory:view' },
      { label: 'Transferts', icon: 'sync_alt', route: '/stock-transfers', permission: 'inventory:view' },
      { label: 'Inventaires', icon: 'fact_check', route: '/inventories', permission: 'inventory:view' },
      { label: 'Importations', icon: 'flight_land', route: '/imports', permission: 'imports:view' },
      { label: 'Coût de revient', icon: 'calculate', route: '/costs', permission: 'costCalculation:view' },
    ],
  },
  {
    title: 'Finance', icon: 'account_balance',
    items: [
      { label: 'Dépenses', icon: 'payments', route: '/expenses', permission: 'expenses:view' },
      { label: 'Comptabilité', icon: 'menu_book', route: '/accounting', permission: 'accounting:view' },
      { label: 'Trésorerie', icon: 'account_balance', route: '/treasury', permission: 'treasury:view' },
      { label: 'Banque', icon: 'fact_check', route: '/treasury/reconciliation', permission: 'treasury:validate' },
    ],
  },
  {
    title: 'Pilotage', icon: 'trend_up',
    items: [
      { label: 'Rapports', icon: 'table_view', route: '/reports', permission: 'reports:view' },
    ],
  },
  {
    title: 'Administration', icon: 'settings',
    items: [
      { label: 'Utilisateurs', icon: 'group', route: '/users', permission: 'users:view' },
      { label: 'Rôles et permissions', icon: 'admin_panel_settings', route: '/roles', permission: 'roles:view' },
      { label: 'Paramètres', icon: 'settings', route: '/settings', permission: 'settings:view' },
      { label: 'Fiscalité', icon: 'receipt_long', route: '/fiscal', permission: 'settings:view' },
      { label: 'Journal d’audit', icon: 'history', route: '/audit', permission: 'audit:view' },
      { label: 'Sociétés', icon: 'domain', route: '/companies', platformAdmin: true },
    ],
  },
];

/** Libellés des segments d'URL secondaires (fil d'Ariane). */
export const SEGMENT_LABELS: Record<string, string> = {
  new: 'Nouveau', edit: 'Modifier', movements: 'Mouvements', warehouses: 'Magasins', events: 'Événements', categories: 'Catégories', catalog: 'Catalogue', reconciliation: 'Rapprochement bancaire',
  'supplier-payments': 'Règlements fournisseurs', 'sales-by-period': 'Ventes par période', rates: 'Taux de change', import: 'Import', 'change-password': 'Mot de passe',
};
