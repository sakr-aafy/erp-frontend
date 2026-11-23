import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Page, RoleDto, UserDto } from '../../shared/models/api.models';

export interface UserQuery { page: number; limit: number; q?: string; status?: string; roleId?: string; sort?: string }
export interface UserInput { name: string; username?: string; email: string; password?: string; roleId: string }

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/users`;
  list(q: UserQuery) {
    let p = new HttpParams().set('page', q.page).set('limit', q.limit);
    for (const k of ['q', 'status', 'roleId', 'sort'] as const) if (q[k]) p = p.set(k, q[k]!);
    return this.http.get<Page<UserDto>>(this.url, { params: p });
  }
  roles() { return this.http.get<RoleDto[]>(`${environment.apiUrl}/roles`); }
  create(d: UserInput) { return this.http.post<UserDto>(this.url, d); }
  update(id: string, d: Partial<UserInput>) { return this.http.put<UserDto>(`${this.url}/${id}`, d); }
  setActive(id: string, isActive: boolean) { return this.http.patch<UserDto>(`${this.url}/${id}/active`, { isActive }); }
  resetPassword(id: string, newPassword: string) { return this.http.post<void>(`${this.url}/${id}/reset-password`, { newPassword }); }
}
