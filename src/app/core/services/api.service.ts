import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export type Params = Record<string, string | number | boolean | undefined | null>;
const toParams = (p?: Params) => { let h = new HttpParams(); for (const [k, v] of Object.entries(p ?? {})) if (v !== undefined && v !== null && v !== '' && v !== false) h = h.set(k, String(v)); return h; };

/** Accès HTTP générique à l'API (préfixe /api/v1) pour les écrans de logistique. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient); private base = environment.apiUrl;
  get<T = any>(path: string, params?: Params) { return this.http.get<T>(`${this.base}${path}`, { params: toParams(params) }); }  
  post<T = any>(path: string, body: object = {}, params?: Params) { return this.http.post<T>(`${this.base}${path}`, body, { params: toParams(params) }); }  
  put<T = any>(path: string, body: object = {}) { return this.http.put<T>(`${this.base}${path}`, body); }  
  patch<T = any>(path: string, body: object = {}) { return this.http.patch<T>(`${this.base}${path}`, body); }  
  delete<T = void>(path: string) { return this.http.delete<T>(`${this.base}${path}`); }
  upload<T = any>(path: string, file: File) { const f = new FormData(); f.append('file', file); return this.http.post<T>(`${this.base}${path}`, f); }  
}
