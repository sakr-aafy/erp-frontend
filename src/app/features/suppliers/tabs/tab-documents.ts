import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
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
import { RouterLink } from '@angular/router';
import { SupplierDto } from '../../../shared/models/api.models';
import { openDocumentDialog } from '../../customers/customer-dialogs';
import { formatBytes } from '../../customers/customer.labels';
import { SUPPLIER_DOC_TYPES } from '../supplier.labels';
import { SupplierService } from '../supplier.service';
import { SupplierDocumentDto, SupplierDocuments } from '../supplier.types';

/** Onglet Documents : pièces jointes réelles du fournisseur (stockées dans MongoDB) et liens vers les pièces des dossiers d'importation. */
@Component({
  selector: 'app-tab-documents',
  imports: [DatePipe, RouterLink, MatButtonModule, Icon, EmptyState, Skeleton],
  template: `
    <div class="top"><h2>Documents attachés</h2>@if (canEdit()) {<button mat-flat-button color="primary" type="button" (click)="add()"><app-icon name="upload" />Ajouter un document</button>}</div>
    @if (!docs()) {<div class="card"><app-skeleton /></div>}
    @else if (!docs()!.length) {<div class="card"><app-empty-state icon="folder" message="Aucun document attaché : carte d’identification fiscale, contrat, catalogue, tarif, certificat…" /></div>}
    @else {<div class="list">@for (d of docs(); track d.id) {
      <article class="card d">
        <span class="ico" [class.img]="isImage(d)"><app-icon [name]="isImage(d) ? 'visibility' : 'picture_as_pdf'" /></span>
        <div class="body"><strong class="nm">{{ d.name }}</strong><span class="chip ok">{{ d.typeLabel }}</span>
          @if (d.description) {<span class="muted">{{ d.description }}</span>}
          <span class="muted meta">{{ size(d.size) }} · ajouté le {{ d.uploadedAt | date: 'dd/MM/yyyy HH:mm' }}@if (d.uploadedBy) { par {{ d.uploadedBy }}}</span></div>
        <div class="acts">
          @if (viewable(d)) {<button mat-icon-button type="button" (click)="view(d)" [attr.aria-label]="'Consulter ' + d.name" title="Consulter"><app-icon name="visibility" /></button>}
          <button mat-icon-button type="button" (click)="download(d)" [attr.aria-label]="'Télécharger ' + d.name" title="Télécharger"><app-icon name="download" /></button>
          @if (canEdit()) {<button mat-icon-button type="button" (click)="edit(d)" [attr.aria-label]="'Modifier ' + d.name" title="Modifier"><app-icon name="edit" /></button>
            <button mat-icon-button type="button" class="del" (click)="remove(d)" [attr.aria-label]="'Supprimer ' + d.name" title="Supprimer"><app-icon name="delete" /></button>}
        </div>
      </article>}</div>}
    <p class="muted small">PDF, images, DOCX ou XLSX — 10 Mo maximum par fichier. Les fichiers ne sont accessibles qu’aux utilisateurs autorisés de la société.</p>
    @if (linked().length) {<h3>Pièces des dossiers d’importation</h3><div class="card"><ul class="linked">@for (l of linked(); track $index) {
      <li><app-icon name="flight_land" /><span class="body"><strong>{{ l.name }}</strong><span class="muted meta">{{ l.received ? 'Reçu' : 'En attente' }}@if (l.fileName) { · {{ l.fileName }}}</span></span><a [routerLink]="['/imports', l.importId]">{{ l.importNumber }}</a></li>}</ul></div>}`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.list{display:flex;flex-direction:column;gap:10px}
    .d{display:flex;align-items:center;gap:14px;padding:14px 16px}.ico{display:grid;place-items:center;width:42px;height:42px;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);flex:none}
    .body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}.nm{overflow-wrap:anywhere}.meta{font-size:12px}.acts{display:flex;gap:2px;flex:none}.acts button{color:var(--muted)}.acts button:hover{color:var(--brand)}.acts .del:hover{color:var(--danger)}
    .small{font-size:12px;margin-top:12px}h3{margin:20px 0 10px;font-size:15px;font-weight:600}.linked{list-style:none;margin:0;padding:0}.linked li{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}.linked li:last-child{border-bottom:0}.linked app-icon{color:var(--brand)}@media (max-width:560px){.d{flex-wrap:wrap}.acts{width:100%;justify-content:flex-end}}`,
})
export class TabDocuments {
  c = input.required<SupplierDto>(); changed = output<void>();
  private svc = inject(SupplierService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService); private dl = inject(DownloadService);
  docs = signal<SupplierDocumentDto[] | null>(null); linked = signal<SupplierDocuments['linked']>([]); size = formatBytes;
  canEdit = computed(() => this.auth.has('suppliers:update') && this.c().status !== 'archived');
  ngOnInit() { this.load(); }
  load() { this.svc.documents(this.c().id).subscribe({ next: (d) => { this.docs.set(d.items); this.linked.set(d.linked); }, error: (e) => { this.toast.error(errorMessage(e)); this.docs.set([]); } }); }
  isImage = (d: SupplierDocumentDto) => !!d.mime?.startsWith('image/');
  viewable = (d: SupplierDocumentDto) => d.mime === 'application/pdf' || !!d.mime?.startsWith('image/');
  private path = (d: SupplierDocumentDto) => `/suppliers/${this.c().id}/documents/${d.id}/file`;
  view(d: SupplierDocumentDto) { this.dl.open(this.path(d), { disposition: 'inline' }).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  download(d: SupplierDocumentDto) { this.dl.save(this.path(d), {}, d.name).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  add() { openDocumentDialog(this.dialog, { types: SUPPLIER_DOC_TYPES, submit: (v) => this.svc.uploadDocument(this.c().id, v.file!, v.type, v.description) }).subscribe((r) => { if (r) { this.toast.success('Document ajouté'); this.load(); this.changed.emit(); } }); }
  edit(d: SupplierDocumentDto) { openDocumentDialog(this.dialog, { document: d, types: SUPPLIER_DOC_TYPES, submit: (v) => this.svc.updateDocument(this.c().id, d.id, { type: v.type, description: v.description }) }).subscribe((r) => { if (r) { this.toast.success('Document modifié'); this.load(); } }); }
  remove(d: SupplierDocumentDto) {
    confirm(this.dialog, { title: 'Supprimer le document', message: `Supprimer « ${d.name} » ? Le fichier sera définitivement effacé.`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.svc.removeDocument(this.c().id, d.id).subscribe({ next: () => { this.toast.success('Document supprimé'); this.load(); this.changed.emit(); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
