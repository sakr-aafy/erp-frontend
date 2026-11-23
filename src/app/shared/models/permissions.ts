export const ACTIONS = ['view', 'create', 'update', 'validate', 'delete'] as const;
export const ACTION_LABELS: Record<string, string> = {
  view: 'Consulter', create: 'Créer', update: 'Modifier', validate: 'Valider', delete: 'Supprimer',
};
export const MODULE_LABELS: Record<string, string> = {
  customers: 'Clients', products: 'Produits / Articles', suppliers: 'Fournisseurs', quotations: 'Devis',
  proformas: 'Factures proforma', invoices: 'Factures de vente', deliveryNotes: 'Bons de livraison', purchases: 'Achats',
  inventory: 'Stock / Magasin', imports: 'Importations', costCalculation: 'Coût de revient', expenses: 'Dépenses',
  accounting: 'Comptabilité', treasury: 'Trésorerie / Banque', reports: 'Rapports & tableaux de bord', users: 'Utilisateurs',
  roles: 'Rôles & permissions', settings: 'Paramètres', audit: 'Journal d’audit',
};
