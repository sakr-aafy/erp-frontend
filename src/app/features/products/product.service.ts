import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CategoryDto, ImportReport, Page, ProductDto, SerialDto, UnitDto } from '../../shared/models/api.models';

export interface ProductQuery { page: number; limit: number; q?: string; categoryId?: string; kind?: string; active?: string; belowCost?: boolean; sort?: string }

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient); private api = environment.apiUrl; private url = `${this.api}/products`;
  list(q: ProductQuery) {
    let p = new HttpParams().set('page', q.page).set('limit', q.limit);
    for (const k of ['q', 'categoryId', 'kind', 'active', 'sort'] as const) if (q[k]) p = p.set(k, q[k]!);
    if (q.belowCost) p = p.set('belowCost', true);
    return this.http.get<Page<ProductDto>>(this.url, { params: p });
  }
  get(id: string) { return this.http.get<ProductDto>(`${this.url}/${id}`); }
  create(d: object) { return this.http.post<ProductDto>(this.url, d); }
  update(id: string, d: object) { return this.http.put<ProductDto>(`${this.url}/${id}`, d); }
  setActive(id: string, isActive: boolean) { return this.http.patch<ProductDto>(`${this.url}/${id}/active`, { isActive }); }
  duplicate(id: string, reference: string, name?: string) { return this.http.post<ProductDto>(`${this.url}/${id}/duplicate`, { reference, ...(name && { name }) }); }
  remove(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
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
