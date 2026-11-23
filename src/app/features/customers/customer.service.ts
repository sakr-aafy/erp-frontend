import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Customer2, ListResponse } from '../../shared/models/api.models';

export interface CustomerQuery { page: number; limit: number; q?: string; status?: string; debtors?: boolean; sort?: string }

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient); private url = `${environment.apiUrl}/customers`;
  list(q: CustomerQuery) {
    let p = new HttpParams().set('page', q.page).set('limit', q.limit);
    for (const k of ['q', 'status', 'sort'] as const) if (q[k]) p = p.set(k, q[k]!);
    if (q.debtors) p = p.set('debtors', true);
    return this.http.get<ListResponse<Customer2>>(this.url, { params: p });
  }
  get(id: string) { return this.http.get<Customer2>(`${this.url}/${id}`); }
  create(d: object) { return this.http.post<Customer2>(this.url, d); }
  update(id: string, d: object) { return this.http.put<Customer2>(`${this.url}/${id}`, d); }
  archive(id: string) { return this.http.post<Customer2>(`${this.url}/${id}/archive`, {}); }
  reactivate(id: string) { return this.http.post<Customer2>(`${this.url}/${id}/reactivate`, {}); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
}
