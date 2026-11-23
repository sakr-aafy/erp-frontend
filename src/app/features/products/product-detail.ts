import { Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ProductDto, SerialDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { prompt } from '../../shared/components/prompt-dialog';
import { ProductService } from './product.service';

const STATUS: Record<string, string> = { available: 'Disponible', sold: 'Vendu', returned: 'Retourné', scrapped: 'Rebut' };

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, ReactiveFormsModule, MatButtonModule, Icon, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, PageHeader, Skeleton, HasPermissionDirective, MoneyPipe],
  template: `
    <div class="page">
      @if (!p()) {<div class="card"><app-skeleton /></div>} @else {
      <app-page-header [title]="p()!.name" [subtitle]="p()!.reference + (p()!.isActive ? '' : ' — DÉSACTIVÉ')">
        <ng-container *appHasPermission="'products:update'"><a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>
          <button mat-stroked-button (click)="toggle()"><app-icon [name]="p()!.isActive ? 'block' : 'check_circle'" />{{ p()!.isActive ? 'Désactiver' : 'Réactiver' }}</button></ng-container>
        <button mat-stroked-button *appHasPermission="'products:create'" (click)="duplicate()"><app-icon name="content_copy" />Dupliquer</button>
        <button mat-stroked-button color="warn" *appHasPermission="'products:delete'" (click)="remove()"><app-icon name="delete" />Supprimer</button>
      </app-page-header>
      @if (p()!.belowCost) {<div class="card warn"><app-icon name="warning" /> Le prix de vente est inférieur au coût de revient.</div>}
      <div class="kpis">
        <div class="card"><span class="muted">Prix d’achat</span><strong>{{ p()!.purchasePriceMinor | money }}</strong></div>
        <div class="card"><span class="muted">Coût de revient</span><strong>{{ p()!.effectiveCostMinor | money }}</strong><small class="muted">{{ p()!.costPriceMinor === null ? 'basé sur le prix d’achat' : 'module Coût de revient' }}</small></div>
        <div class="card"><span class="muted">Prix de vente</span><strong>{{ p()!.salePriceMinor | money }}</strong></div>
        <div class="card"><span class="muted">Marge</span><strong [style.color]="p()!.belowCost ? 'var(--danger)' : null">{{ p()!.marginMinor | money }}</strong>
          <small class="muted">{{ p()!.marginRatePct ?? '—' }} % du coût · {{ p()!.markPct ?? '—' }} % du prix de vente</small></div>
      </div>
      <div class="card"><h3>Informations</h3><dl>
        <dt>Type</dt><dd>{{ p()!.kind === 'service' ? 'Service' : 'Produit' }}</dd><dt>Catégorie</dt><dd>{{ p()!.categoryName || '—' }}</dd><dt>Unité</dt><dd>{{ p()!.unitCode }}</dd>
        <dt>Taux de TVA</dt><dd>{{ p()!.vatRateCode }}</dd><dt>Stock minimum</dt><dd>{{ p()!.minStock }}</dd><dt>Fournisseur principal</dt><dd>{{ p()!.mainSupplierName || '—' }}</dd>
        <dt>Numéros de série</dt><dd>{{ p()!.hasSerial ? 'Oui' : 'Non' }}</dd><dt>Description</dt><dd>{{ p()!.description || '—' }}</dd></dl></div>
      @if (p()!.hasSerial) {
        <div class="card" style="margin-top:16px"><h3>Numéros de série ({{ total() }})</h3>
          <div *appHasPermission="'products:update'" class="serial-add">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="flex:1;min-width:240px"><mat-label>Ajouter des numéros (un par ligne)</mat-label><textarea matInput rows="3" [formControl]="newSerials"></textarea></mat-form-field>
            <button mat-flat-button color="primary" (click)="addSerials()" [disabled]="newSerials.invalid">Ajouter</button></div>
          @if (!serials().length) {<p class="muted">Aucun numéro de série enregistré.</p>} @else {
          <div class="table-wrap"><table mat-table [dataSource]="serials()">
            <ng-container matColumnDef="sn"><th mat-header-cell *matHeaderCellDef>Numéro de série</th><td mat-cell *matCellDef="let s">{{ s.serialNumber }}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let s">{{ statusLabel(s.status) }}</td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let s">
              @if (s.status === 'available') {<button mat-icon-button *appHasPermission="'products:update'" (click)="removeSerial(s)" aria-label="Supprimer"><app-icon name="delete" /></button>}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="['sn','status','actions']"></tr><tr mat-row *matRowDef="let r; columns: ['sn','status','actions']"></tr></table></div>}
          <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" (page)="onPage($event)" hidePageSize />
        </div>}
      }
    </div>`,
  styles: `.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:16px}.kpis .card{display:flex;flex-direction:column;gap:6px}.kpis strong{font-size:20px}
    h3{margin:0 0 12px;font-size:16px}dl{margin:0;display:grid;grid-template-columns:170px 1fr;gap:8px}dt{color:var(--muted)}dd{margin:0}
    .warn{background:var(--accent-50);border-color:var(--accent-300);margin-bottom:16px;display:flex;gap:8px;align-items:center}.serial-add{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}`,
})
export class ProductDetail {
  id = input.required<string>();
  private svc = inject(ProductService); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router);
  p = signal<ProductDto | null>(null); serials = signal<SerialDto[]>([]); total = signal(0); page = signal(0);
  newSerials = new FormControl('', { nonNullable: true, validators: Validators.required });
  statusLabel = (s: string) => STATUS[s] ?? s;
  ngOnInit() { this.load(); }
  load() {
    this.svc.get(this.id()).subscribe({
      next: (p) => { this.p.set(p); if (p.hasSerial) this.loadSerials(); },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/products'); },
    });
  }
  loadSerials() { this.svc.serials(this.id(), this.page() + 1, 20).subscribe((r) => { this.serials.set(r.items); this.total.set(r.total); }); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.loadSerials(); }
  addSerials() {
    const list = this.newSerials.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    this.svc.addSerials(this.id(), list).subscribe({ next: (r) => { this.toast.success(`${r.added} numéro(s) ajouté(s)`); this.newSerials.reset(''); this.loadSerials(); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  removeSerial(s: SerialDto) {
    confirm(this.dialog, { title: 'Supprimer le numéro de série', message: s.serialNumber, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok &&
      this.svc.removeSerial(this.id(), s.id).subscribe({ next: () => { this.toast.success('Supprimé'); this.loadSerials(); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
  toggle() { this.svc.setActive(this.id(), !this.p()!.isActive).subscribe({ next: (p) => { this.p.set({ ...this.p()!, ...p }); this.toast.success('Statut mis à jour'); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  duplicate() {
    prompt(this.dialog, { title: 'Dupliquer l’article', label: 'Nouvelle référence (unique)', confirmLabel: 'Dupliquer' }).subscribe((ref) => {
      if (ref) this.svc.duplicate(this.id(), ref).subscribe({ next: (n) => { this.toast.success('Article dupliqué'); this.router.navigate(['/products', n.id, 'edit']); }, error: (e) => this.toast.error(errorMessage(e)) });
    });
  }
  remove() {
    confirm(this.dialog, { title: 'Supprimer l’article', message: `Supprimer définitivement « ${this.p()!.name} » ? Préférez la désactivation si l’article a déjà servi.`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok &&
      this.svc.remove(this.id()).subscribe({ next: () => { this.toast.success('Article supprimé'); this.router.navigateByUrl('/products'); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
