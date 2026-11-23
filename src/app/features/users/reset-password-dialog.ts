import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { errorMessage } from '../../core/services/api';
import { UserDto } from '../../shared/models/api.models';
import { PASSWORD_HINT, passwordPolicy } from '../auth/password-rules';
import { UserService } from './user.service';

@Component({
  selector: 'app-reset-password-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Réinitialiser le mot de passe</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content style="display:flex;flex-direction:column;min-width:min(420px,80vw)">
        <p class="muted">{{ user.name }} devra changer ce mot de passe temporaire à sa prochaine connexion. Ses sessions seront fermées.</p>
        @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Mot de passe temporaire</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>{{ hint }}</mat-hint>@if (form.invalid && form.touched) {<mat-error>Mot de passe non conforme</mat-error>}</mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="loading()">Réinitialiser</button></mat-dialog-actions>
    </form>`,
})
export class ResetPasswordDialog {
  user = inject<UserDto>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ResetPasswordDialog>);
  private svc = inject(UserService);
  hint = PASSWORD_HINT;
  form = inject(FormBuilder).nonNullable.group({ password: ['', [Validators.required, passwordPolicy]] });
  loading = signal(false); error = signal('');
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.svc.resetPassword(this.user.id, this.form.getRawValue().password).subscribe({ next: () => this.ref.close(true), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}
