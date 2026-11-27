import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Customer2, Page } from '../../shared/models/api.models';
import { CalcPreview, DocKind, PaymentDto, QuotationActivity, QuotationComment, QuotationDocumentDto, QuotationVersion, QuotationVersionView, SalesDoc, SourceLines } from './sales.models';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private http = inject(HttpClient); private api = environment.apiUrl;
  list(kind: DocKind, q: Record<string, string | number | boolean | undefined>) {
    let p = new HttpParams(); for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== false) p = p.set(k, String(v));
    return this.http.get<Page<SalesDoc>>(`${this.api}/${kind}`, { params: p });
  }
  stats(kind: 'quotations' | 'proformas') { return this.http.get<Record<string, number>>(`${this.api}/${kind}/stats`); }
  invoiceSummary() { return this.http.get<{ invoiceCount: number; creditNoteCount: number; revenueHtMinor: number; vatCollectedMinor: number; revenueTtcMinor: number; unpaidMinor: number }>(`${this.api}/invoices/summary`); }
  get(kind: DocKind, id: string) { return this.http.get<SalesDoc>(`${this.api}/${kind}/${id}`); }
  create(kind: DocKind, body: object) { return this.http.post<SalesDoc>(`${this.api}/${kind}`, body); }
  update(kind: DocKind, id: string, body: object) { return this.http.put<SalesDoc>(`${this.api}/${kind}/${id}`, body); }
  remove(kind: DocKind, id: string) { return this.http.delete<void>(`${this.api}/${kind}/${id}`); }
  action<T = SalesDoc>(kind: DocKind, id: string, action: string, body: object = {}) { return this.http.post<T>(`${this.api}/${kind}/${id}/${action}`, body); }
  quotationActivities(id: string, page: number, kind = '') {
    let p = new HttpParams().set('page', page).set('limit', 15); if (kind) p = p.set('kind', kind);
    return this.http.get<{ items: QuotationActivity[]; total: number; kinds: { value: string; label: string }[] }>(`${this.api}/quotations/${id}/activities`, { params: p });
  }
  quotationVersions(id: string) { return this.http.get<{ items: QuotationVersion[] }>(`${this.api}/quotations/${id}/versions`); }
  quotationVersion(id: string, version: number) { return this.http.get<QuotationVersionView>(`${this.api}/quotations/${id}/versions/${version}`); }
  newQuotationVersion(id: string, body: { validUntil?: string }) { return this.http.post<SalesDoc>(`${this.api}/quotations/${id}/versions`, body); }
  abandonQuotationVersion(id: string) { return this.http.post<SalesDoc>(`${this.api}/quotations/${id}/versions/abandon`, {}); }
  quotationDocuments(id: string) { return this.http.get<{ items: QuotationDocumentDto[] }>(`${this.api}/quotations/${id}/documents`); }
  uploadQuotationDocument(id: string, file: File, d: { type: string; description?: string; version?: number }) {
    const f = new FormData(); f.append('type', d.type); if (d.description) f.append('description', d.description); if (d.version) f.append('version', String(d.version)); f.append('file', file);
    return this.http.post<QuotationDocumentDto>(`${this.api}/quotations/${id}/documents`, f);
  }
  updateQuotationDocument(id: string, docId: string, d: { type?: string; description?: string; version?: number }) { return this.http.put<QuotationDocumentDto>(`${this.api}/quotations/${id}/documents/${docId}`, d); }
  removeQuotationDocument(id: string, docId: string) { return this.http.delete<void>(`${this.api}/quotations/${id}/documents/${docId}`); }
  quotationComments(id: string) { return this.http.get<{ items: QuotationComment[] }>(`${this.api}/quotations/${id}/comments`); }
  addQuotationComment(id: string, body: string) { return this.http.post<QuotationComment>(`${this.api}/quotations/${id}/comments`, { body }); }
  editQuotationComment(id: string, commentId: string, body: string) { return this.http.put<QuotationComment>(`${this.api}/quotations/${id}/comments/${commentId}`, { body }); }
  archiveQuotationComment(id: string, commentId: string) { return this.http.delete<QuotationComment>(`${this.api}/quotations/${id}/comments/${commentId}`); }
  calculate(body: object) { return this.http.post<CalcPreview>(`${this.api}/sales/calculate`, body); }
  sourceLines(type: string, id: string) { return this.http.get<SourceLines>(`${this.api}/delivery-notes/source-lines`, { params: { type, id } }); }
  invoiceFromDeliveryNotes(ids: string[]) { return this.http.post<SalesDoc>(`${this.api}/invoices/from-delivery-notes`, { deliveryNoteIds: ids }); }
  payments(invoiceId: string) { return this.http.get<Page<PaymentDto>>(`${this.api}/invoices/${invoiceId}/payments`); }
  recordPayment(invoiceId: string, body: object) { return this.http.post<{ payment: PaymentDto; invoice: SalesDoc }>(`${this.api}/invoices/${invoiceId}/payments`, body); }
  cancelPayment(id: string, reason: string) { return this.http.post<PaymentDto>(`${this.api}/invoices/payments/${id}/cancel`, { reason }); }
  creditNote(invoiceId: string, reason: string) { return this.http.post<SalesDoc>(`${this.api}/invoices/${invoiceId}/credit-note`, { reason }); }
  customer(id: string) { return this.http.get<Customer2>(`${this.api}/customers/${id}`); }
  products(q: string) { return this.http.get<Page<{ id: string; reference: string; name: string; salePriceMinor: number; vatRateCode: string; unitCode: string | null; kind: string; quantityDecimals?: number }>>(`${this.api}/products`, { params: { q, limit: 10, active: 'true' } }); }
}
