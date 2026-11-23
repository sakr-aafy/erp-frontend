import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { debounceTime, of, switchMap } from 'rxjs';
import { Api } from '../../core/services/api.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { prompt } from '../../shared/components/prompt-dialog';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

const REASONS: Record<string, string> = { goods_receipt: 'Réception', import_integration: 'Importation', manual_recalculation: 'Recalcul justifié', initial: 'Initial' };

/** Coût de revient : fiche article (CMP, décomposition, historique, recalcul justifié), simulation de marge, rapport de marges. */
@Component({
  selector: 'app-costs',
  imports: [DatePipe, ReactiveFormsModule, MatTabsModule, MatTableModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule, PageHeader, MoneyPipe],
  template: `<div class="page"><app-page-header title="Coût de revient" subtitle="Coût moyen pondéré (CMP) alimenté par les réceptions et les importations, historisé à chaque variation" />
    <div class="card"><mat-tab-group>
      <mat-tab label="Fiche article"><div class="tab">
        <mat-form-field appearance="outline" style="width:100%;max-width:520px"><mat-label>Article</mat-label><input matInput [formControl]="search" [matAutocomplete]="a" placeholder="Référence ou désignation" /><mat-autocomplete #a="matAutocomplete" (optionSelected)="pick($event.option.value)" [displayWith]="show">@for (p of options(); track p.id) {<mat-option [value]="p">{{ p.reference }} — {{ p.name }}</mat-option>}</mat-autocomplete></mat-form-field>
        @if (sheet(); as s) {<div class="kpis"><div class="card"><span class="muted">Coût de revient (CMP)</span><strong>{{ s.effectiveCostMinor | money }}</strong></div><div class="card"><span class="muted">Prix de vente</span><strong>{{ s.salePriceMinor | money }}</strong></div>
          <div class="card"><span class="muted">Marge</span><strong [style.color]="s.belowCost ? 'var(--danger)' : null">{{ s.marginMinor | money }}</strong><small class="muted">{{ s.marginRatePct ?? '—' }} % du coût · {{ s.markPct ?? '—' }} % du prix de vente</small></div>
          <div class="card"><span class="muted">Stock valorisé</span><strong>{{ s.stock.valueMinor | money }}</strong><small class="muted">{{ s.stock.qty }} unité(s)</small></div></div>
          @if (s.belowCost) {<p style="color:var(--danger)"><app-icon style="vertical-align:middle" name="warning" /> Prix de vente inférieur au coût de revient.</p>}
          @if (s.lastEntry) {<p class="muted">Dernière entrée : achat {{ s.lastEntry.purchaseUnitCostMinor | money }} + frais annexes {{ s.lastEntry.extraUnitCostMinor | money }} par unité ({{ reason(s.lastEntry.reason) }}).</p>}
          <div class="toolbar-row"><h3 style="margin:0">Historique des coûts</h3><span class="spacer"></span>@if (auth.has('costCalculation:update')) {<button mat-stroked-button (click)="recalc()"><app-icon name="calculate" />Recalcul justifié</button>}</div>
          <div class="table-wrap"><table mat-table [dataSource]="s.history"><ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let h">{{ h.at | date: 'dd/MM/yyyy HH:mm' }}</td></ng-container>
            <ng-container matColumnDef="prev"><th mat-header-cell *matHeaderCellDef style="text-align:right">Ancien coût</th><td mat-cell *matCellDef="let h" style="text-align:right">{{ h.previousCostMinor === null ? '—' : (h.previousCostMinor | money) }}</td></ng-container>
            <ng-container matColumnDef="new"><th mat-header-cell *matHeaderCellDef style="text-align:right">Nouveau coût</th><td mat-cell *matCellDef="let h" style="text-align:right"><strong>{{ h.newCostMinor | money }}</strong></td></ng-container>
            <ng-container matColumnDef="why"><th mat-header-cell *matHeaderCellDef>Motif</th><td mat-cell *matCellDef="let h">{{ reason(h.reason) }}{{ h.source?.number ? ' — ' + h.source.number : '' }}<br><span class="muted">{{ h.justification }}</span></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="['at','prev','new','why']"></tr><tr mat-row *matRowDef="let r; columns: ['at','prev','new','why']"></tr></table></div>}
      </div></mat-tab>
      <mat-tab label="Simulation de marge"><div class="tab"><form [formGroup]="sim" (ngSubmit)="simulate()" class="toolbar-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Prix d’achat ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" formControlName="purchase" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Frais annexes ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" formControlName="extra" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Prix de vente ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" formControlName="sale" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Marge cible (%)</mat-label><input matInput type="number" min="0" formControlName="target" /></mat-form-field><button mat-flat-button color="primary">Simuler</button></form>
        @if (result(); as r) {<div class="kpis" style="margin-top:16px"><div class="card"><span class="muted">Coût de revient</span><strong>{{ r.costMinor | money }}</strong></div>@if (r.marginMinor !== undefined) {<div class="card"><span class="muted">Marge</span><strong [style.color]="r.belowCost ? 'var(--danger)' : null">{{ r.marginMinor | money }}</strong><small class="muted">{{ r.marginRatePct }} % du coût · {{ r.markPct }} % du prix</small></div>}
          @if (r.minSalePriceForTargetMinor !== undefined) {<div class="card"><span class="muted">Prix de vente minimal pour la marge cible</span><strong>{{ r.minSalePriceForTargetMinor | money }}</strong></div>}</div>}</div></mat-tab>
      <mat-tab label="Rapport de marges"><div class="tab"><div class="toolbar-row"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Catégorie</mat-label><mat-select [value]="cat()" (selectionChange)="cat.set($event.value); loadReport()"><mat-option value="">Toutes</mat-option>@for (c of cats(); track c.id) {<mat-option [value]="c.id">{{ c.name }}</mat-option>}</mat-select></mat-form-field></div>
        @if (report(); as r) {<div class="kpis">@for (g of r.byCategory; track g.category) {<div class="card"><span class="muted">{{ g.category }} ({{ g.count }})</span><strong>{{ g.marginMinor | money }}</strong><small class="muted">{{ g.marginRatePct ?? '—' }} % du coût · {{ g.markPct ?? '—' }} % du prix</small></div>}</div>
          <div class="table-wrap"><table mat-table [dataSource]="r.items"><ng-container matColumnDef="a"><th mat-header-cell *matHeaderCellDef>Article</th><td mat-cell *matCellDef="let i"><strong>{{ i.reference }}</strong><br><span class="muted">{{ i.name }}</span></td></ng-container>
            <ng-container matColumnDef="c"><th mat-header-cell *matHeaderCellDef style="text-align:right">Coût de revient</th><td mat-cell *matCellDef="let i" style="text-align:right">{{ i.costPriceMinor | money }}</td></ng-container>
            <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef style="text-align:right">Prix de vente</th><td mat-cell *matCellDef="let i" style="text-align:right">{{ i.salePriceMinor | money }}</td></ng-container>
            <ng-container matColumnDef="m"><th mat-header-cell *matHeaderCellDef style="text-align:right">Marge</th><td mat-cell *matCellDef="let i" style="text-align:right" [style.color]="i.belowCost ? 'var(--danger)' : null"><strong>{{ i.marginMinor | money }}</strong> <small class="muted">{{ i.marginRatePct ?? '—' }} %</small></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="['a','c','s','m']"></tr><tr mat-row *matRowDef="let r; columns: ['a','c','s','m']"></tr></table></div>}</div></mat-tab>
    </mat-tab-group></div></div>`,
  styles: `.tab{padding:20px 0}h3{font-size:16px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:12px 0}.kpis .card{display:flex;flex-direction:column;gap:4px}.kpis strong{font-size:20px}`,
})
export class Costs {
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); ref = inject(ReferenceDataService); auth = inject(AuthService);
  search = new FormControl<string | { id: string; reference: string; name: string }>('', { nonNullable: true }); options = signal<{ id: string; reference: string; name: string }[]>([]); sheet = signal<any>(null);  
  sim = new FormBuilder().nonNullable.group({ purchase: [0], extra: [0], sale: [0], target: [null as number | null] }); result = signal<any>(null); report = signal<any>(null); cat = signal(''); cats = signal<{ id: string; name: string }[]>([]);  
  reason = (r: string) => REASONS[r] ?? r; show = (p: { reference: string; name: string } | string | null) => (typeof p === 'string' ? p : p ? `${p.reference} — ${p.name}` : '');
  constructor() { this.search.valueChanges.pipe(debounceTime(250), switchMap((v) => (typeof v === 'string' && v ? this.api.get('/products', { q: v, limit: 10 }) : of(null)))).subscribe((r) => { if (r) this.options.set(r.items); }); }
  ngOnInit() { this.ref.load$().subscribe(); this.api.get('/product-categories').subscribe((c) => this.cats.set(c)); this.loadReport(); }
  pick(p: { id: string }) { this.loadSheet(p.id); }
  loadSheet(id: string) { this.api.get(`/costs/products/${id}`).subscribe({ next: (s) => { this.sheet.set(s); const v = this.sim.controls; v.purchase.setValue(this.ref.fromMinor(s.costPriceMinor ?? s.purchasePriceMinor)); v.sale.setValue(this.ref.fromMinor(s.salePriceMinor)); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  simulate() { const v = this.sim.getRawValue(); this.api.post('/costs/simulate', { purchasePriceMinor: this.ref.toMinor(Number(v.purchase)), extraCostsMinor: this.ref.toMinor(Number(v.extra)), salePriceMinor: this.ref.toMinor(Number(v.sale)), ...(v.target !== null && (v.target as unknown) !== '' && { targetMarginPct: Number(v.target) }) }).subscribe({ next: (r) => this.result.set(r), error: (e) => this.toast.error(errorMessage(e)) }); }
  loadReport() { this.api.get('/costs/report', { limit: 100, categoryId: this.cat() }).subscribe({ next: (r) => this.report.set(r), error: (e) => this.toast.error(errorMessage(e)) }); }
  recalc() { const s = this.sheet(); prompt(this.dialog, { title: 'Recalcul justifié du coût de revient', label: 'Justification (10 caractères minimum)', confirmLabel: 'Recalculer' }).subscribe((j) => j && this.api.post(`/costs/products/${s.productId}/recalculate`, { justification: j }).subscribe({ next: (r) => { this.toast.success(r.changed ? 'Coût recalculé et historisé' : 'Aucun écart : coût inchangé'); this.loadSheet(s.productId); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}
