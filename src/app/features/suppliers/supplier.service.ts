import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupplierDto, ListResponse } from '../../shared/models/api.models';

export interface SupplierQuery { page: number; limit: number; q?: string; status?: string; withBalance?: boolean; sort?: string }

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient); private url = `${environment.apiUrl}/suppliers`;
  list(q: SupplierQuery) {
    let p = new HttpParams().set('page', q.page).set('limit', q.limit);
    for (const k of ['q', 'status', 'sort'] as const) if (q[k]) p = p.set(k, q[k]!);
    if (q.withBalance) p = p.set('withBalance', true);
    return this.http.get<ListResponse<SupplierDto>>(this.url, { params: p });
  }
  get(id: string) { return this.http.get<SupplierDto>(`${this.url}/${id}`); }
  create(d: object) { return this.http.post<SupplierDto>(this.url, d); }
  update(id: string, d: object) { return this.http.put<SupplierDto>(`${this.url}/${id}`, d); }
  archive(id: string) { return this.http.post<SupplierDto>(`${this.url}/${id}/archive`, {}); }
  reactivate(id: string) { return this.http.post<SupplierDto>(`${this.url}/${id}/reactivate`, {}); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
}
