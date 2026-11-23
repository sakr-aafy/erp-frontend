import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { PASSWORD_HINT, passwordPolicy } from './password-rules';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, PageHeader],
  template: `
    <div class="page" style="max-width:520px">
      <app-page-header title="Changer le mot de passe" [subtitle]="auth.user()?.mustChangePassword ? 'Un nouveau mot de passe est requis avant de continuer.' : hint" />
      <form class="card" [formGroup]="form" (ngSubmit)="submit()" style="display:flex;flex-direction:column">
        @if (error()) {<div class="error" role="alert" style="color:var(--danger);margin-bottom:12px">{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Mot de passe actuel</mat-label><input matInput type="password" formControlName="current" autocomplete="current-password" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Nouveau mot de passe</mat-label><input matInput type="password" formControlName="next" autocomplete="new-password" />
          @if (form.controls.next.touched && form.controls.next.invalid) {<mat-error>{{ hint }}</mat-error>}</mat-form-field>
        <button mat-flat-button color="primary" type="submit" [disabled]="loading()">Enregistrer</button>
      </form>
    </div>`,
})
export class ChangePassword {
  auth = inject(AuthService); private router = inject(Router); private toast = inject(ToastService);
  hint = PASSWORD_HINT;
  form = inject(FormBuilder).nonNullable.group({ current: ['', Validators.required], next: ['', [Validators.required, passwordPolicy]] });
  loading = signal(false); error = signal('');
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set('');
    const { current, next } = this.form.getRawValue();
    this.auth.changePassword(current, next).subscribe({
      next: () => { this.toast.success('Mot de passe modifié, reconnectez-vous'); this.router.navigateByUrl('/login'); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
