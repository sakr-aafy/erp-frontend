import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from '../../../shared/components/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../../core/services/api.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state';
import { PageHeader } from '../../../shared/components/page-header';

/** Journal des événements de stock : succès, échecs, reprise et réconciliation. */
@Component({
  selector: 'app-stock-events',
  imports: [DatePipe, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule, Icon, MatSelectModule, PageHeader, EmptyState],
  template: `<div class="page"><app-page-header title="Événements de stock" subtitle="Chaque traitement est journalisé (idempotent). Un échec peut être rejoué ; la réconciliation rejoue les documents validés non traités et contrôle les niveaux.">
      <a mat-stroked-button routerLink="/stock"><app-icon name="arrow_back" />Stock</a><button mat-flat-button color="primary" (click)="reconcile()" [disabled]="busy()"><app-icon name="rule" />Réconcilier</button></app-page-header>
    @if (report()) {<div class="card" style="margin-bottom:16px" [style.border-color]="report().consistency.consistent ? 'var(--brand-200)' : 'var(--danger-200)'"><strong>Réconciliation :</strong> {{ report().replayed.length }} document(s) rejoué(s), {{ report().failed.length }} échec(s) —
      niveaux {{ report().consistency.consistent ? 'cohérents avec les mouvements' : 'INCOHÉRENTS (' + report().consistency.mismatches.length + ')' }} ({{ report().consistency.levelsChecked }} niveaux contrôlés).
      @for (f of report().failed; track f.number) {<div style="color:var(--danger)">{{ f.number }} : {{ f.error }}</div>}</div>}
    <div class="card"><div class="toolbar-row"><mat-select [value]="status()" (selectionChange)="status.set($event.value); reload()" style="max-width:220px;border:1px solid var(--border-strong);border-radius:6px;padding:10px"><mat-option value="">Tous</mat-option><mat-option value="failed">Échecs</mat-option><mat-option value="processed">Traités</mat-option></mat-select></div>
      @if (!items().length) {<app-empty-state icon="history" message="Aucun événement." />} @else {
      <div class="table-wrap"><table mat-table [dataSource]="items()">
        <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let e">{{ e.at | date: 'dd/MM/yyyy HH:mm' }}</td></ng-container>
        <ng-container matColumnDef="ev"><th mat-header-cell *matHeaderCellDef>Événement</th><td mat-cell *matCellDef="let e">{{ e.event }}<br><span class="muted">{{ e.documentNumber }}</span></td></ng-container>
        <ng-container matColumnDef="st"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let e"><span class="chip" [class.ok]="e.status === 'processed'" [class.off]="e.status === 'failed'">{{ e.status === 'processed' ? 'Traité' : 'Échec' }}</span> <span class="muted">{{ e.attempts }} tentative(s)</span></td></ng-container>
        <ng-container matColumnDef="mv"><th mat-header-cell *matHeaderCellDef>Mouvements</th><td mat-cell *matCellDef="let e">{{ e.movements }}</td></ng-container>
        <ng-container matColumnDef="er"><th mat-header-cell *matHeaderCellDef>Erreur</th><td mat-cell *matCellDef="let e" style="color:var(--danger);max-width:340px">{{ e.error }}</td></ng-container>
        <ng-container matColumnDef="ac"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let e">@if (e.status === 'failed') {<button mat-stroked-button color="primary" (click)="retry(e)">Rejouer</button>}</td></ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}
      <mat-paginator [length]="total()" [pageSize]="20" [pageIndex]="page()" (page)="onPage($event)" hidePageSize /></div></div>`,
})
export class StockEvents {
  private api = inject(Api); private toast = inject(ToastService); cols = ['at', 'ev', 'st', 'mv', 'er', 'ac']; items = signal<any[]>([]); total = signal(0); page = signal(0); status = signal(''); busy = signal(false); report = signal<any>(null);  
  ngOnInit() { this.load(); } reload() { this.page.set(0); this.load(); }
  load() { this.api.get('/stock/events', { page: this.page() + 1, limit: 20, status: this.status() }).subscribe({ next: (r) => { this.items.set(r.items); this.total.set(r.total); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex); this.load(); }
  retry(e: { id: string }) { this.api.post(`/stock/events/${e.id}/retry`).subscribe({ next: () => { this.toast.success('Opération rejouée avec succès'); this.load(); }, error: (er) => { this.toast.error(errorMessage(er)); this.load(); } }); }
  reconcile() { this.busy.set(true); this.api.post('/stock/reconcile').subscribe({ next: (r) => { this.report.set(r); this.busy.set(false); this.load(); }, error: (e) => { this.toast.error(errorMessage(e)); this.busy.set(false); } }); }
}
