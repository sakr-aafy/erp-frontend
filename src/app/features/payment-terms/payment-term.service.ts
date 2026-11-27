import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PaymentTerm { id: string; label: string; delayDays: number | null; isActive: boolean; isDefault: boolean; partyCount: number; customerCount: number; documentCount: number; used: boolean }

/** Conditions de paiement de la société (liste partagée par les fiches et les documents). */
@Injectable({ providedIn: 'root' })
export class PaymentTermService {
  private http = inject(HttpClient); private url = `${environment.apiUrl}/payment-terms`;
  /** Dernière liste complète chargée. */
  terms = signal<PaymentTerm[]>([]);
  refresh() { return this.http.get<{ items: PaymentTerm[] }>(this.url).pipe(tap((r) => this.terms.set(r.items))); }
  /** Recharge sans bloquer : sans liste, la saisie libre reste disponible. */
  load() { this.refresh().subscribe({ error: () => undefined }); }
  create(d: { label: string; delayDays: number | null }) { return this.http.post<PaymentTerm>(this.url, d); }
  update(id: string, d: { label: string; delayDays: number | null }) { return this.http.put<PaymentTerm>(`${this.url}/${id}`, d); }
  setActive(id: string, active: boolean) { return this.http.post<PaymentTerm>(`${this.url}/${id}/${active ? 'activate' : 'deactivate'}`, {}); }
  setDefault(id: string, isDefault: boolean) { return this.http.post<PaymentTerm>(`${this.url}/${id}/default`, { isDefault }); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
}
