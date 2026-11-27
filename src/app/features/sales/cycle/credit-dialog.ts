import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { errorMessage } from '../../../core/services/api';
import { Icon } from '../../../shared/components/icon';
import { DecimalInput } from '../../../shared/directives/decimal-input.directive';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';
import { CREDIT_EFFECTS, CreditEffect, SalesDoc } from '../sales.models';
import { SalesService } from '../sales.service';
import { CYCLE_DIALOG } from './dialog.styles';

/** Avoir total ou partiel : le motif détermine explicitement les effets sur les quantités ; aucun avoir ne mouvemente le stock. */
@Component({
  selector: 'app-credit-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatRadioModule, MatFormFieldModule, MatInputModule, DecimalInput, Icon, QtyPipe],
  template: `
    <h2 mat-dialog-title>Créer un avoir sur {{ data.number }}</h2>
    <mat-dialog-content><div class="body">
      @if (error()) {<p class="err" role="alert"><app-icon name="error" />{{ error() }}</p>}
      <mat-radio-group class="effects" [value]="effect()" (change)="effect.set($event.value)" aria-label="Effet de l’avoir">
        @for (e of effects; track e.value) {<mat-radio-button [value]="e.value"><strong>{{ e.label }}</strong><span>{{ e.help }}</span></mat-radio-button>}
      </mat-radio-group>
      <mat-checkbox [checked]="total()" (change)="total.set($event.checked)">Avoir sur la totalité des quantités non encore créditées</mat-checkbox>
      @if (!total()) {<div class="table-wrap"><table><thead><tr><th>Désignation</th><th class="r">Facturé</th><th class="r">À créditer</th></tr></thead>
        <tbody>@for (l of data.lines; track l.id; let i = $index) {<tr><td>{{ l.designation }}@if (l.delivery?.noteNumber) {<small class="muted">{{ l.delivery?.noteNumber }}</small>}</td><td class="r" data-label="Facturé">{{ l.quantity | qty }} {{ l.unit }}</td>
          <td class="r" data-label="À créditer"><input appDecimal class="q" [formControl]="quantities[i]!" [attr.aria-label]="'Quantité à créditer ' + l.designation" /></td></tr>}</tbody></table></div>}
      <mat-form-field appearance="outline"><mat-label>Motif de l’avoir</mat-label><textarea matInput rows="2" maxlength="300" [formControl]="reason" required></textarea></mat-form-field>
      <p class="muted small">L’avoir est créé en brouillon : il prend effet à sa validation.</p>
    </div></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="save()">Créer l’avoir</button></mat-dialog-actions>`,
  styles: CYCLE_DIALOG + `.effects{display:flex;flex-direction:column;gap:8px}.effects span{display:block;font-size:12px;color:var(--muted);white-space:normal}`,
})
export class CreditDialog {
  data = inject<{ id: string; number: string; lines: SalesDoc['lines']; delivery: boolean }>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<CreditDialog>); private svc = inject(SalesService);
  /** La correction de facturation ne concerne que les factures issues de bons de livraison. */
  effects = CREDIT_EFFECTS.filter((e) => e.value !== 'billing_correction' || this.data.delivery);
  effect = signal<CreditEffect>('financial'); total = signal(true); busy = signal(false); error = signal('');
  quantities = this.data.lines.map(() => new FormControl<number | null>(0));
  reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] });
  save() {
    if (this.reason.value.trim().length < 3) { this.error.set('Indiquez le motif de l’avoir (3 caractères minimum).'); return; }
    const lines = this.data.lines.map((l, i) => ({ sourceLineId: l.id!, quantity: Number(this.quantities[i]!.value) || 0 })).filter((l) => l.quantity > 0);
    if (!this.total() && !lines.length) { this.error.set('Indiquez au moins une quantité à créditer.'); return; }
    this.busy.set(true); this.error.set('');
    this.svc.creditNote(this.data.id, { reason: this.reason.value.trim(), effect: this.effect(), ...(!this.total() && { lines }) }).subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}
