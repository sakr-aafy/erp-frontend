import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map, of, switchMap } from 'rxjs';
import { errorMessage } from '../../core/services/api';
import { AuthService } from '../../core/authentication/auth.service';
import { DownloadService } from '../../core/services/download.service';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { prompt } from '../../shared/components/prompt-dialog';
import { Customer2, CustomerStatus } from '../../shared/models/api.models';
import { CustomerService } from './customer.service';
import { STATUS_HELP, STATUS_LABEL } from './customer.labels';

export interface StatusAction { target: CustomerStatus; label: string; icon: string; danger?: boolean }

/** Actions sur un client partagées par la liste et la fiche : statuts, impression, suppression (permissions vérifiées ; le serveur reste l'autorité). */
@Injectable({ providedIn: 'root' })
export class CustomerActions {
  private svc = inject(CustomerService); private dialog = inject(MatDialog); private toast = inject(ToastService); private dl = inject(DownloadService); private auth = inject(AuthService);

  /** Transitions proposées selon le statut courant (un client archivé ne peut être que réactivé). */
  statusActions(c: Customer2): StatusAction[] {
    if (!this.auth.has('customers:update')) return [];
    switch (c.status) {
      case 'active': return [{ target: 'inactive', label: 'Désactiver', icon: 'cancel' }, { target: 'blocked', label: 'Bloquer', icon: 'block', danger: true }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      case 'inactive': return [{ target: 'active', label: 'Activer', icon: 'check_circle' }, { target: 'blocked', label: 'Bloquer', icon: 'block', danger: true }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      case 'blocked': return [{ target: 'active', label: 'Débloquer', icon: 'check_circle' }, { target: 'inactive', label: 'Désactiver', icon: 'cancel' }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      default: return [{ target: 'active', label: 'Réactiver', icon: 'unarchive' }];
    }
  }

  /** Confirme (et demande un motif pour un blocage) puis applique le changement de statut. */
  changeStatus(c: Customer2, a: StatusAction): Observable<Customer2 | null> {
    const ask: Observable<string | null | false> = a.target === 'blocked'
      ? prompt(this.dialog, { title: `Bloquer « ${c.name} »`, label: 'Motif du blocage (impayés, litige…)', confirmLabel: 'Bloquer' }).pipe(map((r) => (r ? r : false)))
      : confirm(this.dialog, { title: `${a.label} le client`, message: `« ${c.name} » passera au statut ${STATUS_LABEL[a.target].toLowerCase()}. ${STATUS_HELP[a.target]}`, confirmLabel: a.label, danger: a.danger }).pipe(map((ok) => (ok ? null : false)));
    return ask.pipe(switchMap((r) => (r === false ? of(null) : this.svc.setStatus(c.id, a.target, r ?? undefined).pipe(map((u) => { this.toast.success(`Statut : ${STATUS_LABEL[a.target]}`); return u; })))));
  }

  print(c: Customer2) { this.dl.openPdf(`/customers/${c.id}/pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }

  remove(c: Customer2): Observable<boolean> {
    return confirm(this.dialog, { title: 'Supprimer le client', message: `Supprimer définitivement « ${c.name} » ? Impossible si le solde n’est pas nul ou si des documents existent (utilisez alors l’archivage).`, confirmLabel: 'Supprimer', danger: true })
      .pipe(switchMap((ok) => (ok ? this.svc.remove(c.id).pipe(map(() => { this.toast.success('Client supprimé'); return true; })) : of(false))));
  }
}
