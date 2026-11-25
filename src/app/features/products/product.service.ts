import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CategoryDto, ImportReport, Page, ProductDto, SerialDto, UnitDto } from '../../shared/models/api.models';
import { ActivityDto, DocumentDto, DocumentsView, Paged, PricingPreview, StockTab, TxPage } from './product.types';

export interface ProductQuery {
  page: number; limit: number; q?: string; categoryId?: string; kind?: string; status?: string; supplierId?: string; brand?: string; warehouseId?: string; stockState?: string; belowCost?: boolean; sort?: string;
}
export interface TxQuery { page: number; limit: number; group?: string; type?: string; status?: string; from?: string; to?: string; q?: string; warehouseId?: string }

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient); private api = environment.apiUrl; private url = `${this.api}/products`;
  private params(o: object) { let p = new HttpParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== false && v !== null) p = p.set(k, String(v)); return p; }

  list(q: ProductQuery) { return this.http.get<Page<ProductDto>>(this.url, { params: this.params(q) }); }
  brands() { return this.http.get<string[]>(`${this.url}/brands`); }
  get(id: string) { return this.http.get<ProductDto>(`${this.url}/${id}`); }
  create(d: object) { return this.http.post<ProductDto>(this.url, d); }
  update(id: string, d: object) { return this.http.put<ProductDto>(`${this.url}/${id}`, d); }
  savePackaging(id: string, d: object) { return this.http.put<ProductDto>(`${this.url}/${id}/packaging`, d); }
  savePrices(id: string, d: object) { return this.http.put<ProductDto>(`${this.url}/${id}/prices`, d); }
  saveCustoms(id: string, d: object) { return this.http.put<ProductDto>(`${this.url}/${id}/customs`, d); }
  setStatus(id: string, status: string, reason?: string) { return this.http.post<ProductDto>(`${this.url}/${id}/status`, { status, ...(reason && { reason }) }); }
  setActive(id: string, isActive: boolean) { return this.http.patch<ProductDto>(`${this.url}/${id}/active`, { isActive }); }
  duplicate(id: string, reference: string, name?: string) { return this.http.post<ProductDto>(`${this.url}/${id}/duplicate`, { reference, ...(name && { name }) }); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
  pricingPreview(d: { salePriceMinor: number; costMinor?: number | null; vatRateCode: string }) { return this.http.post<PricingPreview>(`${this.url}/pricing-preview`, d); }
  rate(currency: string) { return this.http.get<{ rate: number; rateDate: string }>(`${this.api}/exchange-rates/resolve`, { params: { currency } }); }

  stock(id: string) { return this.http.get<StockTab>(`${this.url}/${id}/stock`); }
  saveStockSetting(id: string, warehouseId: string, d: { location?: string | null; minQty?: number | null; maxQty?: number | null }) { return this.http.put<StockTab>(`${this.url}/${id}/stock-settings/${warehouseId}`, d); }
  transactions(id: string, q: TxQuery) { return this.http.get<TxPage>(`${this.url}/${id}/transactions`, { params: this.params(q) }); }

  documents(id: string) { return this.http.get<DocumentsView>(`${this.url}/${id}/documents`); }
  uploadDocument(id: string, file: File, type: string, description?: string) {
    const f = new FormData(); f.append('type', type); if (description) f.append('description', description); f.append('file', file, file.name);
    return this.http.post<DocumentDto>(`${this.url}/${id}/documents`, f);
  }
  updateDocument(id: string, docId: string, d: { type?: string; description?: string }) { return this.http.put<DocumentDto>(`${this.url}/${id}/documents/${docId}`, d); }
  setMainPhoto(id: string, docId: string) { return this.http.post<{ mainPhotoId: string }>(`${this.url}/${id}/documents/${docId}/main`, {}); }
  removeDocument(id: string, docId: string) { return this.http.delete<void>(`${this.url}/${id}/documents/${docId}`); }

  activities(id: string, q: { page: number; limit: number; kind?: string; from?: string; to?: string; open?: boolean }) { return this.http.get<Paged<ActivityDto>>(`${this.url}/${id}/activities`, { params: this.params(q) }); }
  addActivity(id: string, d: object) { return this.http.post<ActivityDto>(`${this.url}/${id}/activities`, d); }
  updateActivity(id: string, aid: string, d: object) { return this.http.put<ActivityDto>(`${this.url}/${id}/activities/${aid}`, d); }
  removeActivity(id: string, aid: string) { return this.http.delete<void>(`${this.url}/${id}/activities/${aid}`); }

  serials(id: string, page: number, limit: number, q?: string) {
    let p = new HttpParams().set('page', page).set('limit', limit); if (q) p = p.set('q', q);
    return this.http.get<Page<SerialDto>>(`${this.url}/${id}/serials`, { params: p });
  }
  addSerials(id: string, serials: string[]) { return this.http.post<{ added: number }>(`${this.url}/${id}/serials`, { serials }); }
  removeSerial(id: string, serialId: string) { return this.http.delete<void>(`${this.url}/${id}/serials/${serialId}`); }
  importFile(file: File, mode: string, dryRun: boolean) {
    const f = new FormData(); f.append('file', file);
    return this.http.post<ImportReport>(`${this.url}/import`, f, { params: { mode, dryRun } });
  }
  categories() { return this.http.get<CategoryDto[]>(`${this.api}/product-categories`); }
  createCategory(name: string, parentId?: string) { return this.http.post<CategoryDto>(`${this.api}/product-categories`, { name, parentId: parentId ?? null }); }
  renameCategory(id: string, name: string) { return this.http.put<CategoryDto>(`${this.api}/product-categories/${id}`, { name }); }
  deleteCategory(id: string) { return this.http.delete<void>(`${this.api}/product-categories/${id}`); }
  units() { return this.http.get<UnitDto[]>(`${this.api}/product-units`); }
  createUnit(code: string, name: string) { return this.http.post<UnitDto>(`${this.api}/product-units`, { code, name }); }
  updateUnit(id: string, d: Partial<UnitDto>) { return this.http.put<UnitDto>(`${this.api}/product-units/${id}`, d); }
  deleteUnit(id: string) { return this.http.delete<void>(`${this.api}/product-units/${id}`); }
}

/** Libellés « Famille › Sous-famille » triés pour les listes déroulantes. */
export function categoryOptions(cats: CategoryDto[]): { id: string; label: string }[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  return cats.map((c) => ({ id: c.id, label: c.parentId ? `${byId.get(c.parentId)?.name ?? '?'} › ${c.name}` : c.name })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/** Code technique d'unité (requis et unique côté API), dérivé du nom : sans accents ni espaces, majuscules, suffixe numérique en cas de doublon. */
export function unitCodeFor(name: string, existing: { code: string }[]): string {
  const base = (name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase() || 'U').slice(0, 10);
  const used = new Set(existing.map((u) => u.code.toUpperCase()));
  let code = base; for (let i = 2; used.has(code); i++) code = base.slice(0, 12 - String(i).length) + i;
  return code;
}
