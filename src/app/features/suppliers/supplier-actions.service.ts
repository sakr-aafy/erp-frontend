import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { DownloadService } from '../../core/services/download.service';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { prompt } from '../../shared/components/prompt-dialog';
import { SupplierDto, SupplierStatus } from '../../shared/models/api.models';
import { SUPPLIER_STATUS_HELP, SUPPLIER_STATUS_LABEL } from './supplier.labels';
import { SupplierService } from './supplier.service';

export interface SupplierStatusAction { target: SupplierStatus; label: string; icon: string; danger?: boolean }
/** Commande à créer depuis la fiche : commande d'achat (local) ou dossier d'importation (étranger), formulaires existants. */
export interface NewOrderAction { label: string; link: string[]; icon: string }

/** Actions sur un fournisseur partagées par la liste et la fiche (permissions vérifiées ; le serveur reste l'autorité). */
@Injectable({ providedIn: 'root' })
export class SupplierActions {
  private svc = inject(SupplierService); private dialog = inject(MatDialog); private toast = inject(ToastService); private dl = inject(DownloadService); private auth = inject(AuthService);

  newOrder(s: SupplierDto): NewOrderAction | null {
    if (s.status !== 'active' || !s.canOrder) return null;
    if (s.isForeign) return this.auth.has('imports:create') ? { label: 'Nouveau dossier d’importation', link: ['/imports', 'new'], icon: 'flight_land' } : null;
    return this.auth.has('purchases:create') ? { label: 'Nouvelle commande d’achat', link: ['/purchase-orders', 'new'], icon: 'shopping_cart' } : null;
  }

  /** Transitions proposées selon le statut courant (un fournisseur archivé ne peut être que réactivé). */
  statusActions(s: SupplierDto): SupplierStatusAction[] {
    if (!this.auth.has('suppliers:update')) return [];
    switch (s.status) {
      case 'active': return [{ target: 'inactive', label: 'Désactiver', icon: 'cancel' }, { target: 'blocked', label: 'Bloquer', icon: 'block', danger: true }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      case 'inactive': return [{ target: 'active', label: 'Activer', icon: 'check_circle' }, { target: 'blocked', label: 'Bloquer', icon: 'block', danger: true }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      case 'blocked': return [{ target: 'active', label: 'Débloquer', icon: 'check_circle' }, { target: 'inactive', label: 'Désactiver', icon: 'cancel' }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      default: return [{ target: 'active', label: 'Réactiver', icon: 'unarchive' }];
    }
  }

  /** Confirme (et demande un motif pour un blocage) puis applique le changement de statut. */
  changeStatus(s: SupplierDto, a: SupplierStatusAction): Observable<SupplierDto | null> {
    const ask: Observable<string | null | false> = a.target === 'blocked'
      ? prompt(this.dialog, { title: `Bloquer « ${s.name} »`, label: 'Motif du blocage (litige, qualité, retards…)', confirmLabel: 'Bloquer' }).pipe(map((r) => (r ? r : false)))
      : confirm(this.dialog, { title: `${a.label} le fournisseur`, message: `« ${s.name} » passera au statut ${SUPPLIER_STATUS_LABEL[a.target]!.toLowerCase()}. ${SUPPLIER_STATUS_HELP[a.target]}`, confirmLabel: a.label, danger: a.danger }).pipe(map((ok) => (ok ? null : false)));
    return ask.pipe(switchMap((r) => (r === false ? of(null) : this.svc.setStatus(s.id, a.target, r ?? undefined).pipe(map((u) => { this.toast.success(`Statut : ${SUPPLIER_STATUS_LABEL[a.target]}`); return u; })))));
  }

  print(s: Pick<SupplierDto, 'id'>) { this.dl.openPdf(`/suppliers/${s.id}/pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }

  remove(s: SupplierDto): Observable<boolean> {
    return confirm(this.dialog, { title: 'Supprimer le fournisseur', message: `Supprimer définitivement « ${s.name} » ? Impossible si le solde n’est pas nul ou si des achats, importations ou articles l’utilisent (utilisez alors l’archivage).`, confirmLabel: 'Supprimer', danger: true })
      .pipe(switchMap((ok) => (ok ? this.svc.remove(s.id).pipe(map(() => { this.toast.success('Fournisseur supprimé'); return true; })) : of(false))));
  }
}
