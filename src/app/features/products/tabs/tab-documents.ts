import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { ProductDto } from '../../../shared/models/api.models';
import { ProductPhotos } from '../product-actions.service';
import { openDocumentDialog } from '../product-dialogs';
import { DOC_TYPES, formatBytes } from '../product.labels';
import { ProductService } from '../product.service';
import { DocumentDto, DocumentsView } from '../product.types';

/** Onglet 7 — Documents : photos (photo principale), factures fournisseurs, fiches techniques, manuels, certificats… stockés dans MongoDB ; liens vers les documents des modules sources. */
@Component({
  selector: 'app-tab-documents',
  imports: [DatePipe, RouterLink, MatButtonModule, Icon, EmptyState, Skeleton],
  template: `
    <div class="top"><div><h2>Documents de l’article</h2><p class="muted">Bibliothèque documentaire — fichiers accessibles aux seuls utilisateurs autorisés de la société</p></div>
      @if (canEdit()) {<div class="acts"><button mat-stroked-button type="button" (click)="add('photo')"><app-icon name="visibility" />Ajouter des photos</button><button mat-flat-button color="primary" type="button" (click)="add('datasheet')"><app-icon name="upload" />Ajouter un document</button></div>}</div>
    @if (!v()) {<div class="card"><app-skeleton /></div>} @else {
      @if (photos().length) {
        <section class="card"><h3>Photos ({{ photos().length }})</h3>
          <div class="gal">@for (d of photos(); track d.id) {
            <figure class="ph" [class.main]="d.isMain"><button type="button" class="img" (click)="view(d)" [attr.aria-label]="'Agrandir ' + d.name">@if (thumbs()[d.id]) {<img [src]="thumbs()[d.id]" [alt]="d.name" />} @else {<app-icon name="visibility" />}</button>
              <figcaption><span class="nm">{{ d.name }}</span>@if (d.isMain) {<span class="chip ok">Photo principale</span>}
                <span class="row">@if (!d.isMain && canEdit()) {<button mat-button type="button" (click)="makeMain(d)">Définir comme principale</button>}@if (canEdit()) {<button mat-icon-button type="button" class="del" (click)="remove(d)" [attr.aria-label]="'Supprimer ' + d.name" title="Supprimer"><app-icon name="delete" /></button>}</span></figcaption></figure>}</div></section>}
      <section class="card" style="margin-top:16px"><h3>Fichiers</h3>
        @if (!others().length) {<app-empty-state icon="folder" message="Aucun document : fiche technique, certificat CE, manuel d’utilisation…" />} @else {
          <div class="list">@for (d of others(); track d.id) {<article class="d"><span class="ico"><app-icon [name]="iconOf(d.type)" /></span>
            <div class="body"><strong class="nm">{{ d.name }}</strong><span class="chip ok">{{ d.typeLabel }}</span>@if (d.description) {<span class="muted">{{ d.description }}</span>}
              <span class="muted meta">{{ size(d.size) }} · {{ ext(d) }} · ajouté le {{ d.uploadedAt | date: 'dd/MM/yyyy HH:mm' }}@if (d.uploadedBy) { par {{ d.uploadedBy }}}</span></div>
            <div class="acts2">@if (viewable(d)) {<button mat-icon-button type="button" (click)="view(d)" [attr.aria-label]="'Consulter ' + d.name" title="Consulter"><app-icon name="visibility" /></button>}
              <button mat-icon-button type="button" (click)="download(d)" [attr.aria-label]="'Télécharger ' + d.name" title="Télécharger"><app-icon name="download" /></button>
              @if (canEdit()) {<button mat-icon-button type="button" (click)="edit(d)" [attr.aria-label]="'Modifier ' + d.name" title="Modifier"><app-icon name="edit" /></button><button mat-icon-button type="button" class="del" (click)="remove(d)" [attr.aria-label]="'Supprimer ' + d.name" title="Supprimer"><app-icon name="delete" /></button>}</div></article>}</div>}
        <p class="muted small">Catégories : {{ catLabels }}. PDF, images, DOCX ou XLSX — 10 Mo maximum.</p></section>
      @if (v()!.linked.length) {
        <section class="card" style="margin-top:16px"><h3>Documents liés (modules sources)</h3><p class="muted small">Ces documents restent dans leur module d’origine : ils ne sont pas dupliqués.</p>
          <div class="list">@for (l of v()!.linked; track l.name) {<article class="d"><span class="ico"><app-icon [name]="l.kind === 'customs' ? 'account_balance' : 'receipt_long'" /></span><div class="body"><strong class="nm">{{ l.name }}</strong><span class="chip off">{{ l.typeLabel }}</span>@if (l.subtitle) {<span class="muted">{{ l.subtitle }}</span>}</div>
            <div class="acts2"><a mat-icon-button [routerLink]="[l.webPath]" aria-label="Ouvrir le document source" title="Ouvrir"><app-icon name="open_in_new" /></a></div></article>}</div></section>}
    }`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}h3{margin:0 0 12px;font-size:15px;font-weight:600}.acts{display:flex;gap:8px;flex-wrap:wrap}
    .gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}.ph{margin:0;border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;background:var(--surface)}.ph.main{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}
    .img{display:grid;place-items:center;width:100%;aspect-ratio:4/3;border:0;background:var(--brand-50);cursor:zoom-in;padding:0;color:var(--brand)}.img img{width:100%;height:100%;object-fit:cover}.ph figcaption{padding:8px 10px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}.nm{overflow-wrap:anywhere;font-weight:600;font-size:13px}.row{display:flex;align-items:center;gap:2px;width:100%;justify-content:space-between}
    .list{display:flex;flex-direction:column;gap:8px}.d{display:flex;align-items:center;gap:14px;padding:10px 4px;border-bottom:1px solid var(--border)}.d:last-child{border-bottom:0}.ico{display:grid;place-items:center;width:40px;height:40px;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);flex:none}
    .body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}.meta,.small{font-size:12px}.acts2{display:flex;gap:2px;flex:none}.acts2 button,.acts2 a,.del{color:var(--muted)}.acts2 button:hover,.acts2 a:hover{color:var(--brand)}.del:hover{color:var(--danger)}
    @media (max-width:560px){.d{flex-wrap:wrap}.acts2{width:100%;justify-content:flex-end}}`,
})
export class TabDocuments {
  p = input.required<ProductDto>(); changed = output<void>();
  private svc = inject(ProductService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService); private dl = inject(DownloadService); private photosSvc = inject(ProductPhotos);
  v = signal<DocumentsView | null>(null); thumbs = signal<Record<string, string>>({}); size = formatBytes; catLabels = DOC_TYPES.map((t) => t.label.toLowerCase()).join(', ');
  canEdit = computed(() => this.auth.has('products:update') && this.p().status !== 'archived');
  photos = computed(() => (this.v()?.items ?? []).filter((d) => d.type === 'photo')); others = computed(() => (this.v()?.items ?? []).filter((d) => d.type !== 'photo'));
  ngOnInit() { this.load(); }
  load() { this.svc.documents(this.p().id).subscribe({ next: (v) => { this.v.set(v); v.items.filter((d) => d.type === 'photo').forEach((d) => this.loadThumb(d)); }, error: (e) => { this.toast.error(errorMessage(e)); this.v.set({ items: [], linked: [], mainPhotoId: null }); } }); }
  private path = (d: DocumentDto) => `/products/${this.p().id}/documents/${d.id}/file`;
  private loadThumb(d: DocumentDto) { this.fetchBlob(d).then((u) => u && this.thumbs.update((t) => ({ ...t, [d.id]: u }))); }
  private cache = new Map<string, Promise<string | null>>();
  private fetchBlob(d: DocumentDto) { if (!this.cache.has(d.id)) this.cache.set(d.id, new Promise((res) => this.dl.blobUrl(this.path(d), { disposition: 'inline' }).subscribe({ next: (u) => res(u), error: () => res(null) }))); return this.cache.get(d.id)!; }
  iconOf = (t: string) => DOC_TYPES.find((x) => x.value === t)?.icon ?? 'attach_file';
  ext = (d: DocumentDto) => (d.name.split('.').pop() ?? '').toUpperCase();
  viewable = (d: DocumentDto) => d.mime === 'application/pdf' || d.isImage;
  view(d: DocumentDto) { this.dl.open(this.path(d), { disposition: 'inline' }).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  download(d: DocumentDto) { this.dl.save(this.path(d), {}, d.name).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  add(defaultType: string) { openDocumentDialog(this.dialog, { defaultType, submit: (f) => this.svc.uploadDocument(this.p().id, f.file, f.type, f.description) }).subscribe((r) => { if (r) { this.toast.success('Document ajouté'); this.photosSvc.forget(this.p().id); this.load(); this.changed.emit(); } }); }
  edit(d: DocumentDto) { openDocumentDialog(this.dialog, { document: d, submit: (f) => this.svc.updateDocument(this.p().id, d.id, { type: f.type, description: f.description }) }).subscribe((r) => { if (r) { this.toast.success('Document modifié'); this.load(); this.changed.emit(); } }); }
  makeMain(d: DocumentDto) { this.svc.setMainPhoto(this.p().id, d.id).subscribe({ next: () => { this.toast.success('Photo principale mise à jour'); this.photosSvc.forget(this.p().id); this.load(); this.changed.emit(); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  remove(d: DocumentDto) {
    confirm(this.dialog, { title: 'Supprimer le document', message: `Supprimer « ${d.name} » ? Le fichier sera définitivement effacé.`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.svc.removeDocument(this.p().id, d.id).subscribe({ next: () => { this.toast.success('Document supprimé'); this.photosSvc.forget(this.p().id); this.load(); this.changed.emit(); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
