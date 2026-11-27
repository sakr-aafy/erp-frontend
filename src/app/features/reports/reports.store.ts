import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '../../core/services/api.service';

export type ColType = 'text' | 'money' | 'qty' | 'int' | 'date' | 'pct';
export interface ReportCol { key: string; label: string; type?: ColType }
export interface ReportMeta { key: string; title: string; description: string; filters: string[]; statusOptions: { value: string; label: string }[] | null; columns: ReportCol[] }
export interface ReportGroup { group: string; label: string; reports: ReportMeta[] }

export const PERIOD_PRESETS = [
  { value: 'month', label: 'Ce mois' }, { value: 'lastMonth', label: 'Mois précédent' }, { value: 'last30', label: '30 derniers jours' }, { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' }, { value: 'lastYear', label: 'Année précédente' }, { value: 'all', label: 'Toute la période' }, { value: 'custom', label: 'Personnalisée' },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Bornes (AAAA-MM-JJ) d'une période prédéfinie, en heure locale de l'utilisateur. */
export function presetRange(p: string, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear(); const m = now.getMonth();
  switch (p) {
    case 'month': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'lastMonth': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'last30': return { from: iso(new Date(y, m, now.getDate() - 29)), to: iso(now) };
    case 'quarter': { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) }; }
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'lastYear': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: '', to: '' };
  }
}
export const GROUP_BY_OPTIONS = [{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }, { value: 'quarter', label: 'Trimestre' }, { value: 'year', label: 'Année' }];
export const REASON_OPTIONS = [{ value: 'receipt', label: 'Réception' }, { value: 'import', label: 'Importation' }, { value: 'delivery', label: 'Livraison' }, { value: 'delivery_cancel', label: 'Annulation de livraison' }, { value: 'transfer_out', label: 'Transfert (sortie)' },
  { value: 'transfer_in', label: 'Transfert (entrée)' }, { value: 'inventory_in', label: 'Inventaire (entrée)' }, { value: 'inventory_out', label: 'Inventaire (sortie)' }, { value: 'manual_in', label: 'Entrée manuelle' }, { value: 'manual_out', label: 'Sortie manuelle' }, { value: 'customer_return', label: 'Retour client' }];

/** Catalogue des rapports accessibles à l'utilisateur (filtré par le serveur selon les permissions). */
@Injectable({ providedIn: 'root' })
export class ReportsStore {
  private api = inject(Api);
  catalog = signal<ReportGroup[] | null>(null);
  load() { return this.api.get<ReportGroup[]>('/reports/catalog').pipe(tap((c) => this.catalog.set(c))); }
  find = (key: string) => this.catalog()?.flatMap((g) => g.reports).find((r) => r.key === key);
}
