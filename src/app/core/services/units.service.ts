import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { MAX_DECIMALS } from '../../shared/utils/quantity';

export interface UnitDto { id: string; code: string; name: string; fixed: boolean; fixedKey: string | null; decimals: number }

/** Unités de la société : précision des quantités à partir du code porté par une ligne de document. */
@Injectable({ providedIn: 'root' })
export class UnitsService {
  private http = inject(HttpClient);
  units = signal<UnitDto[]>([]);
  load(done?: () => void) { this.http.get<UnitDto[]>(`${environment.apiUrl}/product-units`).subscribe({ next: (u) => { this.units.set(u); done?.(); }, error: () => undefined }); }
  decimalsOf(code: string | null | undefined): number {
    const u = this.units().find((x) => x.code.toLowerCase() === (code ?? '').toLowerCase());
    return u?.decimals ?? MAX_DECIMALS; // unité inconnue : le serveur tranche
  }
}
