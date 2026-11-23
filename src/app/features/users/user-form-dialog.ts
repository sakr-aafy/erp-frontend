import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { errorMessage } from '../../core/services/api';
import { RoleDto, UserDto } from '../../shared/models/api.models';
import { PASSWORD_HINT, passwordPolicy } from '../auth/password-rules';
import { UserService } from './user.service';

export interface UserFormData { user?: UserDto; roles: RoleDto[] }

@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.user ? 'Modifier l’utilisateur' : 'Nouvel utilisateur' }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content style="display:flex;flex-direction:column;min-width:min(420px,80vw)">
        @if (error()) {<div style="color:var(--danger);margin-bottom:8px" role="alert">{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Nom complet</mat-label><input matInput formControlName="name" />
          @if (form.controls.name.invalid && form.controls.name.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
        @if (!data.user) {
          <mat-form-field appearance="outline"><mat-label>Identifiant</mat-label><input matInput formControlName="username" />
            @if (form.controls.username.invalid && form.controls.username.touched) {<mat-error>3 caractères minimum (lettres, chiffres, . _ -)</mat-error>}</mat-form-field>
        }
        <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" />
          @if (form.controls.email.invalid && form.controls.email.touched) {<mat-error>E-mail valide requis</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Rôle</mat-label>
          <mat-select formControlName="roleId">@for (r of data.roles; track r._id) {<mat-option [value]="r._id">{{ r.name }}</mat-option>}</mat-select>
          @if (form.controls.roleId.invalid && form.controls.roleId.touched) {<mat-error>Rôle requis</mat-error>}</mat-form-field>
        @if (!data.user) {
          <mat-form-field appearance="outline"><mat-label>Mot de passe temporaire</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password" />
            <mat-hint>{{ hint }}</mat-hint>
            @if (form.controls.password.invalid && form.controls.password.touched) {<mat-error>Mot de passe non conforme</mat-error>}</mat-form-field>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annuler</button>
        <button mat-flat-button color="primary" [disabled]="loading()">Enregistrer</button>
      </mat-dialog-actions>
    </form>`,
})
export class UserFormDialog {
  data = inject<UserFormData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<UserFormDialog>);
  private svc = inject(UserService);
  hint = PASSWORD_HINT;
  form = inject(FormBuilder).nonNullable.group({
    name: [this.data.user?.name ?? '', [Validators.required, Validators.minLength(2)]],
    username: [this.data.user?.username ?? '', this.data.user ? [] : [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    roleId: [this.data.user?.roleId ?? '', Validators.required],
    password: ['', this.data.user ? [] : [Validators.required, passwordPolicy]],
  });
  loading = signal(false); error = signal('');

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set('');
    const v = this.form.getRawValue();
    const req = this.data.user
      ? this.svc.update(this.data.user.id, { name: v.name, email: v.email, roleId: v.roleId })
      : this.svc.create({ name: v.name, username: v.username, email: v.email, roleId: v.roleId, password: v.password });
    req.subscribe({ next: (u) => this.ref.close(u), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}
