import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export type RuleKind = 'vat' | 'withholding' | 'stamp';
export interface FiscalRule {
  id: string; kind: RuleKind; code: string; label: string | null; effectiveFrom: string; status: 'draft' | 'validated'; active: boolean; legalReference: string | null; isCurrent: boolean;
  vat: { regime: 'taxable' | 'zero' | 'exempt' | 'suspended'; ratePct: number } | null;
  withholding: { ratePct: number; base: 'ht' | 'ttc'; minTotalMinor?: number | null; requireCustomerFlag: boolean } | null;
  stamp: { amountMinor: number; docTypes: string[]; minTotalMinor?: number | null; exemptCustomerFlag: boolean } | null;
}

@Injectable({ providedIn: 'root' })
export class FiscalService {
  private http = inject(HttpClient); private url = `${environment.apiUrl}/fiscal`;
  rules(kind: RuleKind) { return this.http.get<FiscalRule[]>(`${this.url}/rules`, { params: { kind } }); }
  create(body: object) { return this.http.post<FiscalRule>(`${this.url}/rules`, body); }
  update(id: string, body: object) { return this.http.put<FiscalRule>(`${this.url}/rules/${id}`, body); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/rules/${id}`); }
  validate(id: string) { return this.http.post<FiscalRule>(`${this.url}/rules/${id}/validate`, {}); }
  vatTemplate(effectiveFrom: string) { return this.http.post<FiscalRule[]>(`${this.url}/templates/vat`, { effectiveFrom }); }
  withholdingTypes() { return this.http.get<{ code: string; label: string | null; ratePct: number; base: string }[]>(`${this.url}/withholding-types`); }
}
