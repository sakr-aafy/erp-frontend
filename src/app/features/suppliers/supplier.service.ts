import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ListResponse, SupplierCategoryDto, SupplierDto, SupplierStatus } from '../../shared/models/api.models';
import { SupplierActivityDto, SupplierDocumentDto, SupplierDocuments, SupplierPaymentsView, SupplierSummary, SupplierTx, SupplierTxKind } from './supplier.types';

export interface SupplierQuery { page: number; limit: number; q?: string; supplierId?: string; status?: string; categoryId?: string; country?: string; foreign?: string; withBalance?: boolean; sort?: string }
export interface SupplierTxQuery { page: number; limit: number; type?: SupplierTxKind | ''; status?: string; from?: string; to?: string; q?: string }
export type ContactBody = { name: string; role?: string; phone?: string; email?: string; isPrimary: boolean };

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient); private url = `${environment.apiUrl}/suppliers`; private catUrl = `${environment.apiUrl}/supplier-categories`;
  private params(o: object) { let p = new HttpParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== false && v !== null) p = p.set(k, String(v)); return p; }

  list(q: SupplierQuery) { return this.http.get<ListResponse<SupplierDto>>(this.url, { params: this.params(q) }); }
  countries() { return this.http.get<string[]>(`${this.url}/countries`); }
  get(id: string) { return this.http.get<SupplierDto>(`${this.url}/${id}`); }
  create(d: object) { return this.http.post<SupplierDto>(this.url, d); }
  update(id: string, d: object) { return this.http.put<SupplierDto>(`${this.url}/${id}`, d); }
  setStatus(id: string, status: SupplierStatus, reason?: string) { return this.http.post<SupplierDto>(`${this.url}/${id}/status`, { status, ...(reason && { reason }) }); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }

  summary(id: string) { return this.http.get<SupplierSummary>(`${this.url}/${id}/summary`); }
  transactions(id: string, q: SupplierTxQuery) { return this.http.get<{ items: SupplierTx[]; total: number; allowedKinds: SupplierTxKind[] }>(`${this.url}/${id}/transactions`, { params: this.params(q) }); }
  payments(id: string, page = 1, limit = 20) { return this.http.get<SupplierPaymentsView>(`${this.url}/${id}/payments`, { params: this.params({ page, limit }) }); }

  addContact(id: string, k: ContactBody) { return this.http.post<SupplierDto>(`${this.url}/${id}/contacts`, k); }
  updateContact(id: string, contactId: string, k: Partial<ContactBody>) { return this.http.put<SupplierDto>(`${this.url}/${id}/contacts/${contactId}`, k); }
  setPrimary(id: string, contactId: string) { return this.http.post<SupplierDto>(`${this.url}/${id}/contacts/${contactId}/primary`, {}); }
  removeContact(id: string, contactId: string) { return this.http.delete<SupplierDto>(`${this.url}/${id}/contacts/${contactId}`); }

  documents(id: string) { return this.http.get<SupplierDocuments>(`${this.url}/${id}/documents`); }
  uploadDocument(id: string, file: File, type: string, description?: string) {
    const f = new FormData(); f.append('type', type); if (description) f.append('description', description); f.append('file', file, file.name);
    return this.http.post<SupplierDocumentDto>(`${this.url}/${id}/documents`, f);
  }
  updateDocument(id: string, docId: string, d: { type?: string; description?: string }) { return this.http.put<SupplierDocumentDto>(`${this.url}/${id}/documents/${docId}`, d); }
  removeDocument(id: string, docId: string) { return this.http.delete<void>(`${this.url}/${id}/documents/${docId}`); }

  activities(id: string, page = 1, limit = 20) { return this.http.get<{ items: SupplierActivityDto[]; total: number }>(`${this.url}/${id}/activities`, { params: this.params({ page, limit }) }); }
  addActivity(id: string, d: object) { return this.http.post<SupplierActivityDto>(`${this.url}/${id}/activities`, d); }
  updateActivity(id: string, aid: string, d: object) { return this.http.put<SupplierActivityDto>(`${this.url}/${id}/activities/${aid}`, d); }
  removeActivity(id: string, aid: string) { return this.http.delete<void>(`${this.url}/${id}/activities/${aid}`); }

  // ---- Catégories ----
  categories(q: { q?: string; active?: boolean } = {}) {
    let p = new HttpParams(); if (q.q) p = p.set('q', q.q); if (q.active !== undefined) p = p.set('active', String(q.active));
    return this.http.get<{ items: SupplierCategoryDto[]; unclassifiedCount: number }>(this.catUrl, { params: p });
  }
  createCategory(d: { name: string; description?: string | null }) { return this.http.post<SupplierCategoryDto>(this.catUrl, d); }
  updateCategory(id: string, d: { name?: string; description?: string | null }) { return this.http.put<SupplierCategoryDto>(`${this.catUrl}/${id}`, d); }
  setCategoryActive(id: string, active: boolean) { return this.http.post<SupplierCategoryDto>(`${this.catUrl}/${id}/${active ? 'activate' : 'deactivate'}`, {}); }
  removeCategory(id: string, reassignTo?: string) { return this.http.delete<{ reassigned: number }>(`${this.catUrl}/${id}`, { params: this.params({ reassignTo }) }); }
}
