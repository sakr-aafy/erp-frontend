import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/api.models';
import { CalcPreview, DocKind, PaymentDto, SalesDoc, SourceLines } from './sales.models';

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
  calculate(body: object) { return this.http.post<CalcPreview>(`${this.api}/sales/calculate`, body); }
  sourceLines(type: string, id: string) { return this.http.get<SourceLines>(`${this.api}/delivery-notes/source-lines`, { params: { type, id } }); }
  invoiceFromDeliveryNotes(ids: string[]) { return this.http.post<SalesDoc>(`${this.api}/invoices/from-delivery-notes`, { deliveryNoteIds: ids }); }
  payments(invoiceId: string) { return this.http.get<Page<PaymentDto>>(`${this.api}/invoices/${invoiceId}/payments`); }
  recordPayment(invoiceId: string, body: object) { return this.http.post<{ payment: PaymentDto; invoice: SalesDoc }>(`${this.api}/invoices/${invoiceId}/payments`, body); }
  cancelPayment(id: string, reason: string) { return this.http.post<PaymentDto>(`${this.api}/invoices/payments/${id}/cancel`, { reason }); }
  creditNote(invoiceId: string, reason: string) { return this.http.post<SalesDoc>(`${this.api}/invoices/${invoiceId}/credit-note`, { reason }); }
  customer(id: string) { return this.http.get<{ id: string; name: string; taxId: string | null; paymentDelayDays: number }>(`${this.api}/customers/${id}`); }
  customers(q: string) { return this.http.get<Page<{ id: string; name: string; taxId: string | null; paymentDelayDays: number }>>(`${this.api}/customers`, { params: { q, limit: 10, status: 'active' } }); }
  products(q: string) { return this.http.get<Page<{ id: string; reference: string; name: string; salePriceMinor: number; vatRateCode: string; unitCode: string | null; kind: string }>>(`${this.api}/products`, { params: { q, limit: 10, active: 'true' } }); }
}
