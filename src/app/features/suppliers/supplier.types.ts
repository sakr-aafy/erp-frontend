import { SupplierDto } from '../../shared/models/api.models';

export type SupplierTxKind = 'purchase_order' | 'goods_receipt' | 'purchase_invoice' | 'import_file';
export interface SupplierTx {
  id: string; kind: SupplierTxKind; number: string | null; externalRef: string | null; date: string; totalHtMinor: number | null; totalTtcMinor: number | null; currency: string;
  foreignMinor: number | null; status: string; paymentStatus: string | null; webPath: string;
}
export interface SupplierFinance {
  purchasesHtMinor: number; billedMinor: number; invoiceCount: number; paidMinor: number; paymentsCount: number; balanceMinor: number; computedBalanceMinor: number; consistent: boolean;
  unpaidMinor: number; unpaidCount: number; overdueMinor: number; overdueInvoices: number; upcomingMinor: number; excessMinor: number; thresholdMinor: number | null; ordersBlocked: boolean;
  lastPurchaseDate: string | null; lastPurchaseNumber: string | null;
}
export interface SupplierPaymentRow {
  id: string; number: string; reference: string | null; paidAt: string; amountMinor: number; method: string; status: 'active' | 'cancelled'; account: string | null;
  invoices: { id: string; number: string | null; amountMinor: number }[];
}
export interface OpenPurchaseInvoice {
  id: string; number: string | null; supplierInvoiceNumber: string; invoiceDate: string; dueDate: string; totalMinor: number; paidMinor: number; remainingMinor: number; paymentStatus: string; overdue: boolean;
}
export interface SupplierSummary { supplier: SupplierDto; finance: SupplierFinance | null; recent: { documents: SupplierTx[]; payments: SupplierPaymentRow[] }; allowedKinds: SupplierTxKind[] }
export interface SupplierPaymentsView {
  finance: SupplierFinance; unpaidInvoices: OpenPurchaseInvoice[]; items: SupplierPaymentRow[]; total: number; page: number; limit: number; canSeeHistory: boolean; currency: string;
}
export interface SupplierDocumentDto { id: string; type: string; typeLabel: string; description: string | null; name: string; mime: string | null; size: number; uploadedBy: string | null; uploadedAt: string }
export interface SupplierDocuments { items: SupplierDocumentDto[]; linked: { importId: string; importNumber: string; name: string; received: boolean; fileName: string | null }[] }
export interface SupplierActivityDto { id: string; auto: boolean; derived: boolean; editable: boolean; kind: string; kindLabel: string; title: string; description: string | null; occurredAt: string; user: string | null; ref?: { type: string; id: string; number: string | null } }
