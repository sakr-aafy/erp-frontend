import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Customer2, CustomerStatus, ListResponse } from '../../shared/models/api.models';
import { ActivityDto, ContactInput, CustomerSummary, DocKind, DocumentDto, PaymentsView, TxPage } from './customer.types';

export interface CustomerQuery { page: number; limit: number; q?: string; status?: string; type?: string; city?: string; debtors?: boolean; sort?: string }
export interface TxQuery { page: number; limit: number; type?: DocKind | ''; status?: string; from?: string; to?: string; q?: string }

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient); private url = `${environment.apiUrl}/customers`;
  private params(o: object) { let p = new HttpParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== false && v !== null) p = p.set(k, String(v)); return p; }

  list(q: CustomerQuery) { return this.http.get<ListResponse<Customer2>>(this.url, { params: this.params(q) }); }
  cities() { return this.http.get<string[]>(`${this.url}/cities`); }
  get(id: string) { return this.http.get<Customer2>(`${this.url}/${id}`); }
  create(d: object) { return this.http.post<Customer2>(this.url, d); }
  update(id: string, d: object) { return this.http.put<Customer2>(`${this.url}/${id}`, d); }
  setStatus(id: string, status: CustomerStatus, reason?: string) { return this.http.post<Customer2>(`${this.url}/${id}/status`, { status, ...(reason && { reason }) }); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }

  summary(id: string) { return this.http.get<CustomerSummary>(`${this.url}/${id}/summary`); }
  transactions(id: string, q: TxQuery) { return this.http.get<TxPage>(`${this.url}/${id}/transactions`, { params: this.params(q) }); }
  payments(id: string, page = 1, limit = 20) { return this.http.get<PaymentsView>(`${this.url}/${id}/payments`, { params: this.params({ page, limit }) }); }

  addContact(id: string, k: ContactInput) { return this.http.post<Customer2>(`${this.url}/${id}/contacts`, k); }
  updateContact(id: string, contactId: string, k: Partial<ContactInput>) { return this.http.put<Customer2>(`${this.url}/${id}/contacts/${contactId}`, k); }
  setPrimary(id: string, contactId: string) { return this.http.post<Customer2>(`${this.url}/${id}/contacts/${contactId}/primary`, {}); }
  removeContact(id: string, contactId: string) { return this.http.delete<Customer2>(`${this.url}/${id}/contacts/${contactId}`); }

  documents(id: string) { return this.http.get<DocumentDto[]>(`${this.url}/${id}/documents`); }
  uploadDocument(id: string, file: File, type: string, description?: string) {
    const f = new FormData(); f.append('type', type); if (description) f.append('description', description); f.append('file', file, file.name);
    return this.http.post<DocumentDto>(`${this.url}/${id}/documents`, f);
  }
  updateDocument(id: string, docId: string, d: { type?: string; description?: string }) { return this.http.put<DocumentDto>(`${this.url}/${id}/documents/${docId}`, d); }
  removeDocument(id: string, docId: string) { return this.http.delete<void>(`${this.url}/${id}/documents/${docId}`); }

  activities(id: string, page = 1, limit = 20, kind?: string) { return this.http.get<{ items: ActivityDto[]; total: number; page: number; limit: number }>(`${this.url}/${id}/activities`, { params: this.params({ page, limit, kind }) }); }
  addActivity(id: string, d: { kind: string; title: string; description?: string; occurredAt?: string }) { return this.http.post<ActivityDto>(`${this.url}/${id}/activities`, d); }
  updateActivity(id: string, aid: string, d: object) { return this.http.put<ActivityDto>(`${this.url}/${id}/activities/${aid}`, d); }
  removeActivity(id: string, aid: string) { return this.http.delete<void>(`${this.url}/${id}/activities/${aid}`); }
}
