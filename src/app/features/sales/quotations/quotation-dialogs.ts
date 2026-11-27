import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { errorMessage } from '../../../core/services/api';
import { Icon } from '../../../shared/components/icon';
import { SEND_METHODS } from '../sales.models';

export type QuotationDialogMode = 'mark-sent' | 'email' | 'accept' | 'refuse' | 'new-version';
export interface QuotationDialogData { mode: QuotationDialogMode; number: string; customerEmail?: string | null; submit: (body: Record<string, string>) => Observable<unknown> }
const CONFIG: Record<QuotationDialogMode, { title: string; help: string; confirm: string; icon: string }> = {
  'mark-sent': { title: 'Marquer comme envoyé', help: 'À utiliser lorsque le devis a été transmis par un autre moyen que l’e-mail de l’application. La version transmise est figée.', confirm: 'Marquer comme envoyé', icon: 'send' },
  email: { title: 'Envoyer par e-mail', help: 'Le PDF du devis est joint. Un brouillon ne passe à « Envoyé » que si l’envoi réussit ; la version envoyée est alors figée.', confirm: 'Envoyer', icon: 'mail' },
  accept: { title: 'Accepter le devis', help: 'La version acceptée est figée : elle pourra être convertie en facture proforma.', confirm: 'Accepter le devis', icon: 'check_circle' },
  refuse: { title: 'Refuser le devis', help: 'Le devis et son historique sont conservés.', confirm: 'Refuser le devis', icon: 'cancel' },
  'new-version': { title: 'Créer une nouvelle version', help: 'La version actuelle est conservée telle quelle. Un brouillon identique est ouvert sous le même numéro ; la version précédente ne pourra plus être acceptée tant que ce brouillon existe.', confirm: 'Créer la version', icon: 'layers' },
};

/** Dialogue des actions de statut d'un devis : appelle le serveur puis se ferme avec le résultat ; l'erreur reste affichée. */
@Component({
  selector: 'app-quotation-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon],
  template: `
    <h2 mat-dialog-title>{{ cfg.title }} — {{ data.number }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="body">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <p class="muted">{{ cfg.help }}</p>
        @if (data.mode === 'mark-sent') {
          <mat-form-field appearance="outline"><mat-label>Mode d’envoi</mat-label><mat-select formControlName="method">@for (m of methods; track m.value) {<mat-option [value]="m.value">{{ m.label }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Destinataire (facultatif)</mat-label><input matInput formControlName="recipient" maxlength="150" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Commentaire (facultatif)</mat-label><textarea matInput rows="2" formControlName="note" maxlength="500"></textarea></mat-form-field>
        }
        @if (data.mode === 'email') {
          <mat-form-field appearance="outline"><mat-label>Destinataire</mat-label><input matInput type="email" formControlName="to" [placeholder]="data.customerEmail ?? ''" />
            <mat-hint>{{ data.customerEmail ? 'Vide : ' + data.customerEmail : 'Aucun e-mail sur la fiche client : saisissez le destinataire' }}</mat-hint>@if (form.controls.to.invalid) {<mat-error>Adresse e-mail invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Message (facultatif)</mat-label><textarea matInput rows="3" formControlName="message" maxlength="2000"></textarea></mat-form-field>
        }
        @if (data.mode === 'accept') {<mat-form-field appearance="outline"><mat-label>Commentaire (facultatif)</mat-label><textarea matInput rows="2" formControlName="comment" maxlength="500"></textarea></mat-form-field>}
        @if (data.mode === 'new-version') {<mat-form-field appearance="outline"><mat-label>Nouvelle date de validité (facultatif)</mat-label><input matInput type="date" formControlName="validUntil" [min]="today" />
          <mat-hint>Vide : la date actuelle si elle n’est pas dépassée, sinon la même durée à partir d’aujourd’hui.</mat-hint></mat-form-field>}
        @if (data.mode === 'refuse') {<mat-form-field appearance="outline"><mat-label>Motif du refus (facultatif)</mat-label><textarea matInput rows="2" formControlName="reason" maxlength="500"></textarea></mat-form-field>}
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()"><app-icon [name]="cfg.icon" />{{ cfg.confirm }}</button></mat-dialog-actions>
    </form>`,
  styles: `.body{display:flex;flex-direction:column;width:min(480px,84vw)}p{margin:0 0 14px}.err{display:flex;gap:8px;align-items:center;color:var(--danger);background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--r-md);padding:8px 12px;margin-bottom:12px}`,
})
export class QuotationDialog {
  data = inject<QuotationDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<QuotationDialog>);
  cfg = CONFIG[this.data.mode]; methods = SEND_METHODS; today = new Date().toISOString().slice(0, 10);
  form = new FormBuilder().nonNullable.group({ method: ['hand'], recipient: [''], note: [''], to: ['', Validators.email], message: [''], comment: [''], reason: [''], validUntil: [''] });
  busy = signal(false); error = signal('');
  private fields: Record<QuotationDialogMode, (keyof QuotationDialog['form']['controls'])[]> = { 'mark-sent': ['method', 'recipient', 'note'], email: ['to', 'message'], accept: ['comment'], refuse: ['reason'], 'new-version': ['validUntil'] };
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); const body = Object.fromEntries(this.fields[this.data.mode].map((k) => [k, v[k].trim()]).filter(([, x]) => x)) as Record<string, string>;
    this.busy.set(true); this.error.set('');
    this.data.submit(body).subscribe({ next: (r) => this.ref.close(r ?? true), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}
