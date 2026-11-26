import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { Icon } from '../../shared/components/icon';
import { prompt } from '../../shared/components/prompt-dialog';
import { UnitDto } from '../../shared/models/api.models';
import { CategoryTree } from './category-tree';
import { ProductService, unitCodeFor } from './product.service';

export interface CatalogDialogData { kind: 'category' | 'unit' }

/** Gestion rapide des catégories ou des unités de mesure (ajout, modification, suppression) depuis le formulaire d'article. */
@Component({
  selector: 'app-catalog-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon, CategoryTree],
  template: `
    <header class="head">
      <span class="badge"><app-icon [name]="data.kind === 'category' ? 'category' : 'straighten'" /></span>
      <div><h2 mat-dialog-title>{{ data.kind === 'category' ? 'Catégories' : 'Unités de mesure' }}</h2>
        <p class="desc">{{ data.kind === 'category' ? 'Organisez votre catalogue en catégories et sous-catégories.' : 'Définissez les unités utilisées pour vos articles (pièce, kg, litre…).' }}</p></div>
      @if (data.kind === 'unit') {<span class="count">{{ units().length }}</span>}
    </header>
    <mat-dialog-content>
      @if (data.kind === 'category') {
        <app-category-tree (viewed)="close()" />
      } @else {
        @if (canCreate) {<form class="add" [formGroup]="unitForm" (ngSubmit)="addUnit()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow"><mat-label>Nom de l’unité</mat-label><input matInput formControlName="name" placeholder="ex. Pièce, Kilogramme, Litre" /></mat-form-field>
          <button mat-flat-button color="primary" [disabled]="unitForm.invalid"><app-icon name="add" />Ajouter</button></form>}
        <div class="list">
          @for (u of units(); track u.id) {
            <div class="row"><app-icon name="straighten" class="lead" /><span>{{ u.name }}</span><span class="spacer"></span>
              @if (canUpdate) {<button mat-icon-button class="act" type="button" (click)="editUnit(u)" aria-label="Modifier {{ u.name }}"><app-icon name="edit" /></button>}
              @if (canDelete) {<button mat-icon-button class="act del" type="button" (click)="removeUnit(u)" aria-label="Supprimer {{ u.name }}"><app-icon name="delete" /></button>}</div>
          } @empty {<div class="empty"><app-icon name="straighten" /><p>Aucune unité. Créez-en une (ex. PCE) avant d’ajouter des articles.</p></div>}
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-stroked-button mat-dialog-close>Fermer</button></mat-dialog-actions>`,
  styles: `
    :host{display:block;box-sizing:border-box;max-width:100%}*{box-sizing:border-box}
    .head{display:flex;align-items:center;gap:14px;padding:20px 24px 8px}
    .badge{display:grid;place-items:center;width:44px;height:44px;border-radius:var(--r-lg);background:var(--brand-50);color:var(--brand);flex:none}
    h2{margin:0!important;padding:0!important;font-size:18px;font-weight:600;color:var(--text)}
    .desc{margin:2px 0 0;font-size:13px;color:var(--muted)}.head>div{min-width:0;flex:1}
    .count{flex:none;align-self:flex-start;min-width:28px;text-align:center;padding:2px 10px;border-radius:999px;background:var(--accent-100);color:var(--brand-900);font-size:12px;font-weight:600}
    mat-dialog-content{padding:12px 24px 4px!important;overflow-x:hidden}
    .add{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:14px;margin-bottom:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg)}
    .grow{flex:1 1 150px;min-width:0}.code{flex:0 0 110px}.add{align-items:flex-start}.add button{flex:none;height:56px}
    .list{border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;max-height:min(380px,48vh);overflow-y:auto;background:var(--surface)}
    .row{display:flex;align-items:center;gap:10px;min-height:52px;padding:4px 8px 4px 16px;border-bottom:1px solid var(--border);transition:background var(--t-fast) var(--ease)}
    .row:last-child{border-bottom:0}.row:hover{background:var(--surface-2)}
    .fam{background:var(--surface-2)}.fam strong{color:var(--text)}.lead{color:var(--brand);--icon-size:1.1rem}
    .sub{padding-left:40px}.branch{width:12px;height:12px;border-left:2px solid var(--border-strong);border-bottom:2px solid var(--border-strong);border-bottom-left-radius:6px;margin-top:-8px;flex:none}
    .pill{flex:none;white-space:nowrap;padding:1px 8px;border-radius:999px;background:#f2f4f7;color:var(--muted);font-size:12px}
    .row>strong,.row>span:not(.pill):not(.spacer):not(.branch):not(.tile){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .row .act,.row .lead,.row .tile{flex:none}
    @media (max-width:560px){.head{padding:16px 16px 4px;gap:10px}.badge{width:38px;height:38px}mat-dialog-content{padding:10px 16px 4px!important}.add{padding:12px}.add button{width:100%;height:48px}.code{flex:1 1 100%}.row{padding:4px 2px 4px 12px;gap:6px}.sub{padding-left:22px}.act{width:36px;height:36px;padding:6px}mat-dialog-actions{padding:10px 16px 16px!important}}
    .tile{min-width:44px;text-align:center;padding:4px 8px;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);font-weight:600;font-size:13px}
    .spacer{flex:1}
    .act{color:var(--muted);opacity:.75;transition:opacity var(--t-fast),color var(--t-fast)}.row:hover .act,.act:focus-visible{opacity:1}.act:hover{color:var(--brand)}.act.del:hover{color:var(--danger)}
    .empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:36px 16px;color:var(--muted);text-align:center;--icon-size:1.8rem}.empty p{margin:0}
    mat-dialog-actions{padding:12px 24px 20px!important}`,
})
export class CatalogDialog {
  data = inject<CatalogDialogData>(MAT_DIALOG_DATA);
  private svc = inject(ProductService); private toast = inject(ToastService); private dialog = inject(MatDialog); private auth = inject(AuthService); private fb = inject(FormBuilder);
  canCreate = this.auth.has('products:create'); canUpdate = this.auth.has('products:update'); canDelete = this.auth.has('products:delete');
  units = signal<UnitDto[]>([]);
  unitForm = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(60)]] });
  private ref = inject(MatDialogRef<CatalogDialog>);
  constructor() { this.load(); }
  load() { if (this.data.kind === 'unit') this.svc.units().subscribe((u) => this.units.set(u)); }
  close() { this.ref.close(); }
  private done = (msg: string) => ({ next: () => { this.toast.success(msg); this.load(); }, error: (e: unknown) => this.toast.error(errorMessage(e)) });
  addUnit() {
    if (this.unitForm.invalid) return; const name = this.unitForm.getRawValue().name.trim();
    if (this.units().some((u) => u.name.trim().toLowerCase() === name.toLowerCase())) { this.toast.error('Cette unité existe déjà'); return; }
    this.svc.createUnit(unitCodeFor(name, this.units()), name).subscribe({ next: () => { this.unitForm.reset({ name: '' }); this.toast.success('Unité ajoutée'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  editUnit(u: UnitDto) { prompt(this.dialog, { title: 'Modifier l’unité', label: 'Nom de l’unité', value: u.name }).subscribe((n) => n && this.svc.updateUnit(u.id, { name: n }).subscribe(this.done('Unité modifiée'))); }
  removeUnit(u: UnitDto) { confirm(this.dialog, { title: 'Supprimer l’unité', message: `Supprimer « ${u.name} » ?`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.svc.deleteUnit(u.id).subscribe(this.done('Unité supprimée'))); }
}
export const openCatalog = (d: MatDialog, kind: CatalogDialogData['kind']): Observable<unknown> => d.open(CatalogDialog, { data: { kind }, width: kind === 'category' ? '760px' : '640px', maxWidth: '94vw', autoFocus: 'dialog' }).afterClosed();
