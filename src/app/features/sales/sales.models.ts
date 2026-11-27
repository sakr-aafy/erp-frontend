import { Address, AddressSnapshot } from '../../shared/models/api.models';
export type DocKind = 'quotations' | 'proformas' | 'invoices' | 'delivery-notes';
export interface DocLine {
  id?: string; position?: number; productId?: string | null; reference?: string | null; designation: string; description?: string | null; unit?: string | null; kind?: string;
  quantity: number; unitPriceMinor: number; discountPct: number; vat: { code: string; regime: string; ratePct: number };
  grossMinor?: number; discountMinor?: number; netHtMinor?: number; deliveredQty?: number; sourceLineId?: string | null;
}
export interface VatGroup { vatCode: string; regime: string; ratePct: number; baseMinor: number; vatMinor: number }
export interface DocTotals {
  grossMinor: number; lineDiscountsMinor: number; globalDiscountMinor: number; totalHtMinor: number; vatGroups: VatGroup[]; totalVatMinor: number; totalTtcMinor: number;
  stampMinor: number; withholdingMinor: number; totalPayableMinor: number;
}
export interface ScheduleItem { id?: string; dueDate: string; percent?: number | null; amountMinor?: number; paidMinor?: number; creditedMinor?: number; openMinor?: number }
export interface SalesDoc {
  id: string; number: string | null; status: string; type?: 'invoice' | 'credit_note'; customerId: string; customer: { name: string; code?: string | null; taxId?: string | null; shippingAddress?: Address | null };
  deliveryAddress?: AddressSnapshot | null; paymentTerms?: string | null; paymentTermsCustom?: boolean;
  issueDate?: string; validUntil?: string; deliveryDate?: string; lines: DocLine[]; totals: DocTotals; globalDiscountPct: number; globalDiscountMinor: number;
  withholdingOperationType?: string | null; withholding?: { code: string; ratePct: number; base: string; amountMinor: number } | null; stamp?: { code: string; amountMinor: number } | null;
  notes?: string | null; terms?: string | null; editable?: boolean; paymentMethod?: string | null; schedule?: ScheduleItem[]; paidMinor?: number; creditedMinor?: number; balanceDueMinor?: number; overpaidMinor?: number;
  paymentStatus?: 'unpaid' | 'partial' | 'paid'; overdue?: boolean; creditedInvoiceId?: string | null; creditReason?: string | null; quotationId?: string | null; proformaId?: string | null;
  invoiceId?: string | null; deliveryNoteIds?: string[]; carrier?: string | null; source?: { type: string; id: string; number: string | null } | null; invoiced?: boolean; cancellable?: boolean;
  sentAt?: string | null; cancelReason?: string | null; createdAt?: string;
  /** Devis : transmission, décision et duplication. */
  statusLabel?: string; sentBy?: string | null; sentTo?: string | null; sentMethod?: string | null; sentMethodLabel?: string | null;
  acceptedAt?: string | null; acceptedBy?: string | null; acceptanceNote?: string | null; refusedAt?: string | null; refusedBy?: string | null; refusalReason?: string | null; expiredAt?: string | null; duplicatedFromId?: string | null;
}
export interface QuotationActivity {
  id: string; kind: string; title: string; description: string | null; occurredAt: string; user: string | null; system: boolean;
  line: { reference: string | null; designation: string | null; position: number | null } | null; valueType: 'money' | 'percent' | 'number' | 'text' | 'date' | null; oldValue: unknown; newValue: unknown;
  related: { type: string; id: string; number: string | null } | null;
}
export interface PaymentDto { id: string; invoiceId: string; amountMinor: number; method: string; paidAt: string; reference: string | null; note: string | null; status: string; cancelReason: string | null }
export interface CalcPreview { lines: { netHtMinor: number; vat: { code: string; regime: string; ratePct: number } }[]; totals: DocTotals; withholding: { code: string; ratePct: number; base: string; amountMinor: number } | null; stamp: { code: string; amountMinor: number } | null }
export interface SourceLines { sourceNumber: string | null; customerId: string; deliveryAddress?: AddressSnapshot | null; lines: { sourceLineId: string; hasSerial?: boolean; designation: string; quantity: number; deliveredQty: number; remainingQty: number }[] }

export const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: 'Espèces', check: 'Chèque', transfer: 'Virement', card: 'Carte bancaire', draft: 'Traite', other: 'Autre' };
export const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', expired: 'Expiré', converted: 'Convertie', cancelled: 'Annulé', draft: 'Brouillon', validated: 'Validée',
  unpaid: 'Impayée', partial: 'Partiellement payée', paid: 'Payée',
};
export interface DocConfig {
  kind: DocKind; title: string; singular: string; gender: 'm' | 'f'; route: string; permission: string; calcType: string; icon: string;
  statuses: string[]; hasValidity: boolean;
}
export const DOC_CONFIG: Record<DocKind, DocConfig> = {
  quotations: { kind: 'quotations', title: 'Devis', singular: 'devis', gender: 'm', route: '/quotations', permission: 'quotations', calcType: 'quotation', icon: 'request_quote', statuses: ['pending', 'sent', 'accepted', 'refused', 'expired'], hasValidity: true },
  proformas: { kind: 'proformas', title: 'Factures proforma', singular: 'facture proforma', gender: 'f', route: '/proformas', permission: 'proformas', calcType: 'proforma', icon: 'description', statuses: ['pending', 'converted', 'expired', 'cancelled'], hasValidity: true },
  invoices: { kind: 'invoices', title: 'Factures de vente', singular: 'facture', gender: 'f', route: '/invoices', permission: 'invoices', calcType: 'invoice', icon: 'receipt', statuses: ['draft', 'validated'], hasValidity: false },
  'delivery-notes': { kind: 'delivery-notes', title: 'Bons de livraison', singular: 'bon de livraison', gender: 'm', route: '/delivery-notes', permission: 'deliveryNotes', calcType: 'deliveryNote', icon: 'local_shipping', statuses: ['draft', 'validated', 'cancelled'], hasValidity: false },
};

/** Indicateurs des cinq statuts d'un devis (couleurs de la marque et neutres ; rouge réservé au refus). */
export const QUOTATION_STATUS_STYLE: Record<string, { chip: string; icon: string }> = {
  pending: { chip: 'warn', icon: 'schedule' }, sent: { chip: 'info', icon: 'send' }, accepted: { chip: 'solid', icon: 'check_circle' }, refused: { chip: 'danger', icon: 'cancel' }, expired: { chip: 'off', icon: 'event_busy' },
};
export const SEND_METHODS = [{ value: 'hand', label: 'Remise en main propre' }, { value: 'post', label: 'Courrier' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'phone', label: 'Téléphone' }, { value: 'other', label: 'Autre moyen' }];
