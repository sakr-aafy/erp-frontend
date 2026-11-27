import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { errorMessage } from '../../core/services/api';
import { Icon } from '../../shared/components/icon';
import { Contact } from '../../shared/models/api.models';
import { ACTIVITY_KINDS, DOC_TYPES, formatBytes } from './customer.labels';
import { DocumentDto } from './customer.types';

const PHONE_OK = (v: string) => !v || /^\+?[\d\s().\-/]{6,25}$/.test(v);

/** Boîtes de dialogue de la fiche client : contact, activité, document. Chacune appelle le serveur via `submit` puis se ferme avec le résultat. */
const SHELL = `.c{display:flex;flex-direction:column;min-width:min(460px,84vw)}.err{color:var(--danger);background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--r-md);padding:8px 12px;margin-bottom:8px;display:flex;gap:8px;align-items:center}`;

// ---------- Contact ----------
export interface ContactDialogData { contact?: Contact; submit: (v: { name: string; role?: string; phone?: string; email?: string; isPrimary: boolean }) => Observable<unknown> }
@Component({
  selector: 'app-contact-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, Icon],
  template: `
    <h2 mat-dialog-title>{{ data.contact ? 'Modifier le contact' : 'Nouveau contact' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="c">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Nom et prénom</mat-label><input matInput formControlName="name" required />@if (form.controls.name.invalid && form.controls.name.touched) {<mat-error>Nom requis</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Fonction</mat-label><input matInput formControlName="role" placeholder="Directeur, acheteur…" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Téléphone direct</mat-label><input matInput type="tel" formControlName="phone" placeholder="+216" />@if (form.controls.phone.invalid) {<mat-error>Numéro invalide</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" placeholder="contact@entreprise.tn" />@if (form.controls.email.invalid) {<mat-error>E-mail invalide</mat-error>}</mat-form-field>
        <mat-checkbox formControlName="isPrimary">Contact principal</mat-checkbox>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()">Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: SHELL,
})
export class ContactDialog {
  data = inject<ContactDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<ContactDialog>);
  form = new FormBuilder().nonNullable.group({
    name: [this.data.contact?.name ?? '', [Validators.required, Validators.maxLength(100)]], role: [this.data.contact?.role ?? ''],
    phone: [this.data.contact?.phoneInfo?.display ?? this.data.contact?.phone ?? '', (c: { value: string }) => (PHONE_OK(c.value) ? null : { phone: true })], email: [this.data.contact?.email ?? '', Validators.email], isPrimary: [this.data.contact?.isPrimary ?? false],
  });
  busy = signal(false); error = signal('');
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    this.data.submit({ name: v.name.trim(), ...(v.role.trim() && { role: v.role.trim() }), ...(v.phone.trim() && { phone: v.phone.trim() }), ...(v.email.trim() && { email: v.email.trim() }), isPrimary: v.isPrimary })
      .subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

// ---------- Activité ----------
/** `kinds` / `types` : listes propres à la fiche appelante (client par défaut, fournisseur sinon). */
export interface ActivityDialogData { activity?: { kind: string; title: string; description: string | null; occurredAt: string }; kinds?: { value: string; label: string }[]; submit: (v: { kind: string; title: string; description?: string; occurredAt: string }) => Observable<unknown> }
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
@Component({
  selector: 'app-activity-dialog',
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
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()">Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: SHELL,
})
export class ActivityDialog {
  data = inject<ActivityDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<ActivityDialog>); kinds: { value: string; label: string }[] = this.data.kinds ?? ACTIVITY_KINDS;
  form = new FormBuilder().nonNullable.group({
    kind: [this.data.activity?.kind ?? 'call'], title: [this.data.activity?.title ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    description: [this.data.activity?.description ?? '', Validators.maxLength(2000)], occurredAt: [localInput(this.data.activity ? new Date(this.data.activity.occurredAt) : new Date()), Validators.required],
  });
  busy = signal(false); error = signal(''); private initial = this.form.controls.occurredAt.value; // date par défaut non modifiée : instant exact de l'enregistrement
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    this.data.submit({ kind: v.kind, title: v.title.trim(), ...(v.description.trim() && { description: v.description.trim() }), occurredAt: (!this.data.activity && v.occurredAt === this.initial ? new Date() : new Date(v.occurredAt)).toISOString() })
      .subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

// ---------- Document ----------
export interface DocumentDialogData { document?: DocumentDto; types?: { value: string; label: string }[]; submit: (v: { type: string; description?: string; file: File | null }) => Observable<unknown> }
const MAX = 10 * 1024 * 1024; const ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx';
@Component({
  selector: 'app-document-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon],
  template: `
    <h2 mat-dialog-title>{{ data.document ? 'Modifier le document' : 'Ajouter un document' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="c">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Type de document</mat-label><mat-select formControlName="type">@for (t of types; track t.value) {<mat-option [value]="t.value">{{ t.label }}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Description (facultatif)</mat-label><input matInput formControlName="description" maxlength="300" /></mat-form-field>
        @if (!data.document) {
          <label class="drop" [class.has]="file()">
            <input type="file" [accept]="accept" (change)="pick($event)" hidden />
            <app-icon name="upload_file" />
            @if (file(); as f) {<strong>{{ f.name }}</strong><span class="muted">{{ size(f.size) }}</span>} @else {<strong>Choisir un fichier</strong><span class="muted">PDF, PNG, JPG, DOCX ou XLSX — 10 Mo maximum</span>}
          </label>
        } @else {<p class="muted">Fichier : <strong>{{ data.document.name }}</strong> ({{ size(data.document.size) }}). Pour le remplacer, supprimez-le puis ajoutez-en un nouveau.</p>}
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()">{{ data.document ? 'Enregistrer' : 'Téléverser' }}</button></mat-dialog-actions>
    </form>`,
  styles: SHELL + `.drop{display:flex;flex-direction:column;align-items:center;gap:4px;padding:22px 16px;border:2px dashed var(--border-strong);border-radius:var(--r-lg);cursor:pointer;text-align:center;background:var(--surface-2);transition:border-color var(--t-fast),background var(--t-fast)}
    .drop:hover,.drop:focus-within{border-color:var(--brand);background:var(--brand-50)}.drop.has{border-style:solid;border-color:var(--brand);background:var(--brand-50)}.drop app-icon{color:var(--brand);--icon-size:1.6rem}`,
})
export class DocumentDialog {
  data = inject<DocumentDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<DocumentDialog>); types: { value: string; label: string }[] = this.data.types ?? DOC_TYPES; accept = ACCEPT; size = formatBytes;
  form = new FormBuilder().nonNullable.group({ type: [this.data.document?.type ?? this.types[0]!.value], description: [this.data.document?.description ?? ''] });
  file = signal<File | null>(null); busy = signal(false); error = signal('');
  pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null; this.error.set('');
    if (f && f.size > MAX) { this.error.set('Fichier trop volumineux (10 Mo maximum).'); this.file.set(null); return; }
    this.file.set(f);
  }
  save() {
    if (!this.data.document && !this.file()) { this.error.set('Sélectionnez un fichier.'); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    this.data.submit({ type: v.type, description: v.description.trim(), file: this.file() }).subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

export const openContactDialog = (d: MatDialog, data: ContactDialogData) => d.open(ContactDialog, { data, autoFocus: 'first-tabbable' }).afterClosed();
export const openActivityDialog = (d: MatDialog, data: ActivityDialogData) => d.open(ActivityDialog, { data }).afterClosed();
export const openDocumentDialog = (d: MatDialog, data: DocumentDialogData) => d.open(DocumentDialog, { data }).afterClosed();
