import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ReferenceDataService as ReferenceDataServiceToken } from '../../core/services/reference-data.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DOC_CONFIG, DocConfig, DocKind, SalesDoc, STATUS_LABELS } from './sales.models';
import { SalesService } from './sales.service';

@Component({
  selector: 'app-doc-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    PageHeader, EmptyState, Skeleton, MoneyPipe],
  template: `
    <div class="page">
      <app-page-header [title]="cfg().title" [subtitle]="subtitle()">
        @if (auth.has(cfg().permission + ':create')) {<a mat-flat-button color="primary" routerLink="new"><app-icon name="add" />{{ cfg().gender === 'f' ? 'Nouvelle' : 'Nouveau' }} {{ cfg().singular }}</a>}
      </app-page-header>
      @if (kpis().length) {<div class="kpis">@for (k of kpis(); track k.label) {<div class="card"><span class="muted">{{ k.label }}</span><strong>{{ k.value }}</strong></div>}</div>}
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" placeholder="N° ou client" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (s of cfg().statuses; track s) {<mat-option [value]="s">{{ label(s) }}</mat-option>}</mat-select></mat-form-field>
          @if (kind() === 'invoices') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Type</mat-label><mat-select [value]="type()" (selectionChange)="type.set($event.value); reload()"><mat-option value="">Factures et avoirs</mat-option><mat-option value="invoice">Factures</mat-option><mat-option value="credit_note">Avoirs</mat-option></mat-select></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Règlement</mat-label><mat-select [value]="paymentStatus()" (selectionChange)="paymentStatus.set($event.value); reload()"><mat-option value="">Tous</mat-option><mat-option value="unpaid">Impayées</mat-option><mat-option value="partial">Partielles</mat-option><mat-option value="paid">Payées</mat-option></mat-select></mat-form-field>
            <mat-slide-toggle [checked]="overdue()" (change)="overdue.set($event.checked); reload()">En retard</mat-slide-toggle>
          }
          @if (kind() === 'delivery-notes') {<mat-slide-toggle [checked]="unbilled()" (change)="unbilled.set($event.checked); reload()">Non facturés</mat-slide-toggle>}
          <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:160px"><mat-label>Du</mat-label><input matInput type="date" [formControl]="from" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:160px"><mat-label>Au</mat-label><input matInput type="date" [formControl]="to" /></mat-form-field>
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state [icon]="cfg().icon" message="Aucun document ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table [dataSource]="items()">
            <ng-container matColumnDef="number"><th mat-header-cell *matHeaderCellDef>Numéro</th><td mat-cell *matCellDef="let d"><a [routerLink]="[d.id]" class="lnk"><strong>{{ d.number ?? 'Brouillon' }}</strong></a>@if (d.type === 'credit_note') {<span class="chip off" style="margin-left:6px">Avoir</span>}</td></ng-container>
            <ng-container matColumnDef="customer"><th mat-header-cell *matHeaderCellDef>Client</th><td mat-cell *matCellDef="let d">{{ d.customer.name }}</td></ng-container>
            <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let d">{{ (d.issueDate ?? d.deliveryDate) | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="validity"><th mat-header-cell *matHeaderCellDef>Validité</th><td mat-cell *matCellDef="let d">{{ d.validUntil | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
            <ng-container matColumnDef="total"><th mat-header-cell *matHeaderCellDef>{{ kind() === 'invoices' ? 'Net à payer' : 'Total TTC' }}</th><td mat-cell *matCellDef="let d"><strong>{{ (kind() === 'invoices' ? d.totals.totalPayableMinor : d.totals.totalTtcMinor) | money }}</strong></td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let d">
              <span class="chip" [class.ok]="good(d)" [class.off]="bad(d)">{{ label(d.status) }}</span>
              @if (kind() === 'invoices' && d.status === 'validated' && d.type === 'invoice') {<span class="chip" [class.ok]="d.paymentStatus === 'paid'" [class.danger]="d.overdue" style="margin-left:4px">{{ d.overdue ? 'En retard' : label(d.paymentStatus) }}</span>}
              @if (kind() === 'delivery-notes' && d.invoiced) {<span class="chip ok" style="margin-left:4px">Facturé</span>}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols()"></tr><tr mat-row *matRowDef="let r; columns: cols()" class="row" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `.lnk{color:inherit;text-decoration:none}.row{cursor:pointer}.row:hover{background:var(--brand-50)}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin-bottom:16px}.kpis .card{display:flex;flex-direction:column;gap:4px}.kpis strong{font-size:20px}`,
})
export class DocList {
  kind = input.required<DocKind>();
  cfg = computed<DocConfig>(() => DOC_CONFIG[this.kind()]);
  private svc = inject(SalesService); private toast = inject(ToastService); private router = inject(Router); private destroy = inject(DestroyRef); auth = inject(AuthService);
  private ref = inject(ReferenceDataServiceToken);
  items = signal<SalesDoc[]>([]); total = signal(0); loading = signal(true); kpis = signal<{ label: string; value: string }[]>([]);
  page = signal(0); pageSize = signal(20); status = signal(''); type = signal(''); paymentStatus = signal(''); overdue = signal(false); unbilled = signal(false);
  search = new FormControl('', { nonNullable: true }); from = new FormControl('', { nonNullable: true }); to = new FormControl('', { nonNullable: true });
  cols = computed(() => ['number', 'customer', 'date', ...(this.cfg().hasValidity ? ['validity'] : []), ...(this.kind() === 'delivery-notes' ? [] : ['total']), 'status']);
  label = (s: string) => STATUS_LABELS[s] ?? s;
  good = (d: SalesDoc) => ['accepted', 'validated', 'converted', 'paid'].includes(d.status);
  bad = (d: SalesDoc) => ['refused', 'expired', 'cancelled'].includes(d.status);
  subtitle = () => ({ quotations: 'Création, suivi des statuts et conversion en proforma ou facture', proformas: 'Engagement précontractuel — conversion en facture définitive',
    invoices: 'Factures et avoirs numérotés légalement ; une facture validée n’est jamais modifiée', 'delivery-notes': 'Livraisons totales ou partielles, facturation des BL' })[this.kind()];

  private route = inject(ActivatedRoute);
  ngOnInit() {
    // Filtre de type porté par l'URL (ex. /invoices?type=credit_note depuis le menu « Avoirs »)
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((q) => { const t = q.get('type') ?? ''; if (t !== this.type()) { this.type.set(t); this.reload(); } });
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.from.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.to.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.load(); this.loadKpis();
  }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    const k = this.kind();
    this.svc.list(k, { page: this.page() + 1, limit: this.pageSize(), q: this.search.value, status: this.status(), from: this.from.value, to: this.to.value,
      ...(k === 'invoices' && { type: this.type(), paymentStatus: this.paymentStatus(), overdue: this.overdue() }), ...(k === 'delivery-notes' && this.unbilled() && { invoiced: false, status: 'validated' }) }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); } });
  }
  private loadKpis() {
    const k = this.kind(); const fmt = (m: number) => this.fmt(m);
    if (k === 'quotations' || k === 'proformas') {
      if (this.auth.has(this.cfg().permission + ':view')) this.svc.stats(k).subscribe((s) => this.kpis.set([{ label: 'En attente', value: `${s['pending']}` }, { label: 'Total en attente', value: fmt(s['pendingTotalMinor']!) }, { label: 'Taux de conversion', value: `${s['conversionRatePct']} %` }]));
    } else if (k === 'invoices') {
      this.svc.invoiceSummary().subscribe((s) => this.kpis.set([{ label: 'Chiffre d’affaires HT', value: fmt(s.revenueHtMinor) }, { label: 'TVA collectée', value: fmt(s.vatCollectedMinor) }, { label: 'Reste à encaisser', value: fmt(s.unpaidMinor) }]));
    }
  }
  private fmt(m: number) { return this.ref.format(m); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  open(d: SalesDoc) { this.router.navigate([this.cfg().route, d.id]); }
}
