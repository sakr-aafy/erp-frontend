import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { Icon } from '../../shared/components/icon';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { Skeleton } from '../../shared/components/skeleton';
import { SupplierCategoryDto } from '../../shared/models/api.models';
import { SupplierService } from './supplier.service';

const noBlank = (c: { value: string }) => (c.value.trim() ? null : { required: true });
const DIALOG = `.body{display:flex;flex-direction:column;width:min(440px,84vw);padding-top:8px!important}.err{display:flex;gap:8px;align-items:center;color:var(--danger);background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--r-md);padding:8px 12px;margin-bottom:14px}p{margin:0 0 14px}`;

interface EditData { category: SupplierCategoryDto; submit: (v: { name: string; description: string | null }) => Observable<unknown> }
@Component({
  selector: 'app-supplier-category-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon],
  template: `
    <h2 mat-dialog-title>Modifier la catégorie</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="body">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Nom de la catégorie</mat-label><input matInput formControlName="name" maxlength="80" cdkFocusInitial />@if (form.controls.name.invalid && form.controls.name.touched) {<mat-error>Nom obligatoire</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Description (facultatif)</mat-label><textarea matInput rows="2" maxlength="300" formControlName="description"></textarea></mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()"><app-icon name="save" />Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: DIALOG,
})
export class SupplierCategoryDialog {
  data = inject<EditData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<SupplierCategoryDialog>);
  form = new FormBuilder().nonNullable.group({ name: [this.data.category.name, [Validators.required, noBlank, Validators.maxLength(80)]], description: [this.data.category.description ?? '', Validators.maxLength(300)] });
  busy = signal(false); error = signal('');
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    this.data.submit({ name: v.name.trim(), description: v.description.trim() || null }).subscribe({ next: () => this.ref.close(true), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

interface ReassignData { category: SupplierCategoryDto; targets: SupplierCategoryDto[]; submit: (target: string) => Observable<unknown> }
/** Suppression d'une catégorie utilisée : les fournisseurs sont d'abord réaffectés (aucun n'est supprimé). */
@Component({
  selector: 'app-supplier-category-reassign',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule, Icon],
  template: `
    <h2 mat-dialog-title>Supprimer une catégorie utilisée</h2>
    <form (submit)="$event.preventDefault(); save()">
      <mat-dialog-content class="body">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <p>« {{ data.category.name }} » est rattachée à <strong>{{ data.category.supplierCount }} fournisseur(s)</strong>. Choisissez leur nouvelle catégorie : aucun fournisseur n’est supprimé.</p>
        @if (data.targets.length) {
          <mat-form-field appearance="outline"><mat-label>Catégorie de réaffectation</mat-label><mat-select [formControl]="target">@for (t of data.targets; track t.id) {<mat-option [value]="t.id">{{ t.name }}</mat-option>}</mat-select></mat-form-field>
        } @else {<p class="muted">Créez ou réactivez d’abord une autre catégorie, ou désactivez celle-ci.</p>}
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy() || !target.value">Réaffecter et supprimer</button></mat-dialog-actions>
    </form>`,
  styles: DIALOG,
})
export class SupplierCategoryReassign {
  data = inject<ReassignData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<SupplierCategoryReassign>);
  target = new FormControl('', { nonNullable: true }); busy = signal(false); error = signal('');
  save() {
    if (!this.target.value) return; this.busy.set(true); this.error.set('');
    this.data.submit(this.target.value).subscribe({ next: () => this.ref.close(true), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

/**
 * Gestion des catégories de fournisseurs (même présentation que les catégories d'articles, sans hiérarchie) : ajout,
 * recherche, modification, désactivation / réactivation, suppression (avec réaffectation si utilisée), nombre réel de fournisseurs.
 */
@Component({
  selector: 'app-supplier-category-manager',
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon, RowActions, Skeleton],
  template: `
    @if (canCreate) {<form class="add" [formGroup]="form" (ngSubmit)="add()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow"><mat-label>Nouvelle catégorie</mat-label><input matInput formControlName="name" maxlength="80" /></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow"><mat-label>Description (facultatif)</mat-label><input matInput formControlName="description" maxlength="300" /></mat-form-field>
      <button mat-flat-button color="primary" [disabled]="form.invalid || busy()"><app-icon name="add" />Ajouter</button></form>}
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search"><mat-label>Rechercher une catégorie</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" /></mat-form-field>
    @if (loading()) {<app-skeleton />}
    @else if (error()) {<div class="state err" role="alert"><app-icon name="error" />{{ error() }}<button mat-button type="button" (click)="load()">Réessayer</button></div>}
    @else if (!items().length) {<div class="state"><app-icon name="category" /><span>{{ search.value ? 'Aucune catégorie ne correspond.' : 'Aucune catégorie pour le moment.' }}</span></div>}
    @else {
      <ul class="list" aria-label="Catégories de fournisseurs">
        @for (c of items(); track c.id) {
          <li class="row" [class.off]="!c.isActive">
            <span class="tile"><app-icon name="category" /></span>
            <span class="name"><strong>{{ c.name }}</strong>@if (c.description) {<span class="desc">{{ c.description }}</span>}
              <span class="meta">{{ c.supplierCount }} fournisseur(s)@if (c.createdAt) { · créée le {{ c.createdAt | date: 'dd/MM/yyyy' }}}@if (c.updatedAt && c.updatedAt !== c.createdAt) { · modifiée le {{ c.updatedAt | date: 'dd/MM/yyyy' }}}</span></span>
            <span class="chip" [class.ok]="c.isActive" [class.off]="!c.isActive">{{ c.isActive ? 'Active' : 'Désactivée' }}</span>
            <app-row-actions [actions]="actionsOf(c)" />
          </li>}
      </ul>
    }
    @if (unclassified()) {<button type="button" class="unclassified" (click)="viewUnclassified()"><app-icon name="info" />{{ unclassified() }} fournisseur(s) non classé(s) — à classer depuis leur fiche</button>}`,
  styles: `:host{display:block}.add{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px;padding:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg)}.grow{flex:1 1 200px;min-width:0}.add button{height:52px}.search{width:100%;margin-bottom:12px}
    .list{list-style:none;margin:0;padding:0;border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;background:var(--surface)}.row{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 8px 8px 14px}.row+.row{border-top:1px solid var(--border)}.row:hover{background:var(--brand-50)}
    .tile{display:grid;place-items:center;width:38px;height:38px;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);flex:none}.name{display:flex;flex-direction:column;flex:1;min-width:0;overflow-wrap:anywhere;line-height:20px}.desc{font-size:13px;color:var(--text-2)}.meta{font-size:12px;color:var(--muted)}.off .name strong{color:var(--muted)}
    .state{display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px 16px;color:var(--muted);text-align:center}.state.err{color:var(--danger)}
    .unclassified{display:flex;gap:8px;align-items:center;width:100%;margin-top:12px;padding:10px 14px;border:1px solid var(--accent-300);border-radius:var(--r-md);background:var(--accent-50);font:inherit;text-align:left;cursor:pointer}
    @media (max-width:560px){.row{flex-wrap:wrap}.name{flex-basis:calc(100% - 100px)}.add button{width:100%}}`,
})
export class SupplierCategoryManager {
  changed = output<void>(); viewed = output<void>();
  private svc = inject(SupplierService); private toast = inject(ToastService); private dialog = inject(MatDialog); private auth = inject(AuthService); private router = inject(Router); private destroy = inject(DestroyRef);
  canCreate = this.auth.has('suppliers:create'); canUpdate = this.auth.has('suppliers:update'); canDelete = this.auth.has('suppliers:delete');
  all = signal<SupplierCategoryDto[]>([]); unclassified = signal(0); loading = signal(true); error = signal(''); busy = signal(false); private term = signal('');
  search = new FormControl('', { nonNullable: true });
  items = computed(() => { const q = this.term().trim().toLowerCase(); return this.all().filter((c) => !q || c.name.toLowerCase().includes(q)); });
  form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, noBlank, Validators.maxLength(80)]], description: ['', Validators.maxLength(300)] });
  ngOnInit() { this.search.valueChanges.pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe((v) => this.term.set(v)); this.load(); }
  load() {
    this.error.set('');
    this.svc.categories().subscribe({ next: (r) => { this.all.set(r.items); this.unclassified.set(r.unclassifiedCount); this.loading.set(false); }, error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
  private refresh() { this.load(); this.changed.emit(); }
  private done = (msg: string) => ({ next: () => { this.toast.success(msg); this.refresh(); }, error: (e: unknown) => this.toast.error(errorMessage(e)) });
  add() {
    if (this.form.invalid) return; this.busy.set(true); const v = this.form.getRawValue();
    this.svc.createCategory({ name: v.name.trim(), ...(v.description.trim() && { description: v.description.trim() }) }).subscribe({
      next: () => { this.busy.set(false); this.form.reset({ name: '', description: '' }); this.toast.success('Catégorie ajoutée'); this.refresh(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
  edit(c: SupplierCategoryDto) {
    this.dialog.open(SupplierCategoryDialog, { data: { category: c, submit: (v: { name: string; description: string | null }) => this.svc.updateCategory(c.id, v) }, maxWidth: '96vw' })
      .afterClosed().subscribe((ok) => { if (ok) { this.toast.success('Catégorie modifiée'); this.refresh(); } });
  }
  remove(c: SupplierCategoryDto) {
    if (c.supplierCount) {
      this.dialog.open(SupplierCategoryReassign, { data: { category: c, targets: this.all().filter((x) => x.id !== c.id && x.isActive), submit: (t: string) => this.svc.removeCategory(c.id, t) }, maxWidth: '96vw' })
        .afterClosed().subscribe((ok) => { if (ok) { this.toast.success('Fournisseurs réaffectés, catégorie supprimée'); this.refresh(); } });
      return;
    }
    confirm(this.dialog, { title: 'Supprimer la catégorie', message: `Supprimer définitivement « ${c.name} » ?`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.svc.removeCategory(c.id).subscribe(this.done('Catégorie supprimée')));
  }
  view(c: SupplierCategoryDto) { this.viewed.emit(); this.router.navigate(['/suppliers'], { queryParams: { categoryId: c.id } }); }
  viewUnclassified() { this.viewed.emit(); this.router.navigate(['/suppliers'], { queryParams: { categoryId: 'none' } }); }
  actionsOf(c: SupplierCategoryDto): RowAction[] {
    return [
      { label: 'Modifier', icon: 'edit', hidden: !this.canUpdate, run: () => this.edit(c) },
      { label: 'Consulter les fournisseurs', icon: 'visibility', run: () => this.view(c) },
      { label: 'Désactiver', icon: 'archive', hidden: !this.canUpdate || !c.isActive, run: () => this.svc.setCategoryActive(c.id, false).subscribe(this.done('Catégorie désactivée')) },
      { label: 'Réactiver', icon: 'unarchive', hidden: !this.canUpdate || c.isActive, run: () => this.svc.setCategoryActive(c.id, true).subscribe(this.done('Catégorie réactivée')) },
      { label: 'Supprimer', icon: 'delete', danger: true, hidden: !this.canDelete, run: () => this.remove(c) },
    ];
  }
}

/** Gestion rapide depuis le formulaire fournisseur. */
@Component({
  selector: 'app-supplier-categories-window',
  imports: [MatDialogModule, MatButtonModule, Icon, SupplierCategoryManager],
  template: `
    <header class="head"><span class="badge"><app-icon name="category" /></span><div><h2 mat-dialog-title>Catégories de fournisseurs</h2><p>Classez vos fournisseurs selon votre activité.</p></div></header>
    <mat-dialog-content><app-supplier-category-manager (viewed)="close()" /></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-stroked-button mat-dialog-close>Fermer</button></mat-dialog-actions>`,
  styles: `:host{display:block;max-width:100%}.head{display:flex;align-items:center;gap:14px;padding:20px 24px 8px}.badge{display:grid;place-items:center;width:44px;height:44px;border-radius:var(--r-lg);background:var(--brand-50);color:var(--brand);flex:none}
    h2{margin:0!important;padding:0!important;font-size:18px;font-weight:600}p{margin:2px 0 0;font-size:13px;color:var(--muted)}mat-dialog-content{padding:12px 24px 4px!important}mat-dialog-actions{padding:12px 24px 20px!important}@media (max-width:560px){.head{padding:16px 16px 4px}mat-dialog-content{padding:10px 16px 4px!important}}`,
})
export class SupplierCategoriesWindow { private ref = inject(MatDialogRef<SupplierCategoriesWindow>); close() { this.ref.close(); } }
export const openSupplierCategories = (d: MatDialog): Observable<unknown> => d.open(SupplierCategoriesWindow, { width: '760px', maxWidth: '94vw', autoFocus: 'dialog' }).afterClosed();
