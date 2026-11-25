import { DocKind } from './customer.types';

export const STATUS_LABEL: Record<string, string> = { active: 'Actif', inactive: 'Inactif', archived: 'Archivé', blocked: 'Bloqué' };
export const STATUS_CHIP: Record<string, string> = { active: 'ok', inactive: 'off', archived: 'off', blocked: 'danger' };
export const STATUS_HELP: Record<string, string> = {
  active: 'Le client peut recevoir devis, factures et livraisons.',
  inactive: 'Aucune nouvelle vente. Les documents existants et les encaissements restent possibles.',
  blocked: 'Aucune nouvelle vente (impayés, litige…). Les encaissements restent possibles.',
  archived: 'Client retiré des listes. Aucune vente ni modification ; il peut être réactivé.',
};
export const TYPE_LABEL: Record<string, string> = { company: 'Société', walk_in: 'Passager' };
export const TYPE_ICON: Record<string, string> = { company: 'domain', walk_in: 'person' };
export const METHOD_LABEL: Record<string, string> = { cash: 'Espèces', check: 'Chèque', transfer: 'Virement', card: 'Carte bancaire', draft: 'Traite', other: 'Autre' };
export const PAYMENT_METHODS = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));
export const TERMS = [{ label: 'Comptant', days: 0 }, { label: '30 jours', days: 30 }, { label: '60 jours', days: 60 }];
export const KIND_LABEL: Record<string, string> = { quotation: 'Devis', proforma: 'Facture proforma', invoice: 'Facture', credit_note: 'Avoir', delivery_note: 'Bon de livraison' };
export const KIND_ICON: Record<string, string> = { quotation: 'request_quote', proforma: 'description', invoice: 'receipt_long', credit_note: 'undo', delivery_note: 'local_shipping' };
export const DOC_STATUS: Record<string, string> = {
  pending: 'En attente', accepted: 'Accepté', refused: 'Refusé', expired: 'Expiré', converted: 'Converti', cancelled: 'Annulé', draft: 'Brouillon', validated: 'Validé', unpaid: 'Impayée', partial: 'Partiellement payée', paid: 'Payée',
};
/** Libellé de statut d'une ligne de l'historique (une facture validée affiche son état de paiement). */
export function txStatus(r: { kind: DocKind; status: string; paymentStatus: string | null }): { label: string; chip: string } {
  if (r.kind === 'invoice' && r.status === 'validated' && r.paymentStatus) return { label: DOC_STATUS[r.paymentStatus] ?? r.paymentStatus, chip: r.paymentStatus === 'paid' ? 'ok' : r.paymentStatus === 'partial' ? 'warn' : 'danger' };
  const chip = ['accepted', 'validated', 'converted'].includes(r.status) ? 'ok' : ['refused', 'cancelled'].includes(r.status) ? 'danger' : r.status === 'pending' ? 'warn' : 'off';
  return { label: DOC_STATUS[r.status] ?? r.status, chip };
}
export const FILTER_STATUS: Record<string, { value: string; label: string }[]> = {
  '': ['pending', 'accepted', 'refused', 'expired', 'converted', 'cancelled', 'draft', 'validated', 'unpaid', 'partial', 'paid'].map((v) => ({ value: v, label: DOC_STATUS[v]! })),
};
export const DOC_TYPES = [{ value: 'registry_extract', label: 'Extrait du registre de commerce' }, { value: 'tax_card', label: 'Carte d’identification fiscale' }, { value: 'contract', label: 'Contrat commercial' }, { value: 'other', label: 'Autre document' }];
export const ACTIVITY_KINDS = [
  { value: 'call', label: 'Appel téléphonique', icon: 'call' }, { value: 'email', label: 'E-mail', icon: 'mail' }, { value: 'meeting', label: 'Réunion', icon: 'videocam' },
  { value: 'note', label: 'Note commerciale', icon: 'description' }, { value: 'follow_up', label: 'Suivi client', icon: 'schedule' }, { value: 'other', label: 'Autre activité', icon: 'info' },
];
export const ACTIVITY_ICON: Record<string, string> = {
  call: 'call', email: 'mail', meeting: 'videocam', note: 'description', follow_up: 'schedule', other: 'info', customer_created: 'person_add', customer_updated: 'edit', status_changed: 'sync_alt',
  document_added: 'attach_file', document_removed: 'delete', quotation_created: 'request_quote', quotation_sent: 'send', invoice_validated: 'receipt_long', payment_recorded: 'payments',
};
export const formatBytes = (n: number) => (n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(1)} Ko` : `${(n / 1048576).toFixed(1)} Mo`);
