import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, concat, last, tap } from 'rxjs';
import { errorMessage } from '../../core/services/api';
import { Icon } from '../../shared/components/icon';
import { ACTIVITY_KINDS, DOC_TYPES, formatBytes } from './product.labels';
import { ActivityDto, DocumentDto } from './product.types';

const SHELL = `.c{display:flex;flex-direction:column;min-width:min(480px,84vw)}.err{color:var(--danger);background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--r-md);padding:8px 12px;margin-bottom:8px;display:flex;gap:8px;align-items:center}`;
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// ---------- Document ----------
export interface DocumentDialogData { document?: DocumentDto; defaultType?: string; submit: (f: { type: string; description?: string; file: File }) => Observable<unknown> }
const MAX = 10 * 1024 * 1024; const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx';
@Component({
  selector: 'app-product-document-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon],
  template: `
    <h2 mat-dialog-title>{{ data.document ? 'Modifier le document' : 'Ajouter des documents' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="c">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Catégorie</mat-label><mat-select formControlName="type">@for (t of types; track t.value) {<mat-option [value]="t.value">{{ t.label }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Description (facultatif)</mat-label><input matInput formControlName="description" maxlength="300" /></mat-form-field>
        @if (!data.document) {
          <label class="drop" [class.has]="files().length">
            <input type="file" [accept]="accept" [multiple]="form.controls.type.value === 'photo'" (change)="pick($event)" hidden />
            <app-icon name="upload_file" />
            @if (files().length) {<strong>{{ files().length === 1 ? files()[0]!.name : files().length + ' fichiers sélectionnés' }}</strong><span class="muted">{{ total() }}</span>}
            @else {<strong>Choisir {{ form.controls.type.value === 'photo' ? 'une ou plusieurs photos' : 'un fichier' }}</strong><span class="muted">PDF, PNG, JPG, WEBP, DOCX ou XLSX — 10 Mo maximum par fichier</span>}
          </label>
          @if (progress()) {<p class="muted" role="status">{{ progress() }}</p>}
        } @else {<p class="muted">Fichier : <strong>{{ data.document.name }}</strong> ({{ size(data.document.size) }}). Pour le remplacer, supprimez-le puis ajoutez-en un nouveau.</p>}
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()">{{ data.document ? 'Enregistrer' : 'Téléverser' }}</button></mat-dialog-actions>
    </form>`,
  styles: SHELL + `.drop{display:flex;flex-direction:column;align-items:center;gap:4px;padding:22px 16px;border:2px dashed var(--border-strong);border-radius:var(--r-lg);cursor:pointer;text-align:center;background:var(--surface-2);transition:border-color var(--t-fast),background var(--t-fast)}
    .drop:hover,.drop:focus-within{border-color:var(--brand);background:var(--brand-50)}.drop.has{border-style:solid;border-color:var(--brand);background:var(--brand-50)}.drop app-icon{color:var(--brand);--icon-size:1.6rem}`,
})
export class ProductDocumentDialog {
  data = inject<DocumentDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<ProductDocumentDialog>); types = DOC_TYPES; accept = ACCEPT; size = formatBytes;
  form = new FormBuilder().nonNullable.group({ type: [this.data.document?.type ?? this.data.defaultType ?? 'datasheet'], description: [this.data.document?.description ?? ''] });
  files = signal<File[]>([]); busy = signal(false); error = signal(''); progress = signal('');
  total = computed(() => formatBytes(this.files().reduce((s, f) => s + f.size, 0)));
  pick(e: Event) {
    const fs = [...((e.target as HTMLInputElement).files ?? [])]; this.error.set('');
    const big = fs.find((f) => f.size > MAX); if (big) { this.error.set(`« ${big.name} » dépasse 10 Mo.`); this.files.set([]); return; }
    this.files.set(fs);
  }
  save() {
    const v = this.form.getRawValue();
    if (this.data.document) { this.run([{ type: v.type, description: v.description.trim(), file: null as unknown as File }]); return; }
    if (!this.files().length) { this.error.set('Sélectionnez au moins un fichier.'); return; }
    this.run(this.files().map((file) => ({ type: v.type, description: v.description.trim(), file })));
  }
  private run(items: { type: string; description: string; file: File }[]) {
    this.busy.set(true); this.error.set('');
    const calls = items.map((x, i) => this.data.submit(x).pipe(tap(() => this.progress.set(items.length > 1 ? `Téléversement ${i + 1} / ${items.length}…` : ''))));
    concat(...calls).pipe(last()).subscribe({ next: (r) => this.ref.close(r ?? true), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

// ---------- Activité ----------
export interface ActivityDialogData { activity?: ActivityDto; submit: (v: { kind: string; title: string; description?: string; occurredAt: string; dueDate?: string | null }) => Observable<unknown> }
@Component({
  selector: 'app-product-activity-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon],
  template: `
    <h2 mat-dialog-title>{{ data.activity ? 'Modifier l’activité' : 'Ajouter une activité' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="c">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Type d’activité</mat-label><mat-select formControlName="kind">@for (k of kinds; track k.value) {<mat-option [value]="k.value">{{ k.label }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Titre</mat-label><input matInput formControlName="title" required />@if (form.controls.title.invalid && form.controls.title.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Description</mat-label><textarea matInput rows="3" formControlName="description"></textarea></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Date et heure</mat-label><input matInput type="datetime-local" formControlName="occurredAt" /></mat-form-field>
        @if (isTask()) {<mat-form-field appearance="outline"><mat-label>Date d’échéance</mat-label><input matInput type="date" formControlName="dueDate" /><mat-hint>Tâche ou rappel : à effectuer avant cette date</mat-hint></mat-form-field>}
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()">Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: SHELL,
})
export class ProductActivityDialog {
  data = inject<ActivityDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<ProductActivityDialog>); kinds = ACTIVITY_KINDS;
  form = new FormBuilder().nonNullable.group({
    kind: [this.data.activity?.kind ?? 'note'], title: [this.data.activity?.title ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]], description: [this.data.activity?.description ?? '', Validators.maxLength(2000)],
    occurredAt: [localInput(this.data.activity ? new Date(this.data.activity.occurredAt) : new Date()), Validators.required], dueDate: [this.data.activity?.dueDate ? this.data.activity.dueDate.slice(0, 10) : ''],
  });
  busy = signal(false); error = signal(''); private initial = this.form.controls.occurredAt.value; // date par défaut non modifiée : l'instant exact de l'enregistrement est utilisé
  isTask = () => ['task', 'reminder'].includes(this.form.controls.kind.value);
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    this.data.submit({ kind: v.kind, title: v.title.trim(), ...(v.description.trim() && { description: v.description.trim() }), occurredAt: (!this.data.activity && v.occurredAt === this.initial ? new Date() : new Date(v.occurredAt)).toISOString(), ...(this.isTask() && { dueDate: v.dueDate ? new Date(`${v.dueDate}T00:00:00Z`).toISOString() : null }) })
      .subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

export const openDocumentDialog = (d: MatDialog, data: DocumentDialogData) => d.open(ProductDocumentDialog, { data }).afterClosed();
export const openActivityDialog = (d: MatDialog, data: ActivityDialogData) => d.open(ProductActivityDialog, { data }).afterClosed();
