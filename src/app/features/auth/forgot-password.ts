import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  styleUrl: './auth-card.scss',
  template: `
    <div class="box">
      <h2>Mot de passe oublié</h2><p>Saisissez votre e-mail pour recevoir un lien de réinitialisation.</p>
      @if (error()) {<div class="error" role="alert">{{ error() }}</div>}
      @if (message()) {<div class="ok">{{ message() }}</div>}
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" />
          @if (form.controls.email.touched && form.controls.email.invalid) {<mat-error>E-mail valide requis</mat-error>}</mat-form-field>
        <button mat-flat-button color="primary" [disabled]="loading()">Envoyer</button>
      </form>
      <div class="links"><a routerLink="/login">Retour à la connexion</a></div>
    </div>`,
})
export class ForgotPassword {
  private auth = inject(AuthService);
  form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  loading = signal(false); error = signal(''); message = signal('');
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set('');
    this.auth.forgot(this.form.getRawValue().email).subscribe({
      next: (r) => { this.message.set(r.message); this.loading.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
