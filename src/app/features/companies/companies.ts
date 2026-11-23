import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { Company } from '../../shared/models/api.models';
import { PASSWORD_HINT, passwordPolicy } from '../auth/password-rules';

@Component({
  selector: 'app-company-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Nouvelle société</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content style="display:flex;flex-direction:column;min-width:min(420px,80vw)">
        @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Raison sociale</mat-label><input matInput formControlName="company" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Nom de l’administrateur</mat-label><input matInput formControlName="adminName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>E-mail de l’administrateur</mat-label><input matInput type="email" formControlName="email" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Mot de passe initial</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password" /><mat-hint>{{ hint }}</mat-hint></mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="loading()">Créer</button></mat-dialog-actions>
    </form>`,
})
export class CompanyDialog {
  private ref = inject(MatDialogRef<CompanyDialog>); private http = inject(HttpClient);
  hint = PASSWORD_HINT;
  form = inject(FormBuilder).nonNullable.group({
    company: ['', [Validators.required, Validators.minLength(2)]], adminName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, passwordPolicy]],
  });
  loading = signal(false); error = signal('');
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const v = this.form.getRawValue();
    this.http.post(`${environment.apiUrl}/companies`, {
      company: { name: v.company }, admin: { name: v.adminName, username: 'admin', email: v.email, password: v.password },
    }).subscribe({ next: () => this.ref.close(true), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}

@Component({
  selector: 'app-companies',
  imports: [MatTableModule, MatButtonModule, Icon, MatSlideToggleModule, PageHeader, Skeleton],
  template: `
    <div class="page">
      <app-page-header title="Sociétés" subtitle="Multi-société : chaque société dispose de ses données, utilisateurs, rôles et paramètres isolés">
        <button mat-flat-button color="primary" (click)="create()"><app-icon name="add" />Nouvelle société</button>
      </app-page-header>
      <div class="card">
        @if (loading()) {<app-skeleton [count]="3" />} @else {
          <div class="table-wrap"><table mat-table [dataSource]="items()">
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Société</th><td mat-cell *matCellDef="let c"><strong>{{ c.name }}</strong></td></ng-container>
            <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Active</th><td mat-cell *matCellDef="let c"><mat-slide-toggle [checked]="c.isActive" [disabled]="c._id === auth.user()?.company?.id" (change)="toggle(c, $event.checked)" /></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
          </table></div>}
      </div>
    </div>`,
})
export class CompaniesPage {
  private http = inject(HttpClient); private dialog = inject(MatDialog); private toast = inject(ToastService);
  auth = inject(AuthService);
  cols = ['name', 'active']; items = signal<Company[]>([]); loading = signal(true);
  constructor() { this.load(); }
  load() { this.http.get<Company[]>(`${environment.apiUrl}/companies`).subscribe({ next: (r) => { this.items.set(r); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); } }); }
  create() { this.dialog.open(CompanyDialog).afterClosed().subscribe((ok) => { if (ok) { this.toast.success('Société créée'); this.load(); } }); }
  toggle(c: Company, isActive: boolean) {
    this.http.patch(`${environment.apiUrl}/companies/${c._id}/active`, { isActive }).subscribe({ next: () => { this.toast.success('Statut mis à jour'); this.load(); }, error: (e) => { this.toast.error(errorMessage(e)); this.load(); } });
  }
}
