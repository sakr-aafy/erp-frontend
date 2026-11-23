import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Api } from '../../core/services/api.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { ExportMenu } from '../../shared/components/export-menu';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';

export interface Col { sort?: string; label: string; value: (row: any) => string | number | null | undefined; type?: 'text' | 'money' | 'date' | 'datetime' | 'chip' | 'qty'; chip?: (row: any) => 'ok' | 'off' | 'warn' | '' }  
export interface ListConfig {
  title: string; subtitle?: string; endpoint: string; permission: string; createPermission?: string; createLabel?: string; createRoute?: string; rowRoute?: (row: any) => any[];  
  columns: Col[]; statuses?: { value: string; label: string }[]; searchPlaceholder?: string; extraParams?: Record<string, string | number | boolean>; exportPath?: string;
  headerLinks?: { label: string; icon: string; route: string }[]; emptyIcon?: string;
}

/** Liste paginée côté serveur, paramétrée par la configuration de route (logistique : achats, transferts, inventaires, importations…). */
@Component({
  selector: 'app-generic-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, PageHeader, EmptyState, Skeleton, ExportMenu],
  template: `
    <div class="page">
      <app-page-header [title]="cfg().title" [subtitle]="cfg().subtitle ?? ''">
        @for (l of cfg().headerLinks ?? []; track l.route) {<a mat-stroked-button [routerLink]="l.route"><app-icon [name]="l.icon" />{{ l.label }}</a>}
        @if (cfg().exportPath) {<app-export-menu [path]="cfg().exportPath!" [params]="{ q: search.value, status: status() }" />}
        @if (cfg().createRoute && auth.has(cfg().createPermission ?? '')) {<a mat-flat-button color="primary" [routerLink]="cfg().createRoute!"><app-icon name="add" />{{ cfg().createLabel ?? 'Nouveau' }}</a>}
      </app-page-header>
      <div class="card">
        <div class="toolbar-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher</mat-label><app-icon matPrefix name="search" /><input matInput [formControl]="search" [placeholder]="cfg().searchPlaceholder ?? 'N° ou nom'" /></mat-form-field>
          @if (cfg().statuses?.length) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Statut</mat-label>
            <mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()"><mat-option value="">Tous</mat-option>@for (s of cfg().statuses!; track s.value) {<mat-option [value]="s.value">{{ s.label }}</mat-option>}</mat-select></mat-form-field>}
        </div>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state [icon]="cfg().emptyIcon ?? 'inbox'" message="Aucun enregistrement ne correspond aux critères." />}
        @else {
          <div class="table-wrap"><table mat-table matSort (matSortChange)="onSort($event)" class="responsive" [dataSource]="items()">
            @for (c of cfg().columns; track c.label; let i = $index) {
              <ng-container [matColumnDef]="'c' + i"><th mat-header-cell *matHeaderCellDef [mat-sort-header]="c.sort ?? ''" [disabled]="!c.sort" [class.r]="c.type === 'money' || c.type === 'qty'">{{ c.label }}</th>
                <td mat-cell *matCellDef="let r" [attr.data-label]="c.label" [class.r]="c.type === 'money' || c.type === 'qty'">
                  @switch (c.type) {
                    @case ('money') {<strong>{{ fmt(c.value(r)) }}</strong>}
                    @case ('date') {{{ c.value(r) | date: 'dd/MM/yyyy' : 'UTC' }}}
                    @case ('datetime') {{{ c.value(r) | date: 'dd/MM/yyyy HH:mm' }}}
                    @case ('chip') {<span class="chip" [class.ok]="c.chip?.(r) === 'ok'" [class.off]="c.chip?.(r) === 'off'" [class.warn]="c.chip?.(r) === 'warn'">{{ c.value(r) }}</span>}
                    @default {{{ c.value(r) }}}
                  }</td></ng-container>
            }
            <tr mat-header-row *matHeaderRowDef="colIds()"></tr><tr mat-row *matRowDef="let r; columns: colIds()" [class.row]="!!cfg().rowRoute" (click)="open(r)"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
      </div>
    </div>`,
  styles: `.row{cursor:pointer}`,
})
export class GenericList {
  cfg = input.required<ListConfig>();
  private api = inject(Api); private router = inject(Router); private toast = inject(ToastService); private destroy = inject(DestroyRef); private ref = inject(ReferenceDataService);
  auth = inject(AuthService);
  items = signal<any[]>([]); total = signal(0); loading = signal(true); page = signal(0); pageSize = signal(20); status = signal(''); sort = signal('');  
  search = new FormControl('', { nonNullable: true });
  colIds = computed(() => this.cfg().columns.map((_, i) => 'c' + i));
  fmt = (v: unknown) => this.ref.format(v as number);
  ngOnInit() { this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => this.reload()); this.load(); }
  reload() { this.page.set(0); this.load(); }
  load() {
    this.loading.set(true);
    this.api.get(this.cfg().endpoint, { page: this.page() + 1, limit: this.pageSize(), q: this.search.value, status: this.status(), sort: this.sort(), ...this.cfg().extraParams }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); } });
  }
  onSort(e: Sort) { this.sort.set(e.direction ? (e.direction === 'desc' ? '-' : '') + e.active : ''); this.reload(); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  open(r: unknown) { const f = this.cfg().rowRoute; if (f) this.router.navigate(f(r)); }
}
