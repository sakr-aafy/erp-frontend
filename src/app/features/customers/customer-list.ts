import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { Icon } from '../../shared/components/icon';
import { PhoneLink } from '../../shared/components/phone-link';
import { PageHeader } from '../../shared/components/page-header';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { Customer2 } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { CustomerActions } from './customer-actions.service';
import { STATUS_CHIP, STATUS_LABEL, TYPE_ICON, TYPE_LABEL } from './customer.labels';
import { CustomerService } from './customer.service';

@Component({
  selector: 'app-customer-list',
  imports: [ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, PageHeader, EmptyState, Skeleton, ExportMenu, HasPermissionDirective, MoneyPipe, RowActions, PhoneLink],
  template: `
    <div class="page">
      <app-page-header title="Clients" subtitle="Fiches clients, conditions commerciales, plafonds de crédit et soldes">
        <app-export-menu *appHasPermission="'customers:view'" path="/customers/export" [params]="exportParams()" />
        <a mat-flat-button color="primary" routerLink="new" *appHasPermission="'customers:create'"><app-icon name="add" />Nouveau client</a>
      </app-page-header>
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" />
            <input matInput [formControl]="search" placeholder="Code, nom, matricule, téléphone, e-mail…" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Type</mat-label>
            <mat-select [value]="type()" (selectionChange)="type.set($event.value); reload()"><mat-option value="">Tous les types</mat-option><mat-option value="company">Société</mat-option><mat-option value="walk_in">Passager</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="open">Tous (hors archivés)</mat-option><mat-option value="active">Actifs</mat-option><mat-option value="inactive">Inactifs</mat-option>
              <mat-option value="blocked">Bloqués</mat-option><mat-option value="archived">Archivés</mat-option><mat-option value="all">Tous, archivés inclus</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Ville</mat-label>
            <mat-select [value]="city()" (selectionChange)="city.set($event.value); reload()"><mat-option value="">Toutes les villes</mat-option>@for (c of cities(); track c) {<mat-option [value]="c">{{ c }}</mat-option>}</mat-select></mat-form-field>
          <mat-slide-toggle [checked]="debtors()" (change)="debtors.set($event.checked); reload()">Clients débiteurs</mat-slide-toggle>
          <span class="spacer"></span>
          @if (summary() !== null) {<span class="muted">Total des soldes : <strong>{{ summary() | money }}</strong></span>}
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="groups" message="Aucun client ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table class="responsive compact" [dataSource]="items()" matSort (matSortChange)="onSort($event)">
            <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef mat-sort-header="code">Code</th><td mat-cell *matCellDef="let c" data-label="Code"><span class="code">{{ c.code ?? '—' }}</span></td></ng-container>
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef mat-sort-header="name">Raison sociale / Nom</th>
              <td mat-cell *matCellDef="let c" data-label="Client"><a [routerLink]="[c.id]" class="lnk"><strong>{{ c.name }}</strong></a>@if (c.tradeName) {<br><span class="muted">{{ c.tradeName }}</span>}</td></ng-container>
            <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef mat-sort-header="type">Type</th>
              <td mat-cell *matCellDef="let c" data-label="Type"><span class="kind"><app-icon [name]="typeIcon[c.type]" />{{ typeLabel[c.type] }}</span></td></ng-container>
            <ng-container matColumnDef="taxId"><th mat-header-cell *matHeaderCellDef mat-sort-header="taxId">Matricule fiscal</th><td mat-cell *matCellDef="let c" data-label="Matricule fiscal">{{ c.taxId ?? '—' }}</td></ng-container>
            <ng-container matColumnDef="contact"><th mat-header-cell *matHeaderCellDef>Contact principal</th>
              <td mat-cell *matCellDef="let c" data-label="Contact">
                @if (c.primaryContact; as k) {{{ k.name }}<br>@if (k.phone) {<app-phone class="muted" [info]="k.phoneInfo" [value]="k.phone" />} @else if (c.phone) {<app-phone class="muted" [info]="c.phoneInfo" [value]="c.phone" />} @else {<span class="muted">{{ k.email || c.email }}</span>}}
                @else {@if (c.phone) {<app-phone [info]="c.phoneInfo" [value]="c.phone" />} @else {—}<br><span class="muted">{{ c.email }}</span>}</td></ng-container>
            <ng-container matColumnDef="city"><th mat-header-cell *matHeaderCellDef mat-sort-header="city">Ville</th><td mat-cell *matCellDef="let c" data-label="Ville">{{ c.address.city || '—' }}</td></ng-container>
            <ng-container matColumnDef="limit"><th mat-header-cell *matHeaderCellDef mat-sort-header="creditLimitMinor" class="r">Limite de crédit</th><td mat-cell *matCellDef="let c" class="r" data-label="Limite de crédit">{{ c.creditLimitMinor === null ? 'Illimitée' : (c.creditLimitMinor | money) }}</td></ng-container>
            <ng-container matColumnDef="balance"><th mat-header-cell *matHeaderCellDef mat-sort-header="balanceMinor" class="r">Solde</th>
              <td mat-cell *matCellDef="let c" class="r" data-label="Solde" [style.color]="c.creditExceeded ? 'var(--danger)' : null"><strong>{{ c.balanceMinor | money }}</strong>@if (c.creditExceeded) {<app-icon class="warn-ico" name="warning" title="Limite de crédit dépassée" />}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef mat-sort-header="status">Statut</th><td mat-cell *matCellDef="let c" data-label="Statut"><span class="chip {{ chip[c.status] }}">{{ statusLabel[c.status] }}</span></td></ng-container>
            <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="r"><span class="sr-only">Actions</span></th><td mat-cell *matCellDef="let c" class="r act" (click)="$event.stopPropagation()"><app-row-actions [actions]="actionsOf(c)" /></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols" class="row" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `table.compact th,table.compact td{padding:0 8px!important}table.compact th.mat-mdc-header-cell{font-size:11px}.nw{white-space:nowrap}td.r strong{white-space:nowrap}
    @media (min-width:901px){td[data-label=Client]{min-width:190px;max-width:260px}td[data-label=Contact]{max-width:200px;overflow:hidden;text-overflow:ellipsis}}.lnk{color:inherit;text-decoration:none}.row{cursor:pointer}.code{font-weight:600;color:var(--brand);white-space:nowrap}.kind{display:inline-flex;align-items:center;gap:6px;color:var(--text-2);white-space:nowrap}
    .warn-ico{font-size:16px;vertical-align:middle;margin-left:4px}.act{width:56px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`,
})
export class CustomerList {
  private svc = inject(CustomerService); private toast = inject(ToastService); private router = inject(Router); private destroy = inject(DestroyRef);
  private actions = inject(CustomerActions); private auth = inject(AuthService);
  cols = ['code', 'name', 'type', 'taxId', 'contact', 'city', 'limit', 'balance', 'status', 'actions'];
  typeIcon = TYPE_ICON; typeLabel = TYPE_LABEL; statusLabel = STATUS_LABEL; chip = STATUS_CHIP;
  items = signal<Customer2[]>([]); total = signal(0); loading = signal(true); summary = signal<number | null>(null); cities = signal<string[]>([]);
  page = signal(0); pageSize = signal(20); status = signal('open'); type = signal(''); city = signal(''); debtors = signal(false); sort = signal<string | undefined>(undefined);
  search = new FormControl('', { nonNullable: true });
  exportParams = computed(() => ({ q: this.search.value, status: this.status(), type: this.type() || undefined, city: this.city() || undefined, debtors: this.debtors() || undefined, sort: this.sort() }));

  constructor() {
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.svc.cities().subscribe({ next: (c) => this.cities.set(c), error: () => undefined });
    this.load();
  }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    this.svc.list({ page: this.page() + 1, limit: this.pageSize(), q: this.search.value, status: this.status(), type: this.type(), city: this.city(), debtors: this.debtors(), sort: this.sort() }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.summary.set(r.summary?.totalBalanceMinor ?? null); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  onSort(s: Sort) { this.sort.set(s.direction ? (s.direction === 'desc' ? '-' : '') + s.active : undefined); this.reload(); }
  open(c: Customer2) { this.router.navigate(['/customers', c.id]); }

  /** Menu « ⋮ » : chaque action n'apparaît que si l'utilisateur a la permission du module concerné et si le statut le permet. */
  actionsOf(c: Customer2): RowAction[] {
    const can = (p: string) => this.auth.has(p); const editable = c.status !== 'archived';
    return [
      { label: 'Consulter la fiche', icon: 'visibility', link: ['/customers', c.id] },
      { label: 'Modifier', icon: 'edit', link: ['/customers', c.id, 'edit'], hidden: !can('customers:update') || !editable },
      { label: 'Imprimer la fiche', icon: 'print', run: () => this.actions.print(c) },
      { label: 'Créer un devis', icon: 'request_quote', link: ['/quotations', 'new'], hidden: !can('quotations:create') || !c.canSell, query: { customerId: c.id } },
      { label: 'Consulter les transactions', icon: 'receipt_long', link: ['/customers', c.id], query: { tab: 'transactions' }, hidden: !can('quotations:view') && !can('invoices:view') && !can('deliveryNotes:view') },
      { label: 'Consulter les paiements', icon: 'payments', link: ['/customers', c.id], query: { tab: 'payments' }, hidden: !can('invoices:view') },
      ...this.actions.statusActions(c).map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, run: () => this.actions.changeStatus(c, a).subscribe({ next: (u) => u && this.load(), error: (e) => this.toast.error(errorMessage(e)) }) })),
      { label: 'Supprimer', icon: 'delete', danger: true, hidden: !can('customers:delete'), run: () => this.actions.remove(c).subscribe({ next: (ok) => ok && this.load(), error: (e) => this.toast.error(errorMessage(e)) }) },
    ];
  }
}
