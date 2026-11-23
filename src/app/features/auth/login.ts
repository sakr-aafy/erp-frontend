import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, Icon, MatProgressSpinnerModule],
  styleUrl: './auth-card.scss',
  template: `
    <div class="box">
      <div class="logo"><img src="assets/logo.png" alt="" width="48" height="48" /><span>ERP<small>Gestion d’entreprise</small></span></div>
      <h2>Connexion</h2><p>Accédez à votre espace de gestion</p>
      @if (error()) {<div class="error" role="alert">{{ error() }}</div>}
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline"><mat-label>E-mail</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="username" />
          @if (form.controls.email.touched && form.controls.email.invalid) {<mat-error>E-mail valide requis</mat-error>}
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Mot de passe</mat-label>
          <input matInput [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" />
          <button mat-icon-button matSuffix type="button" (click)="show.set(!show())" aria-label="Afficher le mot de passe"><app-icon [name]="show() ? 'visibility_off' : 'visibility'" /></button>
          @if (form.controls.password.touched && form.controls.password.invalid) {<mat-error>Mot de passe requis</mat-error>}
        </mat-form-field>
        <button mat-flat-button color="primary" type="submit" [disabled]="loading()">
          @if (loading()) {<mat-spinner diameter="20" />} @else {Se connecter}
        </button>
      </form>
      <div class="links">
        @if (resetEnabled()) {<a routerLink="/forgot-password">Mot de passe oublié ?</a>}
        @else {<span class="muted">Mot de passe oublié ? Contactez votre administrateur.</span>}
      </div>
    </div>`,
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  loading = signal(false); error = signal(''); show = signal(false);
  resetEnabled = signal(true);
  constructor() { this.auth.config().subscribe({ next: (c) => this.resetEnabled.set(c.passwordResetEnabled), error: () => this.resetEnabled.set(false) }); }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (r) => this.router.navigateByUrl(r.user.mustChangePassword ? '/change-password' : '/'),
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
