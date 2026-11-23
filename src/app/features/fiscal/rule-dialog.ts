import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { FiscalRule, FiscalService, RuleKind } from './fiscal.service';

export interface RuleDialogData { kind: RuleKind; rule?: FiscalRule; /** nouvelle version d'un code existant */ newVersionOf?: FiscalRule }
export const DOC_TYPE_LABELS: Record<string, string> = { quotation: 'Devis', proforma: 'Facture proforma', invoice: 'Facture de vente', creditNote: 'Facture d’avoir', deliveryNote: 'Bon de livraison' };

@Component({
  selector: 'app-rule-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
        <p class="muted">Cette règle sera créée en <strong>brouillon</strong> : elle ne s’applique qu’après validation, à partir de sa date d’effet. À confirmer avec le comptable.</p>
        <div class="grid">
          <mat-form-field appearance="outline"><mat-label>Code</mat-label><input matInput formControlName="code" [readonly]="!!data.newVersionOf || !!data.rule" /><mat-hint>{{ codeHint() }}</mat-hint></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Libellé</mat-label><input matInput formControlName="label" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Date d’effet</mat-label><input matInput type="date" formControlName="effectiveFrom" /></mat-form-field>
        </div>
        @if (data.kind === 'vat') {
          <div class="grid" formGroupName="vat">
            <mat-form-field appearance="outline"><mat-label>Régime</mat-label><mat-select formControlName="regime">
              <mat-option value="taxable">Taxable (taux)</mat-option><mat-option value="zero">Taux zéro (0 %)</mat-option><mat-option value="exempt">Exonération</mat-option><mat-option value="suspended">Suspension</mat-option></mat-select></mat-form-field>
            @if (form.controls.vat.controls.regime.value === 'taxable') {<mat-form-field appearance="outline"><mat-label>Taux (%)</mat-label><input matInput type="number" step="0.01" min="0" max="100" formControlName="ratePct" /></mat-form-field>}
          </div>
        }
        @if (data.kind === 'withholding') {
          <div class="grid" formGroupName="withholding">
            <mat-form-field appearance="outline"><mat-label>Taux (%)</mat-label><input matInput type="number" step="0.01" min="0" max="100" formControlName="ratePct" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Base de calcul</mat-label><mat-select formControlName="base"><mat-option value="ttc">Montant TTC</mat-option><mat-option value="ht">Montant HT</mat-option></mat-select></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Seuil : total TTC minimal ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" formControlName="minTotal" /><mat-hint>Vide = pas de seuil</mat-hint></mat-form-field>
          </div>
          <mat-slide-toggle [formControl]="form.controls.withholding.controls.requireCustomerFlag">Réservée aux clients marqués « assujettis à la retenue »</mat-slide-toggle>
        }
        @if (data.kind === 'stamp') {
          <div class="grid" formGroupName="stamp">
            <mat-form-field appearance="outline"><mat-label>Montant du timbre ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" formControlName="amount" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Types de document</mat-label><mat-select formControlName="docTypes" multiple>@for (d of docTypes; track d.key) {<mat-option [value]="d.key">{{ d.label }}</mat-option>}</mat-select></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Seuil : total TTC minimal ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" formControlName="minTotal" /></mat-form-field>
          </div>
          <mat-slide-toggle [formControl]="form.controls.stamp.controls.exemptCustomerFlag">Les clients marqués « exonérés de timbre » en sont dispensés</mat-slide-toggle>
        }
        <mat-form-field appearance="outline" style="margin-top:8px"><mat-label>Référence légale / note</mat-label><input matInput formControlName="legalReference" /></mat-form-field>
        <mat-slide-toggle formControlName="active">Règle active (décocher = retirer la règle à partir de la date d’effet)</mat-slide-toggle>
      </mat-dialog-content>
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="loading()">Enregistrer le brouillon</button></mat-dialog-actions>
    </form>`,
  styles: `.content{display:flex;flex-direction:column;gap:6px;min-width:min(560px,86vw)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 12px}`,
})
export class RuleDialog {
  data = inject<RuleDialogData>(MAT_DIALOG_DATA); private ref_ = inject(MatDialogRef<RuleDialog>); private svc = inject(FiscalService); ref = inject(ReferenceDataService);
  docTypes = Object.entries(DOC_TYPE_LABELS).map(([key, label]) => ({ key, label }));
  loading = signal(false); error = signal('');
  private src = this.data.rule ?? this.data.newVersionOf;
  private fb = new FormBuilder().nonNullable;
  form = this.fb.group({
    code: [this.src?.code ?? '', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]+$/)]], label: [this.src?.label ?? ''],
    effectiveFrom: [this.data.rule ? this.src!.effectiveFrom.slice(0, 10) : '', Validators.required], legalReference: [this.src?.legalReference ?? ''], active: [this.src?.active ?? true],
    vat: this.fb.group({ regime: [this.src?.vat?.regime ?? 'taxable'], ratePct: [this.src?.vat?.ratePct ?? (null as number | null)] }),
    withholding: this.fb.group({ ratePct: [this.src?.withholding?.ratePct ?? (null as number | null)], base: [this.src?.withholding?.base ?? 'ttc'], minTotal: [this.src?.withholding?.minTotalMinor != null ? this.ref.fromMinor(this.src.withholding.minTotalMinor) : (null as number | null)], requireCustomerFlag: [this.src?.withholding?.requireCustomerFlag ?? true] }),
    stamp: this.fb.group({ amount: [this.src?.stamp ? this.ref.fromMinor(this.src.stamp.amountMinor) : (null as number | null)], docTypes: [this.src?.stamp?.docTypes ?? ['invoice']], minTotal: [this.src?.stamp?.minTotalMinor != null ? this.ref.fromMinor(this.src.stamp.minTotalMinor) : (null as number | null)], exemptCustomerFlag: [this.src?.stamp?.exemptCustomerFlag ?? true] }),
  });
  title = () => `${this.data.rule ? 'Modifier le brouillon' : this.data.newVersionOf ? 'Nouvelle version' : 'Nouvelle règle'} — ${({ vat: 'TVA', withholding: 'retenue à la source', stamp: 'timbre fiscal' })[this.data.kind]}`;
  codeHint = () => ({ vat: 'Ex. T19, T13, EXO', withholding: 'Type d’opération, ex. SERVICES', stamp: 'Ex. TIMBRE' })[this.data.kind];

  save() {
    const v = this.form.getRawValue(); const k = this.data.kind;
    if (this.form.controls.code.invalid || !v.effectiveFrom) { this.form.markAllAsTouched(); this.error.set('Code et date d’effet requis.'); return; }
    const num = (x: unknown) => (x === null || x === '' || x === undefined ? undefined : Number(x));
    const m = (x: unknown) => (num(x) === undefined ? null : this.ref.toMinor(num(x)));
    const base = { kind: k, code: v.code, label: v.label || undefined, effectiveFrom: v.effectiveFrom, active: v.active, legalReference: v.legalReference || undefined };
    const body = k === 'vat' ? { ...base, vat: { regime: v.vat.regime, ...(v.vat.regime === 'taxable' && { ratePct: num(v.vat.ratePct) }) } }
      : k === 'withholding' ? { ...base, withholding: { ratePct: num(v.withholding.ratePct), base: v.withholding.base, minTotalMinor: m(v.withholding.minTotal), requireCustomerFlag: v.withholding.requireCustomerFlag } }
      : { ...base, stamp: { amountMinor: this.ref.toMinor(num(v.stamp.amount) ?? 0), docTypes: v.stamp.docTypes, minTotalMinor: m(v.stamp.minTotal), exemptCustomerFlag: v.stamp.exemptCustomerFlag } };
    this.loading.set(true); this.error.set('');
    (this.data.rule ? this.svc.update(this.data.rule.id, body) : this.svc.create(body)).subscribe({ next: (r) => this.ref_.close(r), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}
