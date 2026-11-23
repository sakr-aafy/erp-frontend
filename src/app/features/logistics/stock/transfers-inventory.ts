import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../../core/services/api.service';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';
import { Skeleton } from '../../../shared/components/skeleton';
import { LineGroup, LinesEditor, lineGroup } from '../lines-editor';

/** Transfert entre magasins : validation = sortie + entrée dans une seule transaction. */
@Component({
  selector: 'app-transfer-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, PageHeader, Skeleton, LinesEditor],
  template: `
    <div class="page"><app-page-header [title]="id() ? 'Modifier le transfert' : 'Nouveau transfert'" subtitle="Le stock est déplacé à la validation, à la valeur exacte du magasin source." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card" style="color:var(--danger);margin-bottom:16px" role="alert">{{ error() }}</div>}
        <div class="card" style="margin-bottom:16px"><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Magasin source</mat-label><mat-select formControlName="from">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Magasin destinataire</mat-label><mat-select formControlName="to">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" /></mat-form-field></div></div>
        <div class="card" style="margin-bottom:16px"><h3 style="margin:0 0 12px;font-size:16px">Articles</h3><app-lines-editor [array]="lines" [opts]="{ serials: true }" /></div>
        <div class="card" style="margin-bottom:16px"><mat-form-field appearance="outline" style="width:100%"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button routerLink="/stock-transfers">Annuler</a><button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}</div>`,
})
export class TransferForm {
  id = input<string>(); private api = inject(Api); private fb = inject(FormBuilder); private router = inject(Router); private toast = inject(ToastService);
  lines: FormArray<LineGroup> = this.fb.array<LineGroup>([]); warehouses = signal<{ id: string; code: string; name: string }[]>([]);
  form = this.fb.nonNullable.group({ from: ['', Validators.required], to: ['', Validators.required], date: [new Date().toISOString().slice(0, 10)], notes: [''], lines: this.lines });
  loading = signal(false); saving = signal(false); error = signal('');
  ngOnInit() {
    this.api.get('/warehouses').subscribe((w) => this.warehouses.set(w.filter((x: { isActive: boolean }) => x.isActive))); const id = this.id(); if (!id) return; this.loading.set(true);
    this.api.get(`/stock-transfers/${id}`).subscribe({ next: (t) => { if (!t.editable) { this.router.navigate(['/stock-transfers', id]); return; } this.form.patchValue({ from: t.fromWarehouseId, to: t.toWarehouseId, date: t.date?.slice(0, 10), notes: t.notes ?? '' });
      t.lines.forEach((l: any) => this.lines.push(lineGroup(this.fb, { productId: l.productId, designation: l.designation ?? '', quantity: l.quantity, serials: (l.serials ?? []).join('\n') }))); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/stock-transfers']); } });  
  }
  save() {
    this.error.set(''); const v = this.form.getRawValue(); if (this.form.invalid || !this.lines.length) { this.error.set('Magasins et au moins une ligne requis.'); return; }
    const body = { fromWarehouseId: v.from, toWarehouseId: v.to, date: v.date, notes: v.notes || undefined, lines: this.lines.getRawValue().map((l) => ({ productId: l.productId, quantity: Number(l.quantity), ...(l.serials.trim() && { serials: l.serials.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) }) })) };
    if (this.lines.getRawValue().some((l) => !l.productId)) { this.error.set('Chaque ligne doit être un article du catalogue.'); return; }
    this.saving.set(true); const id = this.id(); (id ? this.api.put(`/stock-transfers/${id}`, body) : this.api.post('/stock-transfers', body)).subscribe({ next: (t) => { this.toast.success('Transfert enregistré'); this.router.navigate(['/stock-transfers', t.id]); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } });
  }
}

@Component({
  selector: 'app-transfer-detail',
  imports: [DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton],
  template: `<div class="page">@if (!d()) {<div class="card"><app-skeleton /></div>} @else {
    <app-page-header [title]="'Transfert ' + d().number" [subtitle]="wh(d().fromWarehouseId) + ' → ' + wh(d().toWarehouseId)">
      @if (d().editable && auth.has('inventory:update')) {<a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>}
      @if (d().editable && auth.has('inventory:delete')) {<button mat-stroked-button color="warn" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
      @if (d().editable && auth.has('inventory:validate')) {<button mat-flat-button color="primary" (click)="validate()"><app-icon name="sync_alt" />Valider le transfert</button>}
    </app-page-header>
    <p><span class="chip" [class.ok]="d().status === 'validated'">{{ d().status === 'validated' ? 'Validé' : 'Brouillon' }}</span> <span class="muted">{{ d().date | date: 'dd/MM/yyyy' : 'UTC' }}</span></p>
    <div class="card"><div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Article</th><th style="text-align:right;padding:8px">Quantité</th><th style="text-align:left;padding:8px">Séries</th></tr></thead>
      <tbody>@for (l of d().lines; track l.id) {<tr><td style="padding:8px;border-top:1px solid var(--erp-border)">{{ l.designation }}</td><td style="padding:8px;text-align:right;border-top:1px solid var(--erp-border)">{{ l.quantity }}</td><td style="padding:8px;border-top:1px solid var(--erp-border)">{{ l.serials.join(', ') }}</td></tr>}</tbody></table></div></div>}</div>`,
})
export class TransferDetail {
  id = input.required<string>(); d = signal<any>(null); names = signal<Record<string, string>>({});  
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); auth = inject(AuthService);
  wh = (id: string) => this.names()[id] ?? id;
  ngOnInit() { this.api.get('/warehouses').subscribe((w) => this.names.set(Object.fromEntries(w.map((x: any) => [x.id, x.code])))); this.load(); }  
  load() { this.api.get(`/stock-transfers/${this.id()}`).subscribe({ next: (t) => this.d.set(t), error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/stock-transfers']); } }); }
  validate() { confirm(this.dialog, { title: 'Valider le transfert', message: 'Le stock sort du magasin source et entre au magasin destinataire, dans une seule opération. Un stock insuffisant refuse tout le transfert.', confirmLabel: 'Valider' }).subscribe((ok) => ok && this.api.post(`/stock-transfers/${this.id()}/validate`).subscribe({ next: () => { this.toast.success('Transfert validé'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) })); }
  remove() { confirm(this.dialog, { title: 'Supprimer', message: 'Supprimer ce brouillon ?', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/stock-transfers/${this.id()}`).subscribe({ next: () => { this.toast.success('Supprimé'); this.router.navigate(['/stock-transfers']); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}

/** Création d'une feuille d'inventaire : choix du magasin. */
@Component({
  selector: 'app-inventory-start',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatSelectModule, MatButtonModule, PageHeader],
  template: `<div class="page" style="max-width:560px"><app-page-header title="Nouvel inventaire" subtitle="La feuille reprend les articles en stock du magasin choisi (quantités système figées)." />
    <div class="card" style="display:flex;flex-direction:column"><mat-form-field appearance="outline"><mat-label>Magasin</mat-label><mat-select [formControl]="wh">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
      <div class="toolbar-row"><span class="spacer"></span><a mat-button routerLink="/inventories">Annuler</a><button mat-flat-button color="primary" type="button" (click)="go()" [disabled]="wh.invalid">Créer la feuille</button></div></div></div>`,
})
export class InventoryStart {
  private api = inject(Api); private router = inject(Router); private toast = inject(ToastService); warehouses = signal<{ id: string; code: string; name: string }[]>([]); wh = new FormControl('', { nonNullable: true, validators: Validators.required });
  ngOnInit() { this.api.get('/warehouses').subscribe((w) => this.warehouses.set(w.filter((x: { isActive: boolean }) => x.isActive))); }
  go() { this.api.post('/inventories', { warehouseId: this.wh.value }).subscribe({ next: (i) => this.router.navigate(['/inventories', i.id]), error: (e) => this.toast.error(errorMessage(e)) }); }
}

@Component({
  selector: 'app-inventory-detail',
  imports: [DatePipe, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, Icon, PageHeader, Skeleton],
  template: `<div class="page">@if (!d()) {<div class="card"><app-skeleton /></div>} @else {
    <app-page-header [title]="'Inventaire ' + d().number" [subtitle]="'Magasin ' + wh()">
      @if (d().editable && auth.has('inventory:delete')) {<button mat-stroked-button color="warn" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
      @if (d().editable && auth.has('inventory:update')) {<button mat-stroked-button (click)="save()"><app-icon name="save" />Enregistrer les comptages</button>}
      @if (d().editable && auth.has('inventory:validate')) {<button mat-flat-button color="primary" (click)="validate()"><app-icon name="fact_check" />Valider l’inventaire</button>}
    </app-page-header>
    <p><span class="chip" [class.ok]="d().status === 'validated'">{{ d().status === 'validated' ? 'Validé' : 'En cours de comptage' }}</span> <span class="muted">{{ d().date | date: 'dd/MM/yyyy' : 'UTC' }}</span></p>
    @if (d().editable) {<div class="card" style="margin-bottom:16px"><mat-form-field appearance="outline" style="width:100%"><mat-label>Motif de l’inventaire (obligatoire s’il y a des écarts)</mat-label><input matInput [formControl]="reason" /></mat-form-field></div>} @else if (d().reason) {<div class="card" style="margin-bottom:16px">Motif : {{ d().reason }}</div>}
    <div class="card"><div class="table-wrap"><table style="width:100%;border-collapse:collapse;min-width:560px"><thead><tr><th style="text-align:left;padding:8px">Article</th><th style="text-align:right;padding:8px">Quantité système</th><th style="text-align:right;padding:8px">Quantité comptée</th><th style="text-align:right;padding:8px">Écart</th></tr></thead>
      <tbody>@for (l of d().lines; track l.id; let i = $index) {<tr><td style="padding:8px;border-top:1px solid var(--erp-border)">{{ l.reference }} — {{ l.designation }}</td><td style="padding:8px;text-align:right;border-top:1px solid var(--erp-border)">{{ l.systemQty }}</td>
        <td style="padding:8px;text-align:right;border-top:1px solid var(--erp-border)">@if (d().editable) {<input type="number" min="0" step="0.001" style="width:100px;text-align:right;font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px" [formControl]="counts[i]" [attr.aria-label]="'Quantité comptée ' + l.designation" />} @else {{{ l.countedQty ?? '—' }}}</td>
        <td style="padding:8px;text-align:right;border-top:1px solid var(--erp-border)" [style.color]="gap(i, l) ? 'var(--danger)' : null"><strong>{{ gapText(i, l) }}</strong></td></tr>}</tbody></table></div>
      @if (d().editable) {<p class="muted">Les articles suivis par numéro de série ne sont pas inventoriés par quantité. Le stock est ajusté à la validation, au coût moyen pondéré.</p>}</div>}</div>`,
})
export class InventoryDetail {
  id = input.required<string>(); d = signal<any>(null); counts: FormControl<number | null>[] = []; reason = new FormControl('', { nonNullable: true }); names = signal<Record<string, string>>({});  
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); auth = inject(AuthService);
  wh = () => this.names()[this.d()?.warehouseId] ?? '';
  ngOnInit() { this.api.get('/warehouses').subscribe((w) => this.names.set(Object.fromEntries(w.map((x: any) => [x.id, x.code])))); this.load(); }  
  load() { this.api.get(`/inventories/${this.id()}`).subscribe({ next: (i) => { this.d.set(i); this.reason.setValue(i.reason ?? ''); this.counts = i.lines.map((l: any) => new FormControl<number | null>(l.countedQty)); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/inventories']); } }); }  
  gap = (i: number, l: any) => { const c = this.d().editable ? this.counts[i]?.value : l.countedQty; return c != null && c !== '' as unknown && Number(c) !== l.systemQty; };  
  gapText = (i: number, l: any) => { const c = this.d().editable ? this.counts[i]?.value : l.countedQty; if (c == null) return '—'; const g = Math.round((Number(c) - l.systemQty) * 1000) / 1000; return g > 0 ? `+${g}` : `${g}`; };  
  private body() { return { reason: this.reason.value || undefined, lines: this.d().lines.map((l: any, i: number) => ({ productId: l.productId, countedQty: this.counts[i]!.value === null || (this.counts[i]!.value as unknown) === '' ? null : Number(this.counts[i]!.value) })) }; }  
  save(after?: () => void) { this.api.put(`/inventories/${this.id()}`, this.body()).subscribe({ next: (i) => { this.d.set(i); if (after) after(); else this.toast.success('Comptages enregistrés'); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  validate() { confirm(this.dialog, { title: 'Valider l’inventaire', message: 'Les écarts entre quantités comptées et quantités en stock seront régularisés par des mouvements d’ajustement au CMP. Cette action est définitive.', confirmLabel: 'Valider' })
    .subscribe((ok) => ok && this.save(() => this.api.post(`/inventories/${this.id()}/validate`).subscribe({ next: () => { this.toast.success('Inventaire validé : stock ajusté'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }))); }
  remove() { confirm(this.dialog, { title: 'Supprimer', message: 'Supprimer cette feuille d’inventaire ?', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/inventories/${this.id()}`).subscribe({ next: () => { this.toast.success('Supprimé'); this.router.navigate(['/inventories']); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}
void MatDialogModule; void MatDialogRef;
