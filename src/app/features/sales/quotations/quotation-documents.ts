import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { DownloadService } from '../../../core/services/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { openDocumentDialog } from '../../customers/customer-dialogs';
import { formatBytes } from '../../customers/customer.labels';
import { QUOTATION_DOC_TYPES, QuotationDocumentDto } from '../sales.models';
import { SalesService } from '../sales.service';

/** Onglet Documents : pièces jointes réelles du devis. Une pièce liée à une version transmise ou à un devis accepté est conservée. */
@Component({
  selector: 'app-quotation-documents',
  imports: [DatePipe, MatButtonModule, Icon, EmptyState, Skeleton],
  template: `
    <div class="top"><h2>Documents du devis</h2>@if (canEdit) {<button mat-flat-button color="primary" type="button" (click)="add()"><app-icon name="upload" />Ajouter un document</button>}</div>
    @if (!docs()) {<div class="card"><app-skeleton /></div>}
    @else if (!docs()!.length) {<div class="card"><app-empty-state icon="folder" message="Aucun document : demande de prix, cahier des charges, fiche technique, plan, devis signé, confirmation du client…" /></div>}
    @else {<div class="list">@for (d of docs(); track d.id) {
      <article class="card d">
        <span class="ico"><app-icon name="attach_file" /></span>
        <div class="body"><strong class="nm">{{ d.name }}</strong>
          <span class="tags"><span class="chip ok">{{ d.typeLabel }}</span>@if (d.version) {<span class="chip off">Version {{ d.version }}</span>}</span>
          @if (d.description) {<span class="muted">{{ d.description }}</span>}
          <span class="muted meta">{{ size(d.size) }} · ajouté le {{ d.uploadedAt | date: 'dd/MM/yyyy HH:mm' }}@if (d.uploadedBy) { par {{ d.uploadedBy }}}</span>
          @if (d.lockedReason && canEdit) {<span class="muted meta">{{ d.lockedReason }}</span>}</div>
        <div class="acts">
          @if (d.previewable) {<button mat-icon-button type="button" (click)="view(d)" [attr.aria-label]="'Prévisualiser ' + d.name" title="Prévisualiser"><app-icon name="visibility" /></button>}
          <button mat-icon-button type="button" (click)="download(d)" [attr.aria-label]="'Télécharger ' + d.name" title="Télécharger"><app-icon name="download" /></button>
          @if (canEdit) {<button mat-icon-button type="button" (click)="edit(d)" [attr.aria-label]="'Modifier ' + d.name" title="Modifier les informations"><app-icon name="edit" /></button>
            @if (!d.lockedReason) {<button mat-icon-button type="button" class="del" (click)="remove(d)" [attr.aria-label]="'Supprimer ' + d.name" title="Supprimer"><app-icon name="delete" /></button>}}
        </div>
      </article>}</div>}
    <p class="muted small">PDF, images, DOCX ou XLSX — 10 Mo maximum par fichier. Les documents ne sont pas joints aux e-mails.</p>`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.list{display:flex;flex-direction:column;gap:10px}
    .d{display:flex;align-items:center;gap:14px;padding:14px 16px}.ico{display:grid;place-items:center;width:42px;height:42px;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);flex:none}
    .body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}.nm{overflow-wrap:anywhere}.tags{display:flex;gap:6px;flex-wrap:wrap}.meta{font-size:12px}.acts{display:flex;gap:2px;flex:none}.acts button{color:var(--muted)}.acts button:hover{color:var(--brand)}.acts .del:hover{color:var(--danger)}
    .small{font-size:12px;margin-top:12px}@media (max-width:560px){.d{flex-wrap:wrap}.acts{width:100%;justify-content:flex-end}}`,
})
export class QuotationDocumentsTab {
  id = input.required<string>(); version = input(1); changed = output<void>();
  private svc = inject(SalesService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService); private dl = inject(DownloadService);
  docs = signal<QuotationDocumentDto[] | null>(null); size = formatBytes; canEdit = this.auth.has('quotations:update');
  ngOnInit() { this.load(); }
  load() { this.svc.quotationDocuments(this.id()).subscribe({ next: (d) => this.docs.set(d.items), error: (e) => { this.toast.error(errorMessage(e)); this.docs.set([]); } }); }
  private versions = () => Array.from({ length: this.version() }, (_, i) => i + 1);
  private path = (d: QuotationDocumentDto) => `/quotations/${this.id()}/documents/${d.id}/file`;
  view(d: QuotationDocumentDto) { this.dl.open(this.path(d), { disposition: 'inline' }).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  download(d: QuotationDocumentDto) { this.dl.save(this.path(d), {}, d.name).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  add() {
    openDocumentDialog(this.dialog, { types: QUOTATION_DOC_TYPES, versions: this.versions(), submit: (v) => this.svc.uploadQuotationDocument(this.id(), v.file!, v) })
      .subscribe((r) => { if (r) { this.toast.success('Document ajouté'); this.load(); this.changed.emit(); } });
  }
  edit(d: QuotationDocumentDto) {
    openDocumentDialog(this.dialog, { document: d, types: QUOTATION_DOC_TYPES, ...(!d.lockedReason && { versions: this.versions(), version: d.version }), submit: (v) => this.svc.updateQuotationDocument(this.id(), d.id, { type: v.type, description: v.description, ...(v.version && { version: v.version }) }) })
      .subscribe((r) => { if (r) { this.toast.success('Document modifié'); this.load(); } });
  }
  remove(d: QuotationDocumentDto) {
    confirm(this.dialog, { title: 'Supprimer le document', message: `Supprimer « ${d.name} » ? Le fichier sera définitivement effacé.`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.svc.removeQuotationDocument(this.id(), d.id).subscribe({ next: () => { this.toast.success('Document supprimé'); this.load(); this.changed.emit(); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
