import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RowAction, RowActions } from '../../../shared/components/row-actions';
import { Icon } from '../../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../../core/services/api.service';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';

@Component({
  selector: 'app-warehouse-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule],
  template: `<h2 mat-dialog-title>{{ data ? 'Modifier le magasin' : 'Nouveau magasin' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()"><mat-dialog-content style="display:flex;flex-direction:column;min-width:min(420px,84vw)">
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      <mat-form-field appearance="outline"><mat-label>Code</mat-label><input matInput formControlName="code" />@if (form.controls.code.invalid && form.controls.code.touched) {<mat-error>Requis (lettres, chiffres, . _ -)</mat-error>}</mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Nom</mat-label><input matInput formControlName="name" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Adresse</mat-label><input matInput formControlName="address" /></mat-form-field>
      <mat-slide-toggle formControlName="isDefault">Magasin par défaut</mat-slide-toggle></mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary">Enregistrer</button></mat-dialog-actions></form>`,
})
export class WarehouseDialog {
  data = inject<{ id: string; code: string; name: string; address: string | null; isDefault: boolean } | null>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<WarehouseDialog>); private api = inject(Api);
  form = new FormBuilder().nonNullable.group({ code: [this.data?.code ?? '', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]+$/)]], name: [this.data?.name ?? '', [Validators.required, Validators.minLength(2)]], address: [this.data?.address ?? ''], isDefault: [this.data?.isDefault ?? false] });
  error = signal('');
  save() { if (this.form.invalid) { this.form.markAllAsTouched(); return; } const v = this.form.getRawValue(); const body = { ...v, address: v.address || undefined };
    (this.data ? this.api.put(`/warehouses/${this.data.id}`, body) : this.api.post('/warehouses', body)).subscribe({ next: (w) => this.ref.close(w), error: (e) => this.error.set(errorMessage(e)) }); }
}

@Component({
  selector: 'app-warehouses',
  imports: [RouterLink, RowActions, MatTableModule, MatButtonModule, Icon, PageHeader],
  template: `<div class="page"><app-page-header title="Magasins" subtitle="Multi-magasins : chaque article a un niveau et une valorisation par magasin"><a mat-stroked-button routerLink="/stock"><app-icon name="arrow_back" />Stock</a>
      @if (auth.has('inventory:create')) {<button mat-flat-button color="primary" (click)="open()"><app-icon name="add" />Nouveau magasin</button>}</app-page-header>
    <div class="card"><div class="table-wrap"><table mat-table [dataSource]="items()">
      <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Code</th><td mat-cell *matCellDef="let w"><strong>{{ w.code }}</strong>@if (w.isDefault) {<span class="chip ok" style="margin-left:6px">Par défaut</span>}</td></ng-container>
      <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Nom</th><td mat-cell *matCellDef="let w">{{ w.name }}<br><span class="muted">{{ w.address }}</span></td></ng-container>
      <ng-container matColumnDef="st"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let w"><span class="chip" [class.ok]="w.isActive" [class.off]="!w.isActive">{{ w.isActive ? 'Actif' : 'Inactif' }}</span></td></ng-container>
      <ng-container matColumnDef="act"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let w" class="r"><app-row-actions [actions]="acts(w)" /></td></ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div></div></div>`,
})
export class Warehouses {
  acts = (w: { isActive: boolean; isDefault?: boolean }): RowAction[] => [{ label: 'Modifier', icon: 'edit', run: () => this.open(w), hidden: !this.auth.has('inventory:update') },
    { label: w.isActive ? 'Désactiver' : 'Réactiver', icon: w.isActive ? 'block' : 'check_circle', run: () => this.toggle(w as never), hidden: !this.auth.has('inventory:update') },
    { label: 'Supprimer', icon: 'delete', danger: true, run: () => this.remove(w as never), hidden: !this.auth.has('inventory:delete') }];
  private api = inject(Api); private dialog = inject(MatDialog); private toast = inject(ToastService); auth = inject(AuthService);
  cols = ['code', 'name', 'st', 'act']; items = signal<any[]>([]);  
  ngOnInit() { this.load(); } load() { this.api.get('/warehouses').subscribe((w) => this.items.set(w)); }
  open(w?: unknown) { this.dialog.open(WarehouseDialog, { data: w ?? null }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Magasin enregistré'); this.load(); } }); }
  toggle(w: { id: string; isActive: boolean }) { this.api.patch(`/warehouses/${w.id}/active`, { isActive: !w.isActive }).subscribe({ next: () => { this.toast.success('Statut mis à jour'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  remove(w: { id: string; code: string }) { confirm(this.dialog, { title: 'Supprimer le magasin', message: `Supprimer « ${w.code} » ? Impossible si des mouvements existent.`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/warehouses/${w.id}`).subscribe({ next: () => { this.toast.success('Magasin supprimé'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}
