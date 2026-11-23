import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from '../../shared/components/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { DownloadService } from '../../core/services/download.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { ImportReport } from '../../shared/models/api.models';
import { ProductService } from './product.service';

@Component({
  selector: 'app-product-import',
  imports: [RouterLink, MatButtonModule, Icon, MatRadioModule, MatTableModule, PageHeader],
  template: `
    <div class="page">
      <app-page-header title="Import d’articles" subtitle="Fichier Excel (.xlsx) ou CSV. Analyse à blanc d’abord : rien n’est enregistré tant qu’une ligne est en erreur.">
        <a mat-stroked-button routerLink="/products"><app-icon name="arrow_back" />Articles</a>
        <button mat-stroked-button (click)="template()"><app-icon name="download" />Télécharger le modèle</button>
      </app-page-header>
      <div class="card">
        <h3>1. Fichier et mode</h3>
        <div class="row">
          <input #f type="file" accept=".xlsx,.csv" hidden (change)="pick($event)" />
          <button mat-stroked-button (click)="f.click()"><app-icon name="attach_file" />{{ file() ? file()!.name : 'Choisir un fichier…' }}</button>
          <mat-radio-group [value]="mode()" (change)="mode.set($event.value); report.set(null)">
            <mat-radio-button value="create">Création uniquement</mat-radio-button>
            @if (canUpdate) {<mat-radio-button value="upsert">Création + mise à jour (par référence)</mat-radio-button>}
          </mat-radio-group>
        </div>
        <div class="row"><button mat-flat-button color="primary" [disabled]="!file() || busy()" (click)="run(true)"><app-icon name="fact_check" />Analyser</button>
          <button mat-flat-button color="accent" [disabled]="!canApply() || busy()" (click)="run(false)"><app-icon name="publish" />Importer</button></div>
      </div>
      @if (report(); as r) {
        <div class="card" style="margin-top:16px"><h3>2. Résultat</h3>
          <p>{{ r.total }} ligne(s) — à créer : <strong>{{ r.toCreate }}</strong>, à mettre à jour : <strong>{{ r.toUpdate }}</strong>, erreurs : <strong [style.color]="r.errors.length ? 'var(--danger)' : 'var(--brand)'">{{ r.errors.length }}</strong></p>
          @if (r.applied) {<div class="ok"><app-icon name="check_circle" /> Import effectué : {{ r.created }} créé(s), {{ r.updated }} mis à jour.</div>}
          @else if (!r.errors.length) {<div class="ok"><app-icon name="info" /> Fichier valide. Cliquez sur « Importer » pour enregistrer.</div>}
          @if (r.errors.length) {<div class="table-wrap"><table mat-table [dataSource]="r.errors">
            <ng-container matColumnDef="row"><th mat-header-cell *matHeaderCellDef>Ligne</th><td mat-cell *matCellDef="let e">{{ e.row }}</td></ng-container>
            <ng-container matColumnDef="field"><th mat-header-cell *matHeaderCellDef>Colonne</th><td mat-cell *matCellDef="let e">{{ e.field }}</td></ng-container>
            <ng-container matColumnDef="msg"><th mat-header-cell *matHeaderCellDef>Erreur</th><td mat-cell *matCellDef="let e">{{ e.message }}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="['row','field','msg']"></tr><tr mat-row *matRowDef="let r; columns: ['row','field','msg']"></tr></table></div>}
        </div>}
    </div>`,
  styles: `h3{margin:0 0 12px;font-size:16px}.row{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.ok{display:flex;gap:8px;align-items:center;color:var(--brand);margin-bottom:12px}`,
})
export class ProductImport {
  private svc = inject(ProductService); private toast = inject(ToastService); private dl = inject(DownloadService);
  canUpdate = inject(AuthService).has('products:update');
  file = signal<File | null>(null); mode = signal<'create' | 'upsert'>('create'); report = signal<ImportReport | null>(null); busy = signal(false);
  canApply = () => !!this.file() && !!this.report() && this.report()!.dryRun && !this.report()!.errors.length && this.report()!.total > 0 && !this.report()!.applied;
  pick(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; this.file.set(f ?? null); this.report.set(null); }
  template() { this.dl.save('/products/import/template').subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  run(dryRun: boolean) {
    this.busy.set(true);
    this.svc.importFile(this.file()!, this.mode(), dryRun).subscribe({
      next: (r) => { this.report.set(r); this.busy.set(false); if (r.applied) { this.toast.success('Import terminé'); this.file.set(null); } },
      error: (e) => { this.toast.error(errorMessage(e)); this.busy.set(false); },
    });
  }
}
