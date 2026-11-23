import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { RoleDto } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private http = inject(HttpClient); private url = `${environment.apiUrl}/roles`;
  list() { return this.http.get<RoleDto[]>(this.url); }
  get(id: string) { return this.http.get<RoleDto>(`${this.url}/${id}`); }
  catalog() { return this.http.get<{ modules: string[]; actions: string[] }>(`${this.url}/catalog`); }
  create(d: Partial<RoleDto>) { return this.http.post<RoleDto>(this.url, d); }
  update(id: string, d: Partial<RoleDto>) { return this.http.put<RoleDto>(`${this.url}/${id}`, d); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
}
