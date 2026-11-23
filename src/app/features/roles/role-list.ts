import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from '../../shared/components/icon';
import { MatTableModule } from '@angular/material/table';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { EmptyState } from '../../shared/components/empty-state';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { RoleDto } from '../../shared/models/api.models';
import { RoleService } from './role.service';

@Component({
  selector: 'app-role-list',
  imports: [RouterLink, MatTableModule, MatButtonModule, Icon, PageHeader, EmptyState, Skeleton, HasPermissionDirective],
  template: `
    <div class="page">
      <app-page-header title="Rôles & permissions" subtitle="Permissions par module et par action : consulter, créer, modifier, valider, supprimer">
        <a mat-flat-button color="primary" routerLink="new" *appHasPermission="'roles:create'"><app-icon name="add" />Nouveau rôle</a>
      </app-page-header>
      <div class="card">
        @if (loading()) {<app-skeleton [count]="4" />}
        @else if (!roles().length) {<app-empty-state icon="shield" message="Aucun rôle." />}
        @else {
          <div class="table-wrap"><table mat-table [dataSource]="roles()">
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Rôle</th><td mat-cell *matCellDef="let r"><strong>{{ r.name }}</strong>@if (r.isSystem) {<span class="chip ok" style="margin-left:8px">Système</span>}<br><span class="muted">{{ r.description }}</span></td></ng-container>
            <ng-container matColumnDef="perms"><th mat-header-cell *matHeaderCellDef>Permissions</th><td mat-cell *matCellDef="let r">{{ r.isSystem ? 'Toutes' : r.permissions.length }}</td></ng-container>
            <ng-container matColumnDef="users"><th mat-header-cell *matHeaderCellDef>Utilisateurs</th><td mat-cell *matCellDef="let r">{{ r.userCount }}</td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let r">
              <a mat-icon-button [routerLink]="r._id" aria-label="Ouvrir"><app-icon [name]="r.isSystem ? 'visibility' : 'edit'" /></a>
              @if (!r.isSystem) {<button mat-icon-button *appHasPermission="'roles:delete'" (click)="remove(r)" aria-label="Supprimer"><app-icon name="delete" /></button>}
            </td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
          </table></div>
        }
      </div>
    </div>`,
})
export class RoleList {
  private svc = inject(RoleService); private dialog = inject(MatDialog); private toast = inject(ToastService);
  cols = ['name', 'perms', 'users', 'actions'];
  roles = signal<RoleDto[]>([]); loading = signal(true);
  constructor() { this.load(); }
  load() { this.svc.list().subscribe({ next: (r) => { this.roles.set(r); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); } }); }
  remove(r: RoleDto) {
    confirm(this.dialog, { title: 'Supprimer le rôle', message: `Supprimer définitivement « ${r.name} » ?`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => {
      if (ok) this.svc.remove(r._id).subscribe({ next: () => { this.toast.success('Rôle supprimé'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
    });
  }
}
