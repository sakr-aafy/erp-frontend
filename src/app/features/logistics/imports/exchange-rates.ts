import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../../core/services/api.service';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeader } from '../../../shared/components/page-header';

/** Taux de change du jour : conversion automatique des dossiers d'importation (dernier taux ≤ date de l'opération). */
@Component({
  selector: 'app-exchange-rates',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatTableModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, MatSelectModule, PageHeader],
  template: `<div class="page"><app-page-header title="Taux de change" subtitle="Taux vers la devise de base ({{ ref.data()?.baseCurrency }}). Le taux applicable à une opération est le dernier taux enregistré à cette date ou avant."><a mat-stroked-button routerLink="/imports"><app-icon name="arrow_back" />Importations</a></app-page-header>
    @if (auth.has('imports:create')) {<form class="card" [formGroup]="form" (ngSubmit)="save()" style="margin-bottom:16px"><div class="toolbar-row">
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Devise</mat-label><mat-select formControlName="currency">@for (c of currencies(); track c.code) {<mat-option [value]="c.code">{{ c.code }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" /></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Taux</mat-label><input matInput type="number" min="0" step="0.000001" formControlName="rate" /></mat-form-field>
      <button mat-flat-button color="primary" [disabled]="form.invalid">Enregistrer le taux</button></div></form>}
    <div class="card"><div class="table-wrap"><table mat-table [dataSource]="items()"><ng-container matColumnDef="c"><th mat-header-cell *matHeaderCellDef>Devise</th><td mat-cell *matCellDef="let r"><strong>{{ r.currency }}</strong></td></ng-container>
      <ng-container matColumnDef="d"><th mat-header-cell *matHeaderCellDef>Date</th><td mat-cell *matCellDef="let r">{{ r.date | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container><ng-container matColumnDef="r"><th mat-header-cell *matHeaderCellDef style="text-align:right">Taux</th><td mat-cell *matCellDef="let r" style="text-align:right">{{ r.rate }}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="['c','d','r']"></tr><tr mat-row *matRowDef="let r; columns: ['c','d','r']"></tr></table></div></div></div>`,
})
export class ExchangeRates {
  private api = inject(Api); private toast = inject(ToastService); ref = inject(ReferenceDataService); auth = inject(AuthService); items = signal<any[]>([]);  
  form = new FormBuilder().nonNullable.group({ currency: ['', Validators.required], date: [new Date().toISOString().slice(0, 10), Validators.required], rate: [null as number | null, [Validators.required, Validators.min(0.000001)]] });
  currencies = () => (this.ref.data()?.currencies ?? []).filter((c) => c.code !== this.ref.data()?.baseCurrency);
  ngOnInit() { this.ref.load$().subscribe(); this.load(); } load() { this.api.get('/exchange-rates').subscribe((r) => this.items.set(r)); }
  save() { const v = this.form.getRawValue(); this.api.post('/exchange-rates', { currency: v.currency, date: v.date, rate: Number(v.rate) }).subscribe({ next: () => { this.toast.success('Taux enregistré'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }); }
}
