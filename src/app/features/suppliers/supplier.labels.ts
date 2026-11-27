import { SupplierTx, SupplierTxKind } from './supplier.types';

/** Les montants d'un fournisseur exigent l'une de ces permissions (contrôlé aussi par le serveur). */
export const FINANCE_PERMISSIONS = ['purchases:view', 'treasury:view', 'accounting:view'];
export const SUPPLIER_STATUS_LABEL: Record<string, string> = { active: 'Actif', inactive: 'Inactif', archived: 'Archivé', blocked: 'Bloqué' };
export const SUPPLIER_STATUS_CHIP: Record<string, string> = { active: 'ok', inactive: 'off', archived: 'off', blocked: 'danger' };
export const SUPPLIER_STATUS_HELP: Record<string, string> = {
  active: 'Le fournisseur peut recevoir des commandes.',
  inactive: 'Aucune nouvelle commande. L’historique, les factures des opérations passées et les règlements restent disponibles.',
  blocked: 'Aucune nouvelle commande (litige, qualité…). Les règlements restent possibles.',
  archived: 'Fournisseur retiré des listes. Aucune commande ni modification ; consultation et règlement des dettes restent possibles.',
};
export const TX_LABEL: Record<SupplierTxKind, string> = { purchase_order: 'Commande d’achat', goods_receipt: 'Bon de réception', purchase_invoice: 'Facture d’achat', import_file: 'Dossier d’importation' };
export const TX_ICON: Record<SupplierTxKind, string> = { purchase_order: 'shopping_cart', goods_receipt: 'move_to_inbox', purchase_invoice: 'receipt_long', import_file: 'flight_land' };
export const TX_STATUS: Record<string, string> = {
  draft: 'Brouillon', confirmed: 'Confirmée', partially_received: 'Réception partielle', received: 'Reçue', cancelled: 'Annulé', validated: 'Validé', unpaid: 'Impayée', partial: 'Partiellement payée', paid: 'Payée',
  ordered: 'Commandé', shipped: 'Expédié', customs: 'En douane', arrived: 'Arrivé', closed: 'Clôturé', integrated: 'Intégré',
};
/** Libellé et couleur d'une ligne d'historique (une facture validée affiche son état de paiement). */
export function supplierTxStatus(r: Pick<SupplierTx, 'kind' | 'status' | 'paymentStatus'>): { label: string; chip: string } {
  if (r.kind === 'purchase_invoice' && r.status === 'validated' && r.paymentStatus) return { label: TX_STATUS[r.paymentStatus] ?? r.paymentStatus, chip: r.paymentStatus === 'paid' ? 'ok' : r.paymentStatus === 'partial' ? 'warn' : 'danger' };
  const chip = ['validated', 'received', 'integrated', 'closed'].includes(r.status) ? 'ok' : r.status === 'cancelled' ? 'danger' : ['confirmed', 'partially_received', 'ordered', 'shipped', 'customs', 'arrived'].includes(r.status) ? 'warn' : 'off';
  return { label: TX_STATUS[r.status] ?? r.status, chip };
}
export const SUPPLIER_DOC_TYPES = [
  { value: 'administrative', label: 'Document administratif' }, { value: 'tax_card', label: 'Carte d’identification fiscale' }, { value: 'contract', label: 'Contrat fournisseur' }, { value: 'catalog', label: 'Catalogue' },
  { value: 'price_list', label: 'Tarif fournisseur' }, { value: 'conformity_certificate', label: 'Certificat de conformité' }, { value: 'origin_certificate', label: 'Certificat d’origine' }, { value: 'insurance', label: 'Document d’assurance' },
  { value: 'transport', label: 'Document de transport' }, { value: 'customs', label: 'Document douanier' }, { value: 'other', label: 'Autre document' },
];
export const SUPPLIER_ACTIVITY_KINDS = [
  { value: 'call', label: 'Appel téléphonique' }, { value: 'email', label: 'E-mail' }, { value: 'meeting', label: 'Réunion' }, { value: 'note', label: 'Note interne' },
  { value: 'task', label: 'Tâche' }, { value: 'reminder', label: 'Rappel' }, { value: 'follow_up', label: 'Suivi fournisseur' },
];
export const SUPPLIER_ACTIVITY_ICON: Record<string, string> = {
  call: 'call', email: 'mail', meeting: 'videocam', note: 'description', task: 'check_circle', reminder: 'schedule', follow_up: 'schedule', supplier_created: 'person_add', supplier_updated: 'edit', category_changed: 'category',
  status_changed: 'sync_alt', document_added: 'attach_file', document_removed: 'delete', order_created: 'shopping_cart', order_confirmed: 'check_circle', receipt_validated: 'move_to_inbox',
  purchase_invoice_validated: 'receipt_long', payment_recorded: 'payments', import_created: 'flight_land',
};
