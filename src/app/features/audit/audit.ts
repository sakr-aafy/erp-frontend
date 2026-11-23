import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { AuditLogDto, Page } from '../../shared/models/api.models';

@Component({
  selector: 'app-audit',
  imports: [ReactiveFormsModule, DatePipe, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, PageHeader, EmptyState, Skeleton],
  template: `
    <div class="page">
      <app-page-header title="Journal d’audit" subtitle="Traçabilité des opérations sensibles" />
      <div class="card">
        <form class="toolbar-row" [formGroup]="filters" (ngSubmit)="apply()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Utilisateur</mat-label><input matInput formControlName="q" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Ressource</mat-label>
            <mat-select formControlName="resource"><mat-option value="">Toutes</mat-option>@for (r of resources; track r) {<mat-option [value]="r">{{ resLabel(r) }}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Résultat</mat-label>
            <mat-select formControlName="success"><mat-option value="">Tous</mat-option><mat-option value="true">Succès</mat-option><mat-option value="false">Échec</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Du</mat-label><input matInput type="date" formControlName="from" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Au</mat-label><input matInput type="date" formControlName="to" /></mat-form-field>
          <button mat-flat-button color="primary">Filtrer</button>
        </form>
        @if (loading() && !items().length) {<app-skeleton />}
        @else if (!items().length) {<app-empty-state icon="history" message="Aucune entrée." />}
        @else {
          <div class="table-wrap"><table mat-table [dataSource]="items()">
            <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let l">{{ l.at | date: 'dd/MM/yyyy HH:mm:ss' }}</td></ng-container>
            <ng-container matColumnDef="user"><th mat-header-cell *matHeaderCellDef>Utilisateur</th><td mat-cell *matCellDef="let l">{{ l.userName ?? '—' }}</td></ng-container>
            <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>Action</th><td mat-cell *matCellDef="let l">{{ resLabel(l.resource) }} · {{ actLabel(l.action) }}</td></ng-container>
            <ng-container matColumnDef="res"><th mat-header-cell *matHeaderCellDef>Résultat</th><td mat-cell *matCellDef="let l"><span class="chip" [class.ok]="l.success" [class.off]="!l.success">{{ l.success ? 'Succès' : 'Échec' }}</span></td></ng-container>
            <ng-container matColumnDef="ip"><th mat-header-cell *matHeaderCellDef>IP</th><td mat-cell *matCellDef="let l">{{ l.ip }}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
          </table></div>
        }
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[20, 50, 100]" (page)="onPage($event)" />
      </div>
    </div>`,
})
export class AuditPage {
  private http = inject(HttpClient); private toast = inject(ToastService);
  cols = ['at', 'user', 'action', 'res', 'ip'];
  resources: string[] = ['auth', 'user', 'role', 'company', 'settings'];
  static RES: Record<string, string> = { auth: 'Authentification', user: 'Utilisateur', role: 'Rôle', company: 'Société', settings: 'Paramètres', customer: 'Client', supplier: 'Fournisseur', product: 'Article', invoice: 'Facture', quotation: 'Devis', proforma: 'Proforma',
    'delivery-note': 'Bon de livraison', 'purchase-order': 'Commande d’achat', 'goods-receipt': 'Réception', 'purchase-invoice': 'Facture d’achat', 'import-file': 'Importation', stock: 'Stock', 'stock-transfer': 'Transfert', inventory: 'Inventaire', expense: 'Dépense', 'expense-category': 'Catégorie de dépense',
    'treasury-account': 'Compte de trésorerie', 'treasury-transfer': 'Virement', 'treasury-reconciliation': 'Rapprochement', 'supplier-payment': 'Règlement fournisseur', 'accounting-settings': 'Paramétrage comptable', accounting: 'Comptabilité', report: 'Rapport', fiscal: 'Fiscalité', 'fiscal-rule': 'Règle fiscale' };
  static ACT: Record<string, string> = { login: 'connexion', logout: 'déconnexion', create: 'création', update: 'modification', delete: 'suppression', validate: 'validation', cancel: 'annulation', export: 'export', submit: 'soumission', reject: 'rejet', reconcile: 'réconciliation', send: 'envoi', archive: 'archivage', activate: 'activation', deactivate: 'désactivation' };
  resLabel = (r: string) => AuditPage.RES[r] ?? r; actLabel = (a: string) => AuditPage.ACT[a] ?? a;
  filters = inject(FormBuilder).nonNullable.group({ q: [''], resource: [''], success: [''], from: [''], to: [''] });
  items = signal<AuditLogDto[]>([]); total = signal(0); loading = signal(true); page = signal(0); pageSize = signal(20);
  constructor() { this.load(); this.http.get<string[]>(`${environment.apiUrl}/audit-logs/resources`).subscribe({ next: (r) => { if (r.length) this.resources = r; }, error: () => undefined }); }
  apply() { this.page.set(0); this.load(); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.pageSize.set(e.pageSize); this.load(); }
  load() {
    this.loading.set(true);
    let p = new HttpParams().set('page', this.page() + 1).set('limit', this.pageSize());
    const f = this.filters.getRawValue();
    for (const [k, v] of Object.entries(f)) if (v) p = p.set(k, k === 'to' ? `${v}T23:59:59` : v);
    this.http.get<Page<AuditLogDto>>(`${environment.apiUrl}/audit-logs`, { params: p }).subscribe({
      next: (r) => { this.items.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }
}
