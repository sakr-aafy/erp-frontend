import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable, filter, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { DownloadService } from '../../../core/services/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { SalesDoc } from '../sales.models';
import { SalesService } from '../sales.service';
import { QuotationDialog, QuotationDialogData, QuotationDialogMode } from './quotation-dialogs';

export interface QuotationAction { key: string; label: string; icon: string; primary?: boolean; danger?: boolean; run: () => void }

/** Actions d'un devis partagées par la liste et la fiche (permissions et statut ; le serveur reste l'autorité). */
@Injectable({ providedIn: 'root' })
export class QuotationActions {
  private svc = inject(SalesService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService); private router = inject(Router); private dl = inject(DownloadService);

  print(d: Pick<SalesDoc, 'id'>) { this.dl.openPdf(`/quotations/${d.id}/pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }

  private ask(d: SalesDoc, mode: QuotationDialogMode, submit: QuotationDialogData['submit']): Observable<unknown> {
    const open = (email: string | null) => this.dialog.open(QuotationDialog, { data: { mode, number: d.number!, customerEmail: email, submit }, maxWidth: '96vw' }).afterClosed().pipe(filter(Boolean));
    if (mode !== 'email' || !this.auth.has('customers:view')) return open(null);
    return this.svc.customer(d.customerId).pipe(map((c) => c.email), switchMap(open));
  }

  /**
   * Actions disponibles selon le statut et les permissions. `changed` recharge la vue ; les conversions et la duplication
   * ouvrent le document créé.
   */
  list(d: SalesDoc, changed: () => void): QuotationAction[] {
    const can = (p: string) => this.auth.has(p); const update = can('quotations:update'); const out: QuotationAction[] = [];
    const open = d.status === 'pending' || d.status === 'sent'; const unconverted = !d.proformaId && !d.invoiceId;
    const done = (msg: string) => () => { this.toast.success(msg); changed(); };
    const fail = (e: unknown) => this.toast.error(errorMessage(e));
    const status = (mode: QuotationDialogMode, action: string, msg: string) => () => this.ask(d, mode, (b) => this.svc.action('quotations', d.id, action, b)).subscribe({ next: done(msg), error: fail });
    if (open && update) out.push({ key: 'accept', label: 'Accepter', icon: 'check_circle', primary: true, run: status('accept', 'accept', 'Devis accepté') });
    if (open && update) out.push({ key: 'refuse', label: 'Refuser', icon: 'cancel', run: status('refuse', 'refuse', 'Devis refusé') });
    if (update && d.status !== 'expired' && d.status !== 'refused') out.push({ key: 'email', label: 'Envoyer par e-mail', icon: 'mail', run: () => this.ask(d, 'email', (b) => this.svc.action<{ to: string }>('quotations', d.id, 'send', b)).subscribe({ next: (r) => { this.toast.success(`Envoyé à ${(r as { to: string }).to}`); changed(); }, error: fail }) });
    if (d.status === 'pending' && update) out.push({ key: 'mark-sent', label: 'Marquer comme envoyé', icon: 'send', run: status('mark-sent', 'mark-sent', 'Devis marqué comme envoyé') });
    if (d.editable && update) out.push({ key: 'edit', label: 'Modifier', icon: 'edit', run: () => this.router.navigate(['/quotations', d.id, 'edit']) });
    if (can('quotations:create')) out.push({ key: 'duplicate', label: 'Dupliquer', icon: 'content_copy', run: () => this.svc.action<SalesDoc>('quotations', d.id, 'duplicate').subscribe({ next: (r) => { this.toast.success('Devis dupliqué'); this.router.navigate(['/quotations', r.id, 'edit']); }, error: fail }) });
    if ((open || d.status === 'accepted') && unconverted && update) {
      const convert = (action: string, route: string, key: 'proformaId' | 'invoiceId', msg: string) => () =>
        (d.status === 'accepted' ? of(true) : confirm(this.dialog, { title: msg.startsWith('Proforma') ? 'Convertir en proforma' : 'Convertir en facture', message: 'La conversion vaut acceptation du devis par le client.', confirmLabel: 'Convertir' }))
          .pipe(filter(Boolean), switchMap(() => this.svc.action<Record<string, string>>('quotations', d.id, action))).subscribe({ next: (r) => { this.toast.success(msg); this.router.navigate([route, r[key]]); }, error: fail });
      if (can('proformas:create')) out.push({ key: 'proforma', label: 'Convertir en proforma', icon: 'description', run: convert('convert-proforma', '/proformas', 'proformaId', 'Proforma créée') });
      if (can('invoices:create')) out.push({ key: 'invoice', label: 'Convertir en facture', icon: 'receipt', run: convert('convert-invoice', '/invoices', 'invoiceId', 'Facture brouillon créée') });
    }
    if (d.status === 'accepted' && unconverted && can('deliveryNotes:create')) out.push({ key: 'delivery', label: 'Créer un BL', icon: 'local_shipping', run: () => this.router.navigate(['/delivery-notes/new'], { queryParams: { sourceType: 'quotation', sourceId: d.id } }) });
    if (d.status === 'pending' && unconverted && can('quotations:delete')) out.push({ key: 'delete', label: 'Supprimer', icon: 'delete', danger: true, run: () => confirm(this.dialog, { title: 'Supprimer', message: `Supprimer définitivement le devis ${d.number} ?`, confirmLabel: 'Supprimer', danger: true })
      .pipe(filter(Boolean), switchMap(() => this.svc.remove('quotations', d.id))).subscribe({ next: () => { this.toast.success('Document supprimé'); if (this.router.url.startsWith(`/quotations/${d.id}`)) this.router.navigateByUrl('/quotations'); else changed(); }, error: fail }) });
    return out;
  }
}
