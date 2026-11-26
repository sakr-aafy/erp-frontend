import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { UnitDto } from '../../shared/models/api.models';
import { CategoryTree } from './category-tree';
import { prompt } from '../../shared/components/prompt-dialog';
import { ProductService, unitCodeFor } from './product.service';

@Component({
  selector: 'app-catalog',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, PageHeader, CategoryTree],
  template: `
    <div class="page">
      <app-page-header title="Catégories & unités" subtitle="Catégories, sous-catégories et unités de mesure du catalogue"><a mat-stroked-button routerLink="/products"><app-icon name="arrow_back" />Articles</a></app-page-header>
      <div class="cols">
        <section class="card"><h3>Catégories et sous-catégories</h3><app-category-tree /></section>
        <div class="card"><h3>Unités de mesure</h3>
          @if (canCreate) {<form class="add" [formGroup]="unitForm" (ngSubmit)="addUnit()">
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Nom de l’unité</mat-label><input matInput formControlName="name" placeholder="ex. Pièce, Kilogramme, Litre" /></mat-form-field>
            <button mat-flat-button color="primary" [disabled]="unitForm.invalid">Ajouter</button></form>}
          @for (u of units(); track u.id) {
            <div class="item"><span>{{ u.name }}</span><span class="spacer"></span>
              @if (canUpdate) {<button mat-icon-button (click)="editUnit(u)" aria-label="Renommer"><app-icon name="edit" /></button>}
              @if (canDelete) {<button mat-icon-button (click)="removeUnit(u)" aria-label="Supprimer"><app-icon name="delete" /></button>}</div>
          } @empty {<p class="muted">Aucune unité. Créez au moins une unité (ex. PCE) avant d’ajouter des articles.</p>}
        </div>
      </div>
    </div>`,
  styles: `.cols{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start}@media (max-width:1100px){.cols{grid-template-columns:minmax(0,1fr)}}h3{margin:0 0 12px;font-size:16px}.add{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
    .item{display:flex;align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid var(--erp-border)}.spacer{flex:1}`,
})
export class CatalogPage {
  private svc = inject(ProductService); private toast = inject(ToastService); private dialog = inject(MatDialog); private auth = inject(AuthService);
  canCreate = this.auth.has('products:create'); canUpdate = this.auth.has('products:update'); canDelete = this.auth.has('products:delete');
  units = signal<UnitDto[]>([]);
  private fb = inject(FormBuilder);
  unitForm = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(60)]] });
  constructor() { this.load(); }
  load() { this.svc.units().subscribe((u) => this.units.set(u)); }
  private done = (msg: string) => ({ next: () => { this.toast.success(msg); this.load(); }, error: (e: unknown) => this.toast.error(errorMessage(e)) });
  addUnit() {
    if (this.unitForm.invalid) return;
    const name = this.unitForm.getRawValue().name.trim();
    if (this.units().some((u) => u.name.trim().toLowerCase() === name.toLowerCase())) { this.toast.error('Cette unité existe déjà'); return; }
    this.svc.createUnit(unitCodeFor(name, this.units()), name).subscribe({ next: () => { this.unitForm.reset({ name: '' }); this.toast.success('Unité ajoutée'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  editUnit(u: UnitDto) { prompt(this.dialog, { title: 'Renommer l’unité', label: 'Nom de l’unité', value: u.name }).subscribe((n) => n && this.svc.updateUnit(u.id, { name: n }).subscribe(this.done('Unité modifiée'))); }
  removeUnit(u: UnitDto) { confirm(this.dialog, { title: 'Supprimer l’unité', message: `Supprimer « ${u.name} » ?`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.svc.deleteUnit(u.id).subscribe(this.done('Unité supprimée'))); }
}
