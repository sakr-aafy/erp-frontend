import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReferenceData } from '../../shared/models/api.models';

/** Devise de base + taux de TVA de la société (lecture ouverte à tout utilisateur authentifié). */
@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private http = inject(HttpClient);
  readonly data = signal<ReferenceData | null>(null);
  readonly decimals = computed(() => this.data()?.baseDecimals ?? 3);
  readonly symbol = computed(() => this.data()?.baseSymbol ?? this.data()?.baseCurrency ?? '');
  readonly vatRates = computed(() => this.data()?.vatRates ?? []);

  /** Charge (ou recharge) les données de référence. */
  load$(): Observable<void> {
    return this.http.get<ReferenceData>(`${environment.apiUrl}/settings/reference`).pipe(tap((d) => this.data.set(d)), map(() => undefined));
  }
  reload() { this.load$().subscribe({ error: () => undefined }); }
  clear() { this.data.set(null); }
  /** Montant saisi (unités principales) → entier en plus petite unité. */
  toMinor(major: number | null | undefined, decimals = this.decimals()): number { return Math.round((major ?? 0) * 10 ** decimals); }
  fromMinor(minor: number | null | undefined, decimals = this.decimals()): number { return (minor ?? 0) / 10 ** decimals; }
  /** Précision (décimales) d'une devise configurée. */
  decimalsOf(code: string): number { return this.data()?.currencies.find((c) => c.code === code)?.decimals ?? this.decimals(); }
  format(minor: number | null | undefined): string {
    if (minor == null) return '—';
    return `${this.fromMinor(minor).toLocaleString('fr-FR', { minimumFractionDigits: this.decimals(), maximumFractionDigits: this.decimals() })} ${this.symbol()}`.trim();
  }
}
