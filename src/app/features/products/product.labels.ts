export const STATUS_LABEL: Record<string, string> = { active: 'Actif', inactive: 'Inactif', archived: 'Archivé', blocked: 'Bloqué' };
export const STATUS_CHIP: Record<string, string> = { active: 'ok', inactive: 'off', archived: 'off', blocked: 'danger' };
export const STATUS_HELP: Record<string, string> = {
  active: 'L’article peut être vendu, acheté et circuler en stock.',
  inactive: 'Plus de vente ni de nouvel achat. Les réceptions de commandes existantes et les mouvements correctifs de stock restent possibles.',
  blocked: 'Plus de vente, d’achat ni d’entrée en stock. Les sorties, transferts et inventaires restent possibles pour écouler ou corriger le stock.',
  archived: 'Plus aucune nouvelle opération ni modification. L’historique reste consultable ; l’article peut être réactivé.',
};
export const PACKAGING_TYPES = [{ value: 'carton', label: 'Carton' }, { value: 'wooden_crate', label: 'Caisse en bois' }, { value: 'pallet', label: 'Palette' }, { value: 'plastic_film', label: 'Film plastique' }, { value: 'other', label: 'Autre' }];
export const PACKAGING_LABEL: Record<string, string> = Object.fromEntries(PACKAGING_TYPES.map((t) => [t.value, t.label]));
export const DOC_TYPES = [
  { value: 'photo', label: 'Photo de l’article', icon: 'visibility' }, { value: 'supplier_invoice', label: 'Facture fournisseur', icon: 'receipt_long' }, { value: 'datasheet', label: 'Fiche technique', icon: 'description' },
  { value: 'manual', label: 'Manuel d’utilisation', icon: 'menu_book' }, { value: 'ce_certificate', label: 'Certificat CE', icon: 'verified' }, { value: 'origin_certificate', label: 'Certificat d’origine', icon: 'public' },
  { value: 'conformity', label: 'Déclaration de conformité', icon: 'fact_check' }, { value: 'customs', label: 'Document douanier', icon: 'account_balance' }, { value: 'warranty', label: 'Document de garantie', icon: 'shield' }, { value: 'other', label: 'Autre fichier', icon: 'attach_file' },
];
export const ACTIVITY_KINDS = [
  { value: 'call', label: 'Appel téléphonique', icon: 'call' }, { value: 'meeting', label: 'Réunion', icon: 'videocam' }, { value: 'task', label: 'Tâche à effectuer', icon: 'check_circle' },
  { value: 'reminder', label: 'Rappel de suivi', icon: 'schedule' }, { value: 'note', label: 'Note interne', icon: 'description' },
];
export const ACTIVITY_ICON: Record<string, string> = {
  call: 'call', meeting: 'videocam', task: 'check_circle', reminder: 'schedule', note: 'description', product_created: 'add', product_updated: 'edit', purchase_price_changed: 'payments', sale_price_changed: 'payments',
  technical_changed: 'edit', status_changed: 'sync_alt', document_added: 'attach_file', document_removed: 'delete', stock_setting_changed: 'warehouse', cost_changed: 'calculate', goods_received: 'move_to_inbox', stock_transfer: 'swap_vert', stock_changed: 'inventory',
};
export const STOCK_CHIP: Record<string, string> = { ok: 'ok', out: 'danger', below_min: 'warn', above_max: 'warn', negative: 'danger' };
export const TX_GROUPS = [{ value: '', label: 'Toutes les transactions' }, { value: 'purchases', label: 'Achats' }, { value: 'sales', label: 'Ventes' }, { value: 'stock', label: 'Stock' }, { value: 'imports', label: 'Importations' }];
export const PHASE_CHIP: Record<string, string> = { 'En cours': 'warn', 'Terminé': 'ok', 'Annulé': 'off' };
export const SERIAL_STATUS: Record<string, string> = { available: 'Disponible', sold: 'Vendu', returned: 'Retourné', scrapped: 'Mis au rebut' };
export const formatBytes = (n: number) => (n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(1)} Ko` : `${(n / 1048576).toFixed(1)} Mo`);
/** Format d'un nombre décimal (volumes, poids) à la française, jusqu'à 6 décimales utiles. */
export const num = (v: number | null | undefined, max = 6) => (v == null ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: max }));
