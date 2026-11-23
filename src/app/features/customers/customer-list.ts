import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { Customer2 } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { CustomerService } from './customer.service';

@Component({
  selector: 'app-customer-list',
  imports: [ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, PageHeader, EmptyState, Skeleton, ExportMenu, HasPermissionDirective, MoneyPipe],
  template: `
    <div class="page">
      <app-page-header title="Clients" subtitle="Fiches clients, limites de crédit et soldes">
        <app-export-menu *appHasPermission="'customers:view'" path="/customers/export" [params]="exportParams()" />
        <a mat-flat-button color="primary" routerLink="new" *appHasPermission="'customers:create'"><app-icon name="add" />Nouveau client</a>
      </app-page-header>
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" />
            <input matInput [formControl]="search" placeholder="Nom, matricule, e-mail, ville…" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="active">Actifs</mat-option><mat-option value="archived">Archivés</mat-option><mat-option value="all">Tous</mat-option></mat-select></mat-form-field>
          <mat-slide-toggle [checked]="debtors()" (change)="debtors.set($event.checked); reload()">Clients débiteurs</mat-slide-toggle>
          <span class="spacer"></span>
          @if (summary() !== null) {<span class="muted">Total des soldes : <strong>{{ summary() | money }}</strong></span>}
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="groups" message="Aucun client ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table [dataSource]="items()" matSort (matSortChange)="onSort($event)">
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef mat-sort-header="name">Client</th>
              <td mat-cell *matCellDef="let c"><a [routerLink]="[c.id]" class="lnk"><strong>{{ c.name }}</strong></a><br><span class="muted">{{ c.taxId ?? 'Sans matricule' }}</span></td></ng-container>
            <ng-container matColumnDef="contact"><th mat-header-cell *matHeaderCellDef>Contact</th><td mat-cell *matCellDef="let c">{{ c.phone }}<br><span class="muted">{{ c.email }}</span></td></ng-container>
            <ng-container matColumnDef="city"><th mat-header-cell *matHeaderCellDef>Ville</th><td mat-cell *matCellDef="let c">{{ c.address?.city }}</td></ng-container>
            <ng-container matColumnDef="limit"><th mat-header-cell *matHeaderCellDef>Limite de crédit</th><td mat-cell *matCellDef="let c">{{ c.creditLimitMinor === null ? 'Illimitée' : (c.creditLimitMinor | money) }}</td></ng-container>
            <ng-container matColumnDef="balance"><th mat-header-cell *matHeaderCellDef mat-sort-header="balanceMinor">Solde</th>
              <td mat-cell *matCellDef="let c" [style.color]="c.creditExceeded ? 'var(--danger)' : null"><strong>{{ c.balanceMinor | money }}</strong>@if (c.creditExceeded) {<app-icon style="font-size:16px;vertical-align:middle" title="Limite de crédit dépassée" name="warning" />}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let c"><span class="chip" [class.ok]="!c.isArchived" [class.off]="c.isArchived">{{ c.isArchived ? 'Archivé' : 'Actif' }}</span></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols" class="row" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `.lnk{color:inherit;text-decoration:none}.row{cursor:pointer}.row:hover{background:var(--brand-50)}`,
})
export class CustomerList {
  private svc = inject(CustomerService); private toast = inject(ToastService); private router = inject(Router); private destroy = inject(DestroyRef);
  cols = ['name', 'contact', 'city', 'limit', 'balance', 'status'];
  items = signal<Customer2[]>([]); total = signal(0); loading = signal(true); summary = signal<number | null>(null);
  page = signal(0); pageSize = signal(20); status = signal('active'); debtors = signal(false); sort = signal<string | undefined>(undefined);
  search = new FormControl('', { nonNullable: true });
  exportParams = () => ({ q: this.search.value, status: this.status(), debtors: this.debtors() || undefined });

  constructor() {
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload());
    this.load();
  }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    this.svc.list({ page: this.page() + 1, limit: this.pageSize(), q: this.search.value, status: this.status(), debtors: this.debtors(), sort: this.sort() }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.summary.set(r.summary?.totalBalanceMinor ?? null); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  onSort(s: Sort) { this.sort.set(s.direction ? (s.direction === 'desc' ? '-' : '') + s.active : undefined); this.reload(); }
  open(c: Customer2) { this.router.navigate(['/customers', c.id]); }
}
