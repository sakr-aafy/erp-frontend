import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { errorMessage } from '../../../core/services/api';
import { DownloadService } from '../../../core/services/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { QuotationVersion, QuotationVersionView } from '../sales.models';
import { SalesService } from '../sales.service';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';

const CHIP: Record<string, string> = { draft: 'warn', sent: 'info', accepted: 'solid', refused: 'danger', expired: 'off', cancelled: 'off', superseded: 'off', abandoned: 'off' };

/** Consultation d'une version figée : le contenu vient de sa copie, jamais des référentiels actuels. */
@Component({
  selector: 'app-quotation-version-dialog',
  imports: [QtyPipe, DatePipe, MatDialogModule, MatButtonModule, MoneyPipe],
  template: `
    <h2 mat-dialog-title>{{ data.number }} — Version {{ v.version }} <span class="muted">({{ v.statusLabel }})</span></h2>
    <mat-dialog-content class="body">
      @if (v.origin === 'migration') {<p class="note" role="note">Copie de référence de l’état du devis à la date de sa reprise. Les modifications antérieures ne sont pas reconstituées.</p>}
      <div class="cols">
        <div><h3>Client</h3><strong>{{ c.customer.name }}</strong>@if (c.customer.taxId) {<span>MF : {{ c.customer.taxId }}</span>}</div>
        <div><h3>Dates</h3><span>Devis du {{ c.issueDate | date: 'dd/MM/yyyy' : 'UTC' }}</span><span>Valable jusqu’au {{ c.validUntil | date: 'dd/MM/yyyy' : 'UTC' }}</span></div>
        <div><h3>Conditions</h3><span>Paiement : {{ c.paymentTerms || 'non précisé' }}</span><span>Délai de livraison : {{ c.deliveryTime || 'non précisé' }}</span></div>
        @if (c.deliveryAddress; as a) {<div><h3>Livraison</h3><strong>{{ a.label }}</strong><span>{{ a.street }} {{ a.city }}</span></div>}
      </div>
      <div class="table-wrap"><table class="lines"><thead><tr><th>Pos.</th><th>Référence</th><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. HT</th><th class="r">Rem.%</th><th class="r">TVA</th><th class="r">Total HT</th></tr></thead>
        <tbody>@for (l of c.lines; track l.id) {<tr><td>{{ l.position }}</td><td>{{ l.reference || '—' }}</td><td>{{ l.designation }}</td><td class="r">{{ l.quantity | qty }} {{ l.unit }}</td><td class="r">{{ l.unitPriceMinor | money }}</td><td class="r">{{ l.discountPct ? (l.discountPct | qty) + ' %' : '—' }}</td><td class="r">{{ l.vat.regime === 'taxable' ? l.vat.ratePct + ' %' : '0 %' }}</td><td class="r">{{ l.netHtMinor | money }}</td></tr>}</tbody></table></div>
      <dl class="totals">
        @if (c.totals.lineDiscountsMinor) {<dt>Remises sur les lignes</dt><dd>- {{ c.totals.lineDiscountsMinor | money }}</dd>}
        @if (c.totals.globalDiscountMinor) {<dt>{{ c.globalDiscountPct ? 'Remise globale (' + (c.globalDiscountPct | qty) + ' %)' : 'Remise supplémentaire' }}</dt><dd>- {{ c.totals.globalDiscountMinor | money }}</dd>}
        <dt>Total HT</dt><dd><strong>{{ c.totals.totalHtMinor | money }}</strong></dd><dt>Total TVA</dt><dd>{{ c.totals.totalVatMinor | money }}</dd><dt>Total TTC</dt><dd><strong>{{ c.totals.totalTtcMinor | money }}</strong></dd></dl>
      @if (c.notes) {<p class="pre">{{ c.notes }}</p>}@if (c.terms) {<p class="pre muted">Conditions : {{ c.terms }}</p>}
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-flat-button color="primary" mat-dialog-close>Fermer</button></mat-dialog-actions>`,
  styles: `.body{width:min(860px,90vw)}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:12px}.cols div{display:flex;flex-direction:column;gap:2px;overflow-wrap:anywhere}h3{margin:0 0 4px;font-size:13px;color:var(--muted)}
    .lines{width:100%;min-width:640px;border-collapse:collapse}.lines th,.lines td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:left;font-size:13px}.r{text-align:right!important;white-space:nowrap}.totals{display:grid;grid-template-columns:auto auto;justify-content:end;gap:4px 24px;margin:12px 0}.totals dd{margin:0;text-align:right}.pre{white-space:pre-wrap}.note{padding:8px 12px;border-radius:var(--r-md);background:var(--accent-50);border:1px solid var(--accent-300)}`,
})
export class QuotationVersionDialog {
  data = inject<{ number: string; view: QuotationVersionView }>(MAT_DIALOG_DATA); v = this.data.view; c = this.v.content;
}

/** Onglet Versions : toutes les versions du devis, la plus récente d'abord ; consultation et PDF de chacune. */
@Component({
  selector: 'app-quotation-versions',
  imports: [DatePipe, MatButtonModule, Icon, Skeleton, MoneyPipe],
  template: `
    @if (!items()) {<div class="card"><app-skeleton /></div>}
    @else {
      <div class="list">@for (v of items(); track v.version) {
        <article class="card v" [class.current]="v.current">
          <div class="num"><strong>Version {{ v.version }}</strong>
            <span class="chip {{ chip(v.status) }}">{{ v.statusLabel }}</span>
            @if (v.current) {<span class="chip solid">Version actuelle</span>}@if (v.accepted) {<span class="chip ok">Acceptée par le client</span>}</div>
          <dl><div><dt>Créée le</dt><dd>{{ v.createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd></div><div><dt>Auteur</dt><dd>{{ v.author ?? '—' }}</dd></div>
            <div><dt>Envoyée le</dt><dd>{{ v.sentAt ? (v.sentAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</dd></div>
            <div><dt>Montant HT</dt><dd>{{ v.totalHtMinor | money }}</dd></div><div><dt>Montant TTC</dt><dd><strong>{{ v.totalTtcMinor | money }}</strong></dd></div></dl>
          @if (v.origin === 'migration') {<p class="muted small">Copie de référence créée à la reprise des données (pas un historique complet).</p>}
          <div class="acts">
            <button mat-stroked-button type="button" (click)="view(v)" [attr.aria-label]="'Consulter la version ' + v.version"><app-icon name="visibility" />Consulter</button>
            <button mat-stroked-button type="button" (click)="print(v)" [attr.aria-label]="'Imprimer la version ' + v.version"><app-icon name="print" />Imprimer</button>
            <button mat-stroked-button type="button" (click)="download(v)" [attr.aria-label]="'Télécharger la version ' + v.version"><app-icon name="download" />Télécharger</button>
          </div>
        </article>}</div>
      <p class="muted small">Un brouillon se modifie sur place. Chaque envoi fige sa version : elle n’est plus modifiée ni supprimée.</p>
    }`,
  styles: `.list{display:flex;flex-direction:column;gap:12px}.v{display:flex;flex-direction:column;gap:10px}.v.current{border-left:3px solid var(--accent)}.num{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.num strong{font-size:16px}
    dl{display:flex;flex-wrap:wrap;gap:10px 28px;margin:0}dt{font-size:12px;color:var(--muted)}dd{margin:0;font-variant-numeric:tabular-nums}.acts{display:flex;gap:8px;flex-wrap:wrap}.small{font-size:12px;margin:8px 0 0}`,
})
export class QuotationVersionsTab {
  id = input.required<string>(); number = input.required<string>();
  private svc = inject(SalesService); private toast = inject(ToastService); private dialog = inject(MatDialog); private dl = inject(DownloadService);
  items = signal<QuotationVersion[] | null>(null); chip = (s: string) => CHIP[s] ?? 'off';
  ngOnInit() { this.svc.quotationVersions(this.id()).subscribe({ next: (r) => this.items.set(r.items), error: (e) => { this.toast.error(errorMessage(e)); this.items.set([]); } }); }
  private path = (v: QuotationVersion) => `/quotations/${this.id()}/versions/${v.version}/pdf`;
  view(v: QuotationVersion) { this.svc.quotationVersion(this.id(), v.version).subscribe({ next: (view) => this.dialog.open(QuotationVersionDialog, { data: { number: this.number(), view }, maxWidth: '96vw' }), error: (e) => this.toast.error(errorMessage(e)) }); }
  print(v: QuotationVersion) { this.dl.openPdf(this.path(v)).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  download(v: QuotationVersion) { this.dl.save(this.path(v), {}, `${this.number()}-v${v.version}.pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
}
