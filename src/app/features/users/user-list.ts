import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { confirm } from '../../shared/components/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { RoleDto, UserDto } from '../../shared/models/api.models';
import { ResetPasswordDialog } from './reset-password-dialog';
import { UserFormDialog } from './user-form-dialog';
import { UserService } from './user.service';

@Component({
  selector: 'app-user-list',
  imports: [ReactiveFormsModule, DatePipe, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, Icon, MatMenuModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, PageHeader, EmptyState, Skeleton, HasPermissionDirective],
  template: `
    <div class="page">
      <app-page-header title="Utilisateurs" subtitle="Comptes, rôles et statut d’accès">
        <button mat-flat-button color="primary" *appHasPermission="'users:create'" (click)="openForm()"><app-icon name="add" />Nouvel utilisateur</button>
      </app-page-header>
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" placeholder="Nom, e-mail, identifiant" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); page.set(0); load()"><mat-option value="">Tous</mat-option><mat-option value="active">Actifs</mat-option><mat-option value="inactive">Inactifs</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rôle</mat-label>
            <mat-select [value]="roleId()" (selectionChange)="roleId.set($event.value); page.set(0); load()"><mat-option value="">Tous</mat-option>@for (r of roles(); track r._id) {<mat-option [value]="r._id">{{ r.name }}</mat-option>}</mat-select></mat-form-field>
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="group_off" message="Aucun utilisateur ne correspond aux critères." />}
        @else {
          <div class="table-wrap">
          <table mat-table [dataSource]="items()" matSort (matSortChange)="onSort($event)">
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef mat-sort-header="name">Nom</th><td mat-cell *matCellDef="let u"><strong>{{ u.name }}</strong><br><span class="muted">{{ u.username }}</span></td></ng-container>
            <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef mat-sort-header="email">E-mail</th><td mat-cell *matCellDef="let u">{{ u.email }}</td></ng-container>
            <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef>Rôle</th><td mat-cell *matCellDef="let u">{{ u.roleName }}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let u"><span class="chip" [class.ok]="u.isActive" [class.off]="!u.isActive">{{ u.isActive ? 'Actif' : 'Inactif' }}</span></td></ng-container>
            <ng-container matColumnDef="last"><th mat-header-cell *matHeaderCellDef mat-sort-header="lastLoginAt">Dernière connexion</th><td mat-cell *matCellDef="let u">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let u">
              <ng-container *appHasPermission="'users:update'">
                <button mat-icon-button [matMenuTriggerFor]="m" aria-label="Actions"><app-icon name="more_vert" /></button>
                <mat-menu #m="matMenu">
                  <button mat-menu-item (click)="openForm(u)"><app-icon name="edit" />Modifier</button>
                  <button mat-menu-item (click)="resetPwd(u)"><app-icon name="key" />Réinitialiser le mot de passe</button>
                  <button mat-menu-item (click)="toggle(u)" [disabled]="u.id === auth.user()?.id"><app-icon [name]="u.isActive ? 'block' : 'check_circle'" />{{ u.isActive ? 'Désactiver' : 'Réactiver' }}</button>
                </mat-menu>
              </ng-container></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
})
export class UserList {
  private svc = inject(UserService); private dialog = inject(MatDialog); private toast = inject(ToastService); private destroy = inject(DestroyRef);
  auth = inject(AuthService);
  cols = ['name', 'email', 'role', 'status', 'last', 'actions'];
  items = signal<UserDto[]>([]); total = signal(0); loading = signal(true);
  roles = signal<RoleDto[]>([]);
  page = signal(0); pageSize = signal(20); status = signal(''); roleId = signal(''); sort = signal<string | undefined>(undefined);
  search = new FormControl('', { nonNullable: true });

  constructor() {
    if (this.auth.has('roles:view')) this.svc.roles().subscribe((r) => this.roles.set(r));
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => { this.page.set(0); this.load(); });
    this.load();
  }
  load() {
    this.loading.set(true);
    this.svc.list({ page: this.page() + 1, limit: this.pageSize(), q: this.search.value, status: this.status(), roleId: this.roleId(), sort: this.sort() }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  onSort(s: Sort) { this.sort.set(s.direction ? (s.direction === 'desc' ? '-' : '') + s.active : undefined); this.page.set(0); this.load(); }
  openForm(user?: UserDto) {
    const roles = this.roles();
    if (!roles.length) { this.toast.error('Aucun rôle disponible : créez d’abord un rôle'); return; }
    this.dialog.open(UserFormDialog, { data: { user, roles } }).afterClosed().subscribe((r) => { if (r) { this.toast.success(user ? 'Utilisateur modifié' : 'Utilisateur créé'); this.load(); } });
  }
  resetPwd(u: UserDto) {
    this.dialog.open(ResetPasswordDialog, { data: u }).afterClosed().subscribe((ok) => ok && this.toast.success('Mot de passe réinitialisé'));
  }
  toggle(u: UserDto) {
    confirm(this.dialog, { title: u.isActive ? 'Désactiver le compte' : 'Réactiver le compte', danger: u.isActive,
      message: u.isActive ? `${u.name} perdra immédiatement l’accès au système.` : `${u.name} pourra à nouveau se connecter.`,
      confirmLabel: u.isActive ? 'Désactiver' : 'Réactiver' }).subscribe((ok) => {
      if (!ok) return;
      this.svc.setActive(u.id, !u.isActive).subscribe({ next: () => { this.toast.success('Statut mis à jour'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
    });
  }
}
