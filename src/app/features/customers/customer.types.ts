import { Customer2 } from '../../shared/models/api.models';

export type DocKind = 'quotation' | 'proforma' | 'invoice' | 'credit_note' | 'delivery_note';
export interface TxRow {
  id: string; kind: DocKind; number: string | null; date: string; totalHtMinor: number | null; totalTtcMinor: number | null; payableMinor: number | null;
  status: string; paymentStatus: string | null; pdfPath: string; webPath: string;
}
export interface Finance {
  revenueHtMinor: number; revenueTtcMinor: number; billedMinor: number; creditNotesMinor: number; paidMinor: number; paymentsCount: number; balanceMinor: number; computedBalanceMinor: number; consistent: boolean;
  unpaidMinor: number; unpaidCount: number; overdueMinor: number; overdueInvoices: number; excessMinor: number; creditLimitMinor: number | null; availableCreditMinor: number | null; creditExceeded: boolean;
  lastSaleDate: string | null; lastInvoiceNumber: string | null; invoiceCount: number;
}
export interface PaymentRow { id: string; invoiceId: string; invoiceNumber: string | null; amountMinor: number; method: string; paidAt: string; reference: string | null; status: string; account: string | null; cancelledAt?: string | null }
export interface CustomerSummary { customer: Customer2; finance: Finance | null; recent: { documents: TxRow[]; payments: PaymentRow[] }; allowedKinds: DocKind[] }
export interface Paged<T> { items: T[]; total: number; page: number; limit: number }
export interface UnpaidInvoice { id: string; number: string | null; issueDate: string; totalMinor: number; paidMinor: number; creditedMinor: number; remainingMinor: number; paymentStatus: string; nextDueDate: string | null; overdue: boolean }
export interface PaymentsView extends Paged<PaymentRow> { finance: Finance; unpaidInvoices: UnpaidInvoice[]; canSeeAccounts: boolean }
export interface TxPage extends Paged<TxRow> { allowedKinds: DocKind[] }
export interface DocumentDto { id: string; type: string; typeLabel: string; description: string | null; name: string; mime: string | null; size: number; uploadedBy: string | null; uploadedAt: string }
export interface ActivityDto { id: string; auto: boolean; derived: boolean; editable: boolean; kind: string; kindLabel: string; title: string; description: string | null; occurredAt: string; user: string | null; ref?: { type: string; id: string; number: string | null } }
export interface ContactInput { name: string; role?: string; phone?: string; email?: string; isPrimary?: boolean }
