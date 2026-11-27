import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { QuotationComment } from '../sales.models';
import { SalesService } from '../sales.service';

const noBlank = (c: { value: string }) => (c.value.trim() ? null : { required: true });

/** Onglet Commentaires : notes internes de l'équipe, jamais imprimées ni envoyées au client. */
@Component({
  selector: 'app-quotation-comments',
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon, EmptyState, Skeleton],
  template: `
    <p class="internal" role="note"><app-icon name="shield" />Commentaires internes : ils ne figurent ni sur les PDF, ni dans les e-mails, ni sur aucun document remis au client. Les notes commerciales se saisissent dans le devis.</p>
    @if (canAdd) {
      <form class="card add" (submit)="$event.preventDefault(); add()">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full"><mat-label>Nouveau commentaire interne</mat-label><textarea matInput rows="3" maxlength="4000" [formControl]="text"></textarea></mat-form-field>
        <button mat-flat-button color="primary" type="submit" [disabled]="busy() || text.invalid"><app-icon name="chat" />Ajouter le commentaire</button>
      </form>}
    @if (!items()) {<div class="card"><app-skeleton /></div>}
    @else if (!items()!.length) {<div class="card"><app-empty-state icon="chat" message="Aucun commentaire sur ce devis." /></div>}
    @else {<ul>@for (c of items(); track c.id) {
      <li class="card" [class.archived]="c.archivedAt">
        <header><strong>{{ c.author ?? '—' }}</strong><span class="muted">{{ c.createdAt | date: 'dd/MM/yyyy HH:mm' }}@if (c.editedAt) { · modifié le {{ c.editedAt | date: 'dd/MM/yyyy HH:mm' }}@if (c.editedBy && c.editedBy !== c.author) { par {{ c.editedBy }}}}</span><span class="spacer"></span>
          @if (c.canEdit && editing() !== c.id) {<button mat-icon-button type="button" (click)="start(c)" aria-label="Modifier le commentaire" title="Modifier"><app-icon name="edit" /></button>}
          @if (c.canArchive) {<button mat-icon-button type="button" (click)="archive(c)" aria-label="Archiver le commentaire" title="Archiver"><app-icon name="archive" /></button>}</header>
        @if (c.archivedAt) {<p class="muted">Commentaire archivé le {{ c.archivedAt | date: 'dd/MM/yyyy HH:mm' }}@if (c.archivedBy) { par {{ c.archivedBy }}}.</p>}
        @else if (editing() === c.id) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full"><mat-label>Commentaire</mat-label><textarea matInput rows="3" maxlength="4000" [formControl]="draft"></textarea></mat-form-field>
          <div class="acts"><button mat-flat-button color="primary" type="button" [disabled]="busy() || draft.invalid" (click)="save(c)">Enregistrer</button><button mat-button type="button" (click)="editing.set('')">Annuler</button></div>
        } @else {<p class="pre">{{ c.body }}</p>}
      </li>}</ul>}`,
  styles: `.internal{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;padding:10px 14px;border-radius:var(--r-md);background:var(--accent-50);border:1px solid var(--accent-300)}.add{display:flex;flex-direction:column;gap:10px;align-items:flex-end;margin-bottom:12px}.full{width:100%}
    ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}li{padding:12px 16px}li.archived{background:var(--surface-2)}header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}header span.muted{font-size:12px}.spacer{flex:1}.pre{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.acts{display:flex;gap:8px;margin-top:8px}`,
})
export class QuotationCommentsTab {
  id = input.required<string>();
  private svc = inject(SalesService); private toast = inject(ToastService); private dialog = inject(MatDialog); private auth = inject(AuthService);
  items = signal<QuotationComment[] | null>(null); busy = signal(false); editing = signal(''); canAdd = this.auth.has('quotations:update');
  text = new FormControl('', { nonNullable: true, validators: [noBlank, Validators.maxLength(4000)] }); draft = new FormControl('', { nonNullable: true, validators: [noBlank, Validators.maxLength(4000)] });
  ngOnInit() { this.load(); }
  load() { this.svc.quotationComments(this.id()).subscribe({ next: (r) => this.items.set(r.items), error: (e) => { this.toast.error(errorMessage(e)); this.items.set([]); } }); }
  private run(call: Observable<unknown>, done: string, after: () => void = () => undefined) {
    this.busy.set(true);
    call.subscribe({ next: () => { this.busy.set(false); after(); this.toast.success(done); this.load(); }, error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); } });
  }
  add() { if (this.text.invalid) return; this.run(this.svc.addQuotationComment(this.id(), this.text.value.trim()), 'Commentaire ajouté', () => this.text.reset('')); }
  start(c: QuotationComment) { this.draft.setValue(c.body ?? ''); this.editing.set(c.id); }
  save(c: QuotationComment) { if (this.draft.invalid) return; this.run(this.svc.editQuotationComment(this.id(), c.id, this.draft.value.trim()), 'Commentaire modifié', () => this.editing.set('')); }
  archive(c: QuotationComment) {
    confirm(this.dialog, { title: 'Archiver le commentaire', message: 'Le texte ne sera plus affiché ; la trace de son auteur est conservée.', confirmLabel: 'Archiver' }).subscribe((ok) => { if (ok) this.run(this.svc.archiveQuotationComment(this.id(), c.id), 'Commentaire archivé'); });
  }
}
