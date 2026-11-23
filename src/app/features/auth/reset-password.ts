import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { PASSWORD_HINT, passwordPolicy } from './password-rules';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  styleUrl: './auth-card.scss',
  template: `
    <div class="box">
      <h2>Nouveau mot de passe</h2><p>{{ hint }}</p>
      @if (!token()) {<div class="error">Lien invalide : jeton manquant.</div>}
      @if (error()) {<div class="error" role="alert">{{ error() }}</div>}
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline"><mat-label>Nouveau mot de passe</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password" />
          @if (form.controls.password.touched && form.controls.password.invalid) {<mat-error>{{ hint }}</mat-error>}</mat-form-field>
        <button mat-flat-button color="primary" [disabled]="loading() || !token()">Réinitialiser</button>
      </form>
      <div class="links"><a routerLink="/login">Retour à la connexion</a></div>
    </div>`,
})
export class ResetPassword {
  /** Paramètre d'URL ?token= (withComponentInputBinding) */
  token = input<string>();
  hint = PASSWORD_HINT;
  private auth = inject(AuthService); private router = inject(Router); private toast = inject(ToastService);
  form = inject(FormBuilder).nonNullable.group({ password: ['', [Validators.required, passwordPolicy]] });
  loading = signal(false); error = signal('');
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.auth.reset(this.token()!, this.form.getRawValue().password).subscribe({
      next: () => { this.toast.success('Mot de passe réinitialisé'); this.router.navigateByUrl('/login'); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
