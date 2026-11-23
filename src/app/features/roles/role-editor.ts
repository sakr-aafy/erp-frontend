import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { ACTION_LABELS, MODULE_LABELS } from '../../shared/models/permissions';
import { RoleService } from './role.service';

@Component({
  selector: 'app-role-editor',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatCheckboxModule, PageHeader, Skeleton],
  template: `
    <div class="page">
      <app-page-header [title]="id() ? (isSystem() ? 'Rôle système' : 'Modifier le rôle') : 'Nouveau rôle'" subtitle="Cochez les actions autorisées pour chaque module" />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form class="card" [formGroup]="form" (ngSubmit)="save()">
        @if (isSystem()) {<p class="muted">Le rôle Administrateur dispose de toutes les permissions et ne peut pas être modifié.</p>}
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Nom du rôle</mat-label><input matInput formControlName="name" />
            @if (form.controls.name.invalid && form.controls.name.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Description</mat-label><input matInput formControlName="description" /></mat-form-field>
        </div>
        <div class="table-wrap"><table class="matrix">
          <thead><tr><th>Module</th>@for (a of actions(); track a) {<th>{{ label(a) }}</th>}</tr></thead>
          <tbody>@for (m of modules(); track m) {
            <tr><td>{{ moduleLabel(m) }}</td>
              @for (a of actions(); track a) {<td><mat-checkbox [checked]="isSystem() || selected().has(m + ':' + a)" [disabled]="isSystem() || readOnly()" (change)="toggle(m + ':' + a, $event.checked)" [aria-label]="moduleLabel(m) + ' ' + label(a)" /></td>}
            </tr>}</tbody>
        </table></div>
        @if (error()) {<div style="color:var(--danger);margin:12px 0" role="alert">{{ error() }}</div>}
        <div class="toolbar-row" style="margin-top:16px"><span class="spacer"></span><a mat-button routerLink="/roles">Retour</a>
          @if (!isSystem() && !readOnly()) {<button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button>}</div>
      </form>}
    </div>`,
  styles: `.matrix{width:100%;border-collapse:collapse}th,td{padding:6px 12px;text-align:center;border-bottom:1px solid var(--erp-border)}th:first-child,td:first-child{text-align:left}th{font-weight:500;color:var(--muted);font-size:13px}`,
})
export class RoleEditor {
  id = input<string>();
  private svc = inject(RoleService); private router = inject(Router); private toast = inject(ToastService); private auth = inject(AuthService);
  form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, Validators.minLength(2)]], description: [''] });
  modules = signal<string[]>([]); actions = signal<string[]>([]);
  selected = signal(new Set<string>());
  loading = signal(true); saving = signal(false); error = signal(''); isSystem = signal(false);
  readOnly = () => !this.auth.has(this.id() ? 'roles:update' : 'roles:create');
  label = (a: string) => ACTION_LABELS[a] ?? a;
  moduleLabel = (m: string) => MODULE_LABELS[m] ?? m;

  ngOnInit() {
    this.svc.catalog().subscribe((c) => {
      this.modules.set(c.modules); this.actions.set(c.actions);
      const id = this.id();
      if (!id) { this.loading.set(false); return; }
      this.svc.get(id).subscribe({
        next: (r) => { this.form.patchValue({ name: r.name, description: r.description ?? '' }); this.selected.set(new Set(r.permissions)); this.isSystem.set(r.isSystem); this.loading.set(false); },
        error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/roles'); },
      });
    });
  }
  toggle(p: string, on: boolean) { this.selected.update((s) => { const n = new Set(s); on ? n.add(p) : n.delete(p); return n; }); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set('');
    const body = { ...this.form.getRawValue(), permissions: [...this.selected()] };
    const req = this.id() ? this.svc.update(this.id()!, body) : this.svc.create(body);
    req.subscribe({ next: () => { this.toast.success('Rôle enregistré'); this.router.navigateByUrl('/roles'); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } });
  }
}
