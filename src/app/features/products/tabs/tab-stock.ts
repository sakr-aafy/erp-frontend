import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { ProductDto, SerialDto } from '../../../shared/models/api.models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SERIAL_STATUS, STOCK_CHIP, num } from '../product.labels';
import { ProductService } from '../product.service';
import { StockRow, StockTab } from '../product.types';

/** Onglet 4 — Stock : niveaux réels par entrepôt (lecture seule), réglages (emplacement, minimum, maximum), alertes et numéros de série. Aucune quantité n'est modifiable ici. */
@Component({
  selector: 'app-tab-stock',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, Icon, MoneyPipe, Skeleton],
  template: `
    <div class="top"><div><h2>Stock</h2><p class="muted">Quantités, dépôts et traçabilité</p></div>
      <div class="links">
        <a mat-stroked-button routerLink="/stock/movements" [queryParams]="{ productId: p().id }"><app-icon name="sync_alt" />Mouvements</a>
        @if (auth.has('inventory:view')) {<a mat-stroked-button routerLink="/stock-transfers"><app-icon name="swap_vert" />Transferts</a><a mat-stroked-button routerLink="/inventories"><app-icon name="fact_check" />Inventaires</a>}
      </div></div>
    @if (!s()) {<div class="card"><app-skeleton /></div>}
    @else if (s()!.kind === 'service') {<div class="card"><p class="muted"><app-icon name="info" /> Un service n’a pas de stock.</p></div>}
    @else {
      @if (s()!.alerts.length) {<div class="alerts" role="alert">@for (a of s()!.alerts; track a.warehouseId + a.status) {<span class="chip {{ chip[a.status] }}"><strong>{{ a.label }}</strong> — {{ a.warehouse }} ({{ a.qty }})</span>}</div>}
      <div class="kpis">
        <div class="kpi main"><span class="muted">Stock disponible (tous entrepôts)</span><strong>{{ num(s()!.total.qty) }}</strong><span class="chip {{ chip[s()!.total.status] }}">{{ totalLabel() }}</span></div>
        @if (s()!.canSeeValues) {<div class="kpi"><span class="muted">Valeur du stock</span><strong>{{ s()!.total.valueMinor | money }}</strong></div><div class="kpi"><span class="muted">CMP moyen</span><strong>{{ s()!.total.cmpMinor === null ? '—' : (s()!.total.cmpMinor | money) }}</strong></div>}
        <div class="kpi"><span class="muted">Stock minimum global</span><strong>{{ s()!.globalMinStock }}</strong></div>
      </div>
      <section class="card">
        <div class="table-wrap"><table mat-table class="responsive" [dataSource]="s()!.warehouses">
          <ng-container matColumnDef="wh"><th mat-header-cell *matHeaderCellDef>Entrepôt</th><td mat-cell *matCellDef="let w" data-label="Entrepôt"><strong>{{ w.code }}</strong> <span class="muted">{{ w.name }}</span>@if (w.isDefault) { <span class="chip ok">Par défaut</span>}@if (!w.isActive) { <span class="chip off">Désactivé</span>}</td></ng-container>
          <ng-container matColumnDef="loc"><th mat-header-cell *matHeaderCellDef>Emplacement</th><td mat-cell *matCellDef="let w" data-label="Emplacement">{{ w.location ?? '—' }}</td></ng-container>
          <ng-container matColumnDef="qty"><th mat-header-cell *matHeaderCellDef class="r">Quantité disponible</th><td mat-cell *matCellDef="let w" class="r" data-label="Quantité"><strong [class.neg]="w.qty <= 0">{{ num(w.qty) }}</strong></td></ng-container>
          <ng-container matColumnDef="min"><th mat-header-cell *matHeaderCellDef class="r">Stock minimum</th><td mat-cell *matCellDef="let w" class="r" data-label="Minimum">{{ w.minQty ?? w.effectiveMinQty ?? '—' }}@if (w.minQty === null && w.effectiveMinQty !== null) {<span class="muted small"> (global)</span>}</td></ng-container>
          <ng-container matColumnDef="max"><th mat-header-cell *matHeaderCellDef class="r">Stock maximum</th><td mat-cell *matCellDef="let w" class="r" data-label="Maximum">{{ w.maxQty ?? '—' }}</td></ng-container>
          @if (s()!.canSeeValues) {<ng-container matColumnDef="cmp"><th mat-header-cell *matHeaderCellDef class="r">CMP</th><td mat-cell *matCellDef="let w" class="r" data-label="CMP">{{ w.cmpMinor === null ? '—' : (w.cmpMinor | money) }}</td></ng-container>
          <ng-container matColumnDef="val"><th mat-header-cell *matHeaderCellDef class="r">Valeur du stock</th><td mat-cell *matCellDef="let w" class="r" data-label="Valeur">{{ w.valueMinor | money }}</td></ng-container>}
          <ng-container matColumnDef="st"><th mat-header-cell *matHeaderCellDef>Statut du stock</th><td mat-cell *matCellDef="let w" data-label="Statut"><span class="chip {{ chip[w.status] }}">{{ w.statusLabel }}</span></td></ng-container>
          <ng-container matColumnDef="act"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr">Actions</span></th><td mat-cell *matCellDef="let w" class="r">@if (canEdit()) {<button mat-icon-button type="button" (click)="editRow(w)" [attr.aria-label]="'Régler ' + w.code" title="Emplacement et seuils"><app-icon name="settings" /></button>}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols()"></tr><tr mat-row *matRowDef="let r; columns: cols()"></tr></table></div>
        @if (editing(); as w) {
          <form class="edit" [formGroup]="form" (ngSubmit)="saveRow(w)">
            <strong>Réglages de {{ w.code }} — {{ w.name }}</strong>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Emplacement</mat-label><input matInput formControlName="location" placeholder="Allée, rack, étagère…" /></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Stock minimum</mat-label><input matInput type="number" min="0" formControlName="minQty" /></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Stock maximum</mat-label><input matInput type="number" min="0" formControlName="maxQty" /></mat-form-field>
            <button mat-button type="button" (click)="editing.set(null)">Annuler</button><button mat-flat-button color="primary" [disabled]="form.invalid">Enregistrer</button>
          </form>
          @if (form.hasError('order')) {<p class="neg small">Le minimum ne peut pas dépasser le maximum.</p>}}
        <p class="muted small">Les quantités ne se modifient pas ici : elles ne changent que par les réceptions, sorties, bons de livraison, transferts, inventaires et ajustements autorisés (mouvements immuables, CMP et blocage du stock négatif préservés).</p>
      </section>

      @if (s()!.hasSerial) {
        <section class="card" style="margin-top:16px"><h3>Numéros de série ({{ total() }})</h3>
          @if (canEdit()) {<div class="serial-add"><mat-form-field appearance="outline" subscriptSizing="dynamic" style="flex:1;min-width:240px"><mat-label>Ajouter des numéros (un par ligne)</mat-label><textarea matInput rows="3" [formControl]="newSerials"></textarea></mat-form-field>
            <button mat-flat-button color="primary" type="button" (click)="addSerials()" [disabled]="newSerials.invalid">Ajouter</button></div>}
          @if (!serials().length) {<p class="muted">Aucun numéro de série enregistré.</p>} @else {
            <div class="table-wrap"><table mat-table class="responsive" [dataSource]="serials()">
              <ng-container matColumnDef="sn"><th mat-header-cell *matHeaderCellDef>Numéro de série</th><td mat-cell *matCellDef="let x" data-label="N° de série"><strong>{{ x.serialNumber }}</strong></td></ng-container>
              <ng-container matColumnDef="wh"><th mat-header-cell *matHeaderCellDef>Entrepôt actuel</th><td mat-cell *matCellDef="let x" data-label="Entrepôt">{{ x.warehouse ?? '—' }}</td></ng-container>
              <ng-container matColumnDef="st"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let x" data-label="Statut"><span class="chip" [class.ok]="x.status === 'available'" [class.off]="x.status !== 'available'">{{ serialStatus[x.status] ?? x.status }}</span></td></ng-container>
              <ng-container matColumnDef="hist"><th mat-header-cell *matHeaderCellDef>Dernier mouvement</th><td mat-cell *matCellDef="let x" data-label="Mouvement">{{ x.soldOn ? (x.soldOn.number ?? x.soldOn.type) : '—' }}</td></ng-container>
              <ng-container matColumnDef="act"><th mat-header-cell *matHeaderCellDef class="r"></th><td mat-cell *matCellDef="let x" class="r">@if (x.status === 'available' && canEdit()) {<button mat-icon-button type="button" (click)="removeSerial(x)" aria-label="Supprimer le numéro" title="Supprimer"><app-icon name="delete" /></button>}</td></ng-container>
              <tr mat-header-row *matHeaderRowDef="['sn','wh','st','hist','act']"></tr><tr mat-row *matRowDef="let r; columns: ['sn','wh','st','hist','act']"></tr></table></div>}
          <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" (page)="onPage($event)" hidePageSize />
        </section>}
    }`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}.links{display:flex;gap:8px;flex-wrap:wrap}h3{margin:0 0 12px;font-size:15px;font-weight:600}
    .alerts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
    .kpi.main{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}.kpi strong{font-size:22px;font-variant-numeric:tabular-nums}.neg{color:var(--danger)}.small{font-size:12px}.sr{position:absolute;width:1px;height:1px;overflow:hidden}
    .edit{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-lg)}.edit strong{flex:1 1 100%}.serial-add{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}`,
})
export class TabStock {
  p = input.required<ProductDto>(); changed = output<void>();
  auth = inject(AuthService); private svc = inject(ProductService); private toast = inject(ToastService); private dialog = inject(MatDialog); private fb = inject(FormBuilder);
  s = signal<StockTab | null>(null); chip = STOCK_CHIP; num = num; serialStatus = SERIAL_STATUS;
  serials = signal<SerialDto[]>([]); total = signal(0); page = signal(0); newSerials = new FormControl('', { nonNullable: true, validators: Validators.required });
  editing = signal<StockRow | null>(null);
  form = this.fb.group({ location: [''], minQty: [null as number | null, Validators.min(0)], maxQty: [null as number | null, Validators.min(0)] }, { validators: (g) => { const v = g.value; return v.minQty != null && v.maxQty != null && (v.minQty as unknown) !== '' && (v.maxQty as unknown) !== '' && Number(v.minQty) > Number(v.maxQty) ? { order: true } : null; } });
  canEdit = computed(() => this.auth.has('products:update') && this.p().status !== 'archived');
  cols = computed(() => ['wh', 'loc', 'qty', 'min', 'max', ...(this.s()?.canSeeValues ? ['cmp', 'val'] : []), 'st', 'act']);
  totalLabel = () => ({ out: 'Rupture', below_min: 'Sous le minimum', above_max: 'Au-dessus du maximum', negative: 'Stock négatif', ok: 'Normal' } as Record<string, string>)[this.s()?.total.status ?? 'ok'];
  ngOnInit() { this.load(); }
  load() {
    this.svc.stock(this.p().id).subscribe({ next: (s) => { this.s.set(s); if (s.hasSerial) this.loadSerials(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  loadSerials() { this.svc.serials(this.p().id, this.page() + 1, 20).subscribe((r) => { this.serials.set(r.items); this.total.set(r.total); }); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.loadSerials(); }
  editRow(w: StockRow) { this.editing.set(w); this.form.reset({ location: w.location ?? '', minQty: w.minQty, maxQty: w.maxQty }); }
  saveRow(w: StockRow) {
    if (this.form.invalid) return; const v = this.form.getRawValue(); const n = (x: unknown) => (x === null || x === '' ? null : Number(x));
    this.svc.saveStockSetting(this.p().id, w.warehouseId, { location: v.location?.trim() || null, minQty: n(v.minQty), maxQty: n(v.maxQty) }).subscribe({ next: (s) => { this.s.set(s); this.editing.set(null); this.toast.success('Réglages enregistrés'); this.changed.emit(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  addSerials() {
    const list = this.newSerials.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); if (!list.length) return;
    this.svc.addSerials(this.p().id, list).subscribe({ next: (r) => { this.toast.success(`${r.added} numéro(s) ajouté(s)`); this.newSerials.reset(''); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  removeSerial(x: SerialDto) {
    confirm(this.dialog, { title: 'Supprimer le numéro de série', message: x.serialNumber, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.svc.removeSerial(this.p().id, x.id).subscribe({ next: () => { this.toast.success('Supprimé'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
