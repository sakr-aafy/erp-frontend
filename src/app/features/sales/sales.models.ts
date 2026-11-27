import { Address, AddressSnapshot } from '../../shared/models/api.models';
export type DocKind = 'quotations' | 'proformas' | 'invoices' | 'delivery-notes';
export interface DocLine {
  id?: string; position?: number; productId?: string | null; reference?: string | null; designation: string; description?: string | null; unit?: string | null; kind?: string;
  quantity: number; unitPriceMinor: number; discountPct: number; vat: { code: string; regime: string; ratePct: number };
  grossMinor?: number; discountMinor?: number; netHtMinor?: number; deliveredQty?: number; sourceLineId?: string | null;
  serials?: string[] | null;
  /** Bon de livraison : retours, quantité facturée et restant à facturer. */
  returnedQty?: number; billedQty?: number; availableToBill?: number;
  /** Facture issue de BL : livraison d'origine. */
  delivery?: { noteId: string; noteNumber: string | null } | null;
}
export interface VatGroup { vatCode: string; regime: string; ratePct: number; baseMinor: number; vatMinor: number }
export interface DocTotals {
  grossMinor: number; lineDiscountsMinor: number; globalDiscountMinor: number; totalHtMinor: number; vatGroups: VatGroup[]; totalVatMinor: number; totalTtcMinor: number;
  stampMinor: number; withholdingMinor: number; totalPayableMinor: number;
}
export interface ScheduleItem { id?: string; dueDate: string; percent?: number | null; amountMinor?: number; paidMinor?: number; creditedMinor?: number; openMinor?: number }
export type ProgressState = 'none' | 'partial' | 'full';
export interface DeliveryReturn { id: string; date: string; warehouseId: string | null; reason: string; userName: string | null; lines: { lineId: string; designation: string; unit: string | null; quantity: number; serials: string[]; creditedQty: number }[] }
export interface SalesDoc {
  /** Proforma : avancements indépendants du statut administratif. */
  deliveryState?: ProgressState; deliveryPct?: number; billingState?: ProgressState; billingPct?: number; quotationNumber?: string | null;
  cancelledByName?: string | null; legacyFlow?: boolean; sentByName?: string | null;
  /** Bon de livraison. */
  billing?: 'none' | 'partial' | 'full' | 'source'; invoiceIds?: string[]; returns?: DeliveryReturn[]; returnable?: boolean; warehouseId?: string | null; validatedByName?: string | null; validatedAt?: string | null;
  /** Facture issue de BL et avoirs. */
  origin?: 'delivery' | null; linesLocked?: boolean; creditEffect?: CreditEffect | null; sourceRefs?: { quotationNumber?: string; quotationVersion?: number; proformaNumber?: string } | null;
  id: string; number: string | null; status: string; type?: 'invoice' | 'credit_note'; customerId: string; customer: { name: string; code?: string | null; taxId?: string | null; shippingAddress?: Address | null };
  deliveryAddress?: AddressSnapshot | null; paymentTerms?: string | null; paymentTermsCustom?: boolean;
  issueDate?: string; validUntil?: string; deliveryDate?: string; lines: DocLine[]; totals: DocTotals;
  /** Ancienne remise globale (documents antérieurs), remise globale recopiée sur les lignes, remise supplémentaire en montant. */
  globalDiscountPct: number; syncDiscountPct?: number; globalDiscountMinor: number;
  /** Devis et proforma. */
  deliveryTime?: string | null; version?: number; acceptedVersion?: number | null; revision?: number; quotationVersion?: number | null; actions?: QuotationRights;
  cancelledAt?: string | null;
  withholdingOperationType?: string | null; withholding?: { code: string; ratePct: number; base: string; amountMinor: number } | null; stamp?: { code: string; amountMinor: number } | null;
  notes?: string | null; terms?: string | null; editable?: boolean; paymentMethod?: string | null; schedule?: ScheduleItem[]; paidMinor?: number; creditedMinor?: number; balanceDueMinor?: number; overpaidMinor?: number;
  paymentStatus?: 'unpaid' | 'partial' | 'paid'; overdue?: boolean; creditedInvoiceId?: string | null; creditReason?: string | null; quotationId?: string | null; proformaId?: string | null;
  invoiceId?: string | null; deliveryNoteIds?: string[]; carrier?: string | null; source?: { type: string; id: string; number: string | null } | null; invoiced?: boolean; cancellable?: boolean;
  sentAt?: string | null; cancelReason?: string | null; createdAt?: string;
  /** Devis : transmission, décision et duplication. */
  statusLabel?: string; sentBy?: string | null; sentTo?: string | null; sentMethod?: string | null; sentMethodLabel?: string | null;
  acceptedAt?: string | null; acceptedBy?: string | null; acceptanceNote?: string | null; refusedAt?: string | null; refusedBy?: string | null; refusalReason?: string | null; expiredAt?: string | null; duplicatedFromId?: string | null;
}
export interface QuotationRights { edit: boolean; remove: boolean; duplicate: boolean; newVersion: boolean; abandonVersion: boolean; send: boolean; accept: boolean; refuse: boolean; convertProforma: boolean }
export interface QuotationVersion {
  version: number; status: string; statusLabel: string; current: boolean; accepted: boolean; frozen: boolean; createdAt: string; author: string | null; sentAt: string | null; sentTo: string | null;
  origin: 'application' | 'migration'; frozenAt: string | null; totalHtMinor: number; totalTtcMinor: number;
}
export interface QuotationVersionView { version: number; status: string; statusLabel: string; origin: 'application' | 'migration'; frozenAt: string | null; author: string | null; content: SalesDoc & { currency?: { symbol: string | null; code: string; decimals: number } } }
export interface QuotationDocumentDto {
  id: string; type: string; typeLabel: string; description: string | null; version: number | null; name: string; mime: string | null; size: number; uploadedBy: string | null; uploadedAt: string; lockedReason: string | null; previewable: boolean;
}
export interface QuotationComment { id: string; body: string | null; author: string | null; createdAt: string; editedAt: string | null; editedBy: string | null; archivedAt: string | null; archivedBy: string | null; canEdit: boolean; canArchive: boolean }
export const QUOTATION_DOC_TYPES = [
  { value: 'price_request', label: 'Demande de prix' }, { value: 'specifications', label: 'Cahier des charges' }, { value: 'catalog', label: 'Catalogue' }, { value: 'datasheet', label: 'Fiche technique' },
  { value: 'drawing', label: 'Plan technique' }, { value: 'signed_quote', label: 'Devis signé' }, { value: 'customer_confirmation', label: 'Confirmation du client' }, { value: 'other', label: 'Autre document' },
];
export interface QuotationActivity {
  id: string; kind: string; title: string; description: string | null; occurredAt: string; user: string | null; system: boolean;
  line: { reference: string | null; designation: string | null; position: number | null } | null; valueType: 'money' | 'percent' | 'number' | 'text' | 'date' | null; oldValue: unknown; newValue: unknown;
  related: { type: string; id: string; number: string | null } | null;
}
export interface PaymentDto { id: string; invoiceId: string; amountMinor: number; method: string; paidAt: string; reference: string | null; note: string | null; status: string; cancelReason: string | null }
export interface CalcPreview { lines: { netHtMinor: number; vat: { code: string; regime: string; ratePct: number } }[]; totals: DocTotals; withholding: { code: string; ratePct: number; base: string; amountMinor: number } | null; stamp: { code: string; amountMinor: number } | null }
export interface SourceLine { sourceLineId: string; productId: string | null; reference: string | null; designation: string; unit: string | null; kind: string; hasSerial: boolean; quantity: number; deliveredQty: number; remainingQty: number; draftQty: number; stock: { warehouseId: string; qty: number }[] | null }
export interface SourceLines { sourceNumber: string | null; customerId: string; deliveryAddress?: AddressSnapshot | null; fullyDelivered: number; warehouses: WarehouseOption[]; lines: SourceLine[] }
export interface WarehouseOption { id: string; code: string; name: string; isActive: boolean; isDefault: boolean }

// ---- Cycle commercial ----
export type CreditEffect = 'financial' | 'return' | 'billing_correction';
export const CREDIT_EFFECTS: { value: CreditEffect; label: string; help: string }[] = [
  { value: 'financial', label: 'Avoir financier', help: 'Corrige les montants et le solde du client. Aucune entrée de stock, aucune quantité à refacturer.' },
  { value: 'return', label: 'Retour de marchandise', help: 'Autorise ensuite l’enregistrement du retour physique sur le bon de livraison. Le stock n’évolue qu’à ce moment-là.' },
  { value: 'billing_correction', label: 'Correction de facturation', help: 'Les quantités créditées redeviennent à facturer depuis leurs bons de livraison. Aucune entrée de stock.' },
];
export interface TrackingLine { lineId: string; reference: string | null; designation: string; unit: string | null; kind: string; ordered: number; delivered: number; returned: number; remainingToDeliver: number; inDraftDeliveries: number; invoiced: number; inDraftInvoices: number; deliveredNotInvoiced: number; remainingToBill: number }
export interface Tracking {
  legacyFlow: boolean; lines: TrackingLine[]; method: string; billableDeliveries: number;
  delivery: { state: ProgressState; pct: number; label: string; count: number; validatedCount: number }; billing: { state: ProgressState; pct: number; label: string; count: number; validatedCount: number };
}
export interface Cancellation { allowed: boolean; blockers: { type: 'proforma' | 'deliveryNote' | 'invoice'; id: string; number: string | null; message: string }[]; warnings: string[]; draftDeliveries: { id: string; number: string }[]; quotation: { id: string; number: string; willCancel: boolean; reason: string | null } | null }
export type ChainType = 'quotation' | 'proforma' | 'deliveryNote' | 'invoice';
export interface ChainItem { type: ChainType; label: string; id: string; number: string | null; date: string; status: string; statusLabel: string; amountMinor: number; route: string; current: boolean; detail: string | null }
export interface CycleEventDto { id: string; action: string; title: string; at: string; user: string | null; number: string | null; description: string | null }
export interface Billable {
  id: string; number: string; date: string; status: string; billing: string; customerId: string; customerName: string; source: { type: string; id: string; number: string | null } | null; groupKey: string; totalHtMinor: number; totalTtcMinor: number;
  lines: { lineId: string; reference: string | null; designation: string; unit: string | null; quantity: number; returned: number; available: number }[];
}
export interface Returnable { lines: { lineId: string; reference: string | null; designation: string; unit: string | null; delivered: number; returned: number; billed: number; unbilled: number; credited: number; returnable: number; serials: string[] }[] }
export const PROGRESS_LABELS = { delivery: { none: 'Non livrée', partial: 'Partiellement livrée', full: 'Totalement livrée' }, billing: { none: 'Non facturée', partial: 'Partiellement facturée', full: 'Totalement facturée' } } as const;
export const BL_BILLING_LABELS: Record<string, string> = { none: 'Non facturé', partial: 'Partiellement facturé', full: 'Facturé', source: 'Facturé (facture source)' };

export const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: 'Espèces', check: 'Chèque', transfer: 'Virement', card: 'Carte bancaire', draft: 'Traite', other: 'Autre' };
export const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', superseded: 'Remplacée', converted_legacy: 'Convertie (ancien parcours)', abandoned: 'Brouillon abandonné', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', expired: 'Expiré', converted: 'Convertie', cancelled: 'Annulé', draft: 'Brouillon', validated: 'Validée',
  unpaid: 'Impayée', partial: 'Partiellement payée', paid: 'Payée',
};
export interface DocConfig {
  kind: DocKind; title: string; singular: string; gender: 'm' | 'f'; route: string; permission: string; calcType: string; icon: string;
  statuses: string[]; hasValidity: boolean;
}
export const DOC_CONFIG: Record<DocKind, DocConfig> = {
  quotations: { kind: 'quotations', title: 'Devis', singular: 'devis', gender: 'm', route: '/quotations', permission: 'quotations', calcType: 'quotation', icon: 'request_quote', statuses: ['draft', 'sent', 'accepted', 'refused', 'expired', 'cancelled'], hasValidity: true },
  proformas: { kind: 'proformas', title: 'Factures proforma', singular: 'facture proforma', gender: 'f', route: '/proformas', permission: 'proformas', calcType: 'proforma', icon: 'description', statuses: ['pending', 'cancelled', 'expired', 'converted'], hasValidity: true },
  invoices: { kind: 'invoices', title: 'Factures de vente', singular: 'facture', gender: 'f', route: '/invoices', permission: 'invoices', calcType: 'invoice', icon: 'receipt', statuses: ['draft', 'validated'], hasValidity: false },
  'delivery-notes': { kind: 'delivery-notes', title: 'Bons de livraison', singular: 'bon de livraison', gender: 'm', route: '/delivery-notes', permission: 'deliveryNotes', calcType: 'deliveryNote', icon: 'local_shipping', statuses: ['draft', 'validated', 'cancelled'], hasValidity: false },
};

/** Indicateurs des statuts d'un devis (couleurs de la marque et neutres ; rouge réservé au refus). */
export const QUOTATION_STATUS_STYLE: Record<string, { chip: string; icon: string }> = {
  draft: { chip: 'warn', icon: 'edit' }, cancelled: { chip: 'off', icon: 'block' }, sent: { chip: 'info', icon: 'send' }, accepted: { chip: 'solid', icon: 'check_circle' }, refused: { chip: 'danger', icon: 'cancel' }, expired: { chip: 'off', icon: 'event_busy' },
};
export const SEND_METHODS = [{ value: 'hand', label: 'Remise en main propre' }, { value: 'post', label: 'Courrier' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'phone', label: 'Téléphone' }, { value: 'other', label: 'Autre moyen' }];
