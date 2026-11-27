import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable, filter, map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { DownloadService } from '../../../core/services/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { SalesDoc } from '../sales.models';
import { SalesService } from '../sales.service';
import { QuotationDialog, QuotationDialogData, QuotationDialogMode } from './quotation-dialogs';

export interface QuotationAction { key: string; label: string; icon: string; primary?: boolean; danger?: boolean; run: () => void }

/** Actions d'un devis partagées par la liste et la fiche : le serveur indique ce que le statut permet, les permissions s'ajoutent. */
@Injectable({ providedIn: 'root' })
export class QuotationActions {
  private svc = inject(SalesService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService); private router = inject(Router); private dl = inject(DownloadService);

  print(d: Pick<SalesDoc, 'id'>) { this.dl.openPdf(`/quotations/${d.id}/pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }

  private ask(d: SalesDoc, mode: QuotationDialogMode, submit: QuotationDialogData['submit']): Observable<unknown> {
    const open = (email: string | null) => this.dialog.open(QuotationDialog, { data: { mode, number: d.number!, customerEmail: email, submit }, maxWidth: '96vw' }).afterClosed().pipe(filter(Boolean));
    if (mode !== 'email' || !this.auth.has('customers:view')) return open(null);
    return this.svc.customer(d.customerId).pipe(map((c) => c.email), switchMap(open));
  }

  /** `changed` recharge la vue ; la duplication et la conversion ouvrent le document créé. */
  list(d: SalesDoc, changed: () => void): QuotationAction[] {
    const can = (p: string) => this.auth.has(p); const update = can('quotations:update'); const a = d.actions; const out: QuotationAction[] = [];
    if (!a) return out;
    const done = (msg: string) => () => { this.toast.success(msg); changed(); };
    const fail = (e: unknown) => this.toast.error(errorMessage(e));
    const status = (mode: QuotationDialogMode, action: string, msg: string) => () => this.ask(d, mode, (b) => this.svc.action('quotations', d.id, action, b)).subscribe({ next: done(msg), error: fail });
    const resend = d.status === 'sent';
    if (a.accept && update) out.push({ key: 'accept', label: 'Accepter', icon: 'check_circle', primary: true, run: status('accept', 'accept', 'Devis accepté') });
    if (a.refuse && update) out.push({ key: 'refuse', label: 'Refuser', icon: 'cancel', run: status('refuse', 'refuse', 'Devis refusé') });
    if (a.convertProforma && update && can('proformas:create')) out.push({ key: 'proforma', label: 'Convertir en proforma', icon: 'description', primary: true, run: () =>
      confirm(this.dialog, { title: 'Convertir en proforma', message: `La version ${d.acceptedVersion ?? d.version} acceptée du devis ${d.number} sera reprise dans une facture proforma.`, confirmLabel: 'Convertir' })
        .pipe(filter(Boolean), switchMap(() => this.svc.action<{ proformaId: string }>('quotations', d.id, 'convert-proforma'))).subscribe({ next: (r) => { this.toast.success('Proforma créée'); this.router.navigate(['/proformas', r.proformaId]); }, error: fail }) });
    if (a.edit && update) out.push({ key: 'edit', label: 'Modifier', icon: 'edit', run: () => this.router.navigate(['/quotations', d.id, 'edit']) });
    if (a.send && update) {
      out.push({ key: 'email', label: resend ? 'Renvoyer par e-mail' : 'Envoyer par e-mail', icon: 'mail', primary: d.status === 'draft', run: () => this.ask(d, 'email', (b) => this.svc.action<{ to: string }>('quotations', d.id, 'send', b)).subscribe({ next: (r) => { this.toast.success(`Envoyé à ${(r as { to: string }).to}`); changed(); }, error: fail }) });
      out.push({ key: 'mark-sent', label: resend ? 'Noter un nouvel envoi' : 'Marquer comme envoyé', icon: 'send', run: status('mark-sent', 'mark-sent', 'Devis marqué comme envoyé') });
    }
    if (a.newVersion && update) out.push({ key: 'new-version', label: 'Créer une nouvelle version', icon: 'layers', primary: d.status === 'expired', run: () => this.ask(d, 'new-version', (b) => this.svc.newQuotationVersion(d.id, b)).subscribe({
      next: (r) => { this.toast.success(`Version ${(r as SalesDoc).version} créée : brouillon modifiable`); changed(); this.router.navigate(['/quotations', d.id, 'edit']); }, error: fail }) });
    if (a.abandonVersion && update) out.push({ key: 'abandon', label: 'Abandonner ce brouillon', icon: 'undo', run: () =>
      confirm(this.dialog, { title: 'Abandonner le brouillon', message: `La version ${d.version} en brouillon sera conservée dans les versions et la dernière version transmise redeviendra la version courante.`, confirmLabel: 'Abandonner', danger: true })
        .pipe(filter(Boolean), switchMap(() => this.svc.abandonQuotationVersion(d.id))).subscribe({ next: (r) => { this.toast.success(`Retour à la version ${r.version}`); changed(); }, error: fail }) });
    if (a.duplicate && can('quotations:create')) out.push({ key: 'duplicate', label: 'Dupliquer', icon: 'content_copy', run: () => this.svc.action<SalesDoc>('quotations', d.id, 'duplicate').subscribe({ next: (r) => { this.toast.success('Devis dupliqué'); this.router.navigate(['/quotations', r.id, 'edit']); }, error: fail }) });
    if (a.remove && can('quotations:delete')) out.push({ key: 'delete', label: 'Supprimer', icon: 'delete', danger: true, run: () => confirm(this.dialog, { title: 'Supprimer', message: `Supprimer définitivement le devis ${d.number} ?`, confirmLabel: 'Supprimer', danger: true })
      .pipe(filter(Boolean), switchMap(() => this.svc.remove('quotations', d.id))).subscribe({ next: () => { this.toast.success('Document supprimé'); if (this.router.url.startsWith(`/quotations/${d.id}`)) this.router.navigateByUrl('/quotations'); else changed(); }, error: fail }) });
    return out;
  }
}
