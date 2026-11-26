import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { Icon } from '../../shared/components/icon';
import { prompt } from '../../shared/components/prompt-dialog';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { Skeleton } from '../../shared/components/skeleton';
import { CategoryDto } from '../../shared/models/api.models';
import { ProductService } from './product.service';

const noBlank = (c: { value: string }) => (c.value.trim() ? null : { required: true });

interface SubDialogData { families: CategoryDto[]; parentId: string; submit: (name: string, parentId: string) => Observable<unknown> }
/** Ajout d'une sous-catégorie : nom et catégorie parente présélectionnée. */
@Component({
  selector: 'app-subcategory-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, Icon],
  template: `
    <h2 mat-dialog-title>Ajouter une sous-catégorie</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="body">
        @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <mat-form-field appearance="outline"><mat-label>Nom de la sous-catégorie</mat-label><input matInput formControlName="name" maxlength="80" cdkFocusInitial />
          @if (form.controls.name.invalid && form.controls.name.touched) {<mat-error>Nom requis</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Catégorie parente</mat-label><mat-select formControlName="parentId">@for (f of data.families; track f.id) {<mat-option [value]="f.id">{{ f.name }}</mat-option>}</mat-select></mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="busy()"><app-icon name="save" />Enregistrer</button></mat-dialog-actions>
    </form>`,
  styles: `.body{display:flex;flex-direction:column;width:min(420px,84vw);padding-top:8px!important}.err{display:flex;gap:8px;align-items:center;color:var(--danger);background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--r-md);padding:8px 12px;margin-bottom:14px}`,
})
export class SubcategoryDialog {
  data = inject<SubDialogData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<SubcategoryDialog>);
  form = new FormBuilder().nonNullable.group({ name: ['', [Validators.required, noBlank, Validators.maxLength(80)]], parentId: [this.data.parentId, Validators.required] });
  busy = signal(false); error = signal('');
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); this.busy.set(true); this.error.set('');
    this.data.submit(v.name.trim(), v.parentId).subscribe({ next: () => this.ref.close(v.parentId), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

/**
 * Arborescence à deux niveaux des catégories : développer / réduire, nombres réels d'articles, ajout d'une sous-catégorie
 * depuis chaque catégorie, modification, consultation des articles, suppression (si inutilisée) ou archivage.
 */
@Component({
  selector: 'app-category-tree',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon, RowActions, Skeleton],
  template: `
    @if (canCreate) {<form class="add" [formGroup]="form" (ngSubmit)="addFamily()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow"><mat-label>Nouvelle catégorie principale</mat-label><input matInput formControlName="name" maxlength="80" /></mat-form-field>
      <button mat-flat-button color="primary" [disabled]="form.invalid || busy()"><app-icon name="add" />Ajouter</button></form>}
    @if (loading()) {<app-skeleton />}
    @else if (error()) {<div class="state err" role="alert"><app-icon name="error" />{{ error() }}<button mat-button type="button" (click)="load()">Réessayer</button></div>}
    @else if (!families().length) {<div class="state"><app-icon name="category" /><span>Aucune catégorie pour le moment.</span></div>}
    @else {
      <div class="tools"><button mat-button type="button" (click)="expandAll(!allOpen())"><app-icon [name]="allOpen() ? 'expand_less' : 'expand_more'" />{{ allOpen() ? 'Tout réduire' : 'Tout développer' }}</button></div>
      <ul class="tree" aria-label="Catégories et sous-catégories">
        @for (f of families(); track f.id) {
          <li class="family" [class.archived]="f.isArchived">
            <div class="row">
              <button type="button" class="toggle" (click)="toggle(f.id)" [attr.aria-expanded]="isOpen(f.id)" [attr.aria-label]="(isOpen(f.id) ? 'Réduire ' : 'Développer ') + f.name">
                <app-icon [name]="isOpen(f.id) ? 'expand_more' : 'chevron_right'" /></button>
              <span class="name"><strong>{{ f.name }}</strong>
                <span class="meta">{{ f.totalProductCount }} article(s)@if (subs(f.id).length) { · {{ subs(f.id).length }} sous-catégorie(s)@if (f.productCount) { · {{ f.productCount }} direct(s)}}</span></span>
              @if (f.isArchived) {<span class="chip off">Archivée</span>}
              @if (canCreate && !f.isArchived) {<button mat-stroked-button type="button" class="sub-add" (click)="addSub(f)" [attr.aria-label]="'Ajouter une sous-catégorie à ' + f.name"><app-icon name="add" /><span>Ajouter une sous-catégorie</span></button>}
              <app-row-actions [actions]="actionsOf(f)" />
            </div>
            @if (isOpen(f.id)) {
              <ul class="subs">
                @for (s of subs(f.id); track s.id) {
                  <li class="row sub" [class.archived]="s.isArchived"><span class="branch" aria-hidden="true"></span>
                    <span class="name"><span>{{ s.name }}</span><span class="meta">{{ s.productCount }} article(s)</span></span>
                    @if (s.isArchived) {<span class="chip off">Archivée</span>}
                    <app-row-actions [actions]="actionsOf(s)" /></li>
                } @empty {<li class="none">Aucune sous-catégorie.</li>}
              </ul>
            }
          </li>
        }
      </ul>
    }`,
  styles: `:host{display:block}.add{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px}.grow{flex:1 1 220px;min-width:0}.add button{height:52px}
    .tools{display:flex;justify-content:flex-end}ul{list-style:none;margin:0;padding:0}.tree{border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;background:var(--surface)}
    .family+.family{border-top:1px solid var(--border)}.row{display:flex;align-items:center;gap:10px;min-height:56px;padding:6px 8px 6px 6px;flex-wrap:wrap}.family>.row{background:var(--surface-2)}
    .toggle{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:var(--r-md);background:transparent;color:var(--brand);cursor:pointer;flex:none}.toggle:hover{background:var(--brand-50)}.toggle:focus-visible{outline:none;box-shadow:var(--ring)}
    .name{display:flex;flex-direction:column;flex:1;min-width:140px;overflow-wrap:anywhere;line-height:20px}.meta{font-size:12px;color:var(--muted)}.sub-add app-icon{margin-right:4px}
    .subs{border-top:1px solid var(--border)}.sub{min-height:48px;padding-left:28px;flex-wrap:nowrap}.sub+.sub{border-top:1px solid var(--border)}.sub:hover{background:var(--brand-50)}.sub .name{min-width:0}
    .branch{width:14px;height:14px;border-left:2px solid var(--border-strong);border-bottom:2px solid var(--border-strong);border-bottom-left-radius:6px;margin-top:-10px;flex:none}
    .archived .name{color:var(--muted)}.none{padding:12px 16px 12px 52px;font-size:13px;color:var(--muted)}
    .state{display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px 16px;color:var(--muted);text-align:center}.state.err{color:var(--danger)}
    @media (max-width:620px){.sub-add span{display:none}.sub-add{min-width:0;padding:0 10px}.sub-add app-icon{margin:0}.name{min-width:110px}}`,
})
export class CategoryTree {
  /** Ouvrir toutes les catégories au premier chargement. */
  expanded = input(true);
  changed = output<void>();
  /** « Consulter les articles » : la fenêtre appelante peut se fermer avant la navigation. */
  viewed = output<void>();
  private svc = inject(ProductService); private toast = inject(ToastService); private dialog = inject(MatDialog); private auth = inject(AuthService); private router = inject(Router);
  canCreate = this.auth.has('products:create'); canUpdate = this.auth.has('products:update'); canDelete = this.auth.has('products:delete');
  cats = signal<CategoryDto[]>([]); loading = signal(true); error = signal(''); busy = signal(false);
  private open = signal<Set<string>>(new Set()); private first = true;
  form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, noBlank, Validators.maxLength(80)]] });
  families = computed(() => this.cats().filter((c) => !c.parentId).sort((a, b) => Number(a.isArchived) - Number(b.isArchived)));
  subs = (id: string) => this.cats().filter((c) => c.parentId === id);
  isOpen = (id: string) => this.open().has(id);
  allOpen = computed(() => this.families().every((f) => this.open().has(f.id)));
  ngOnInit() { this.load(); }
  load() {
    this.error.set('');
    this.svc.categories().subscribe({
      next: (c) => { this.cats.set(c); this.loading.set(false); if (this.first) { this.first = false; if (this.expanded()) this.expandAll(true); } },
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
  toggle(id: string) { const s = new Set(this.open()); if (!s.delete(id)) s.add(id); this.open.set(s); }
  expandAll(on: boolean) { this.open.set(new Set(on ? this.families().map((f) => f.id) : [])); }
  private refresh() { this.load(); this.changed.emit(); }
  private done = (msg: string) => ({ next: () => { this.toast.success(msg); this.refresh(); }, error: (e: unknown) => this.toast.error(errorMessage(e)) });

  addFamily() {
    if (this.form.invalid) return; this.busy.set(true);
    this.svc.createCategory(this.form.getRawValue().name.trim()).subscribe({
      next: (c) => { this.busy.set(false); this.form.reset({ name: '' }); this.open.set(new Set([...this.open(), c.id])); this.toast.success('Catégorie ajoutée'); this.refresh(); },
      error: (e) => { this.busy.set(false); this.toast.error(errorMessage(e)); },
    });
  }
  addSub(f: CategoryDto) {
    this.dialog.open(SubcategoryDialog, { data: { families: this.families().filter((x) => !x.isArchived), parentId: f.id, submit: (name: string, parentId: string) => this.svc.createCategory(name, parentId) }, maxWidth: '96vw' })
      .afterClosed().subscribe((parentId?: string) => { if (parentId) { this.open.set(new Set([...this.open(), parentId])); this.toast.success('Sous-catégorie ajoutée'); this.refresh(); } });
  }
  rename(c: CategoryDto) {
    prompt(this.dialog, { title: c.parentId ? 'Modifier la sous-catégorie' : 'Modifier la catégorie', label: 'Nom', value: c.name, confirmLabel: 'Enregistrer' })
      .subscribe((n) => n && this.svc.renameCategory(c.id, n).subscribe(this.done(c.parentId ? 'Sous-catégorie modifiée' : 'Catégorie modifiée')));
  }
  view(c: CategoryDto) {
    this.viewed.emit();
    this.router.navigate(['/products'], { queryParams: c.parentId ? { categoryId: c.parentId, subCategoryId: c.id } : { categoryId: c.id } });
  }
  /** Utilisée (articles ou sous-catégories) : seul l'archivage, explicite, est proposé ; sinon suppression confirmée. */
  remove(c: CategoryDto) {
    const children = this.subs(c.id).length; const used = children > 0 || c.productCount > 0;
    const what = [children && `${children} sous-catégorie(s)`, c.productCount && `${c.productCount} article(s)`].filter(Boolean).join(' et ');
    if (used) {
      if (c.isArchived) { this.toast.error(`« ${c.name} » est utilisée (${what}) : elle reste archivée.`); return; }
      confirm(this.dialog, { title: 'Catégorie utilisée', message: `« ${c.name} » est rattachée à ${what} : elle ne peut pas être supprimée. L’archiver${children ? ' (avec ses sous-catégories)' : ''} ? Les articles ne sont pas modifiés ; elle ne sera plus proposée.`, confirmLabel: 'Archiver' })
        .subscribe((ok) => ok && this.svc.archiveCategory(c.id).subscribe(this.done('Catégorie archivée')));
      return;
    }
    confirm(this.dialog, { title: 'Supprimer', message: `Supprimer définitivement « ${c.name} » ?`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.svc.deleteCategory(c.id).subscribe(this.done('Catégorie supprimée')));
  }
  actionsOf(c: CategoryDto): RowAction[] {
    const used = c.productCount > 0 || this.subs(c.id).length > 0;
    return [
      { label: 'Modifier', icon: 'edit', hidden: !this.canUpdate, run: () => this.rename(c) },
      { label: 'Consulter les articles', icon: 'visibility', run: () => this.view(c) },
      { label: 'Archiver', icon: 'archive', hidden: !this.canUpdate || c.isArchived || used, run: () => this.svc.archiveCategory(c.id).subscribe(this.done('Catégorie archivée')) },
      { label: 'Réactiver', icon: 'unarchive', hidden: !this.canUpdate || !c.isArchived, run: () => this.svc.restoreCategory(c.id).subscribe(this.done('Catégorie réactivée')) },
      { label: used ? 'Supprimer ou archiver' : 'Supprimer', icon: 'delete', danger: true, hidden: !this.canDelete || (c.isArchived && used), run: () => this.remove(c) },
    ];
  }
}
