import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { errorMessage } from '../../../core/services/api';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { Cancellation, SalesDoc } from '../sales.models';
import { SalesService } from '../sales.service';
import { CYCLE_DIALOG } from './dialog.styles';

const ROUTES = { proforma: '/proformas', deliveryNote: '/delivery-notes', invoice: '/invoices' } as const;

/** Annulation d'une proforma : le serveur indique ce qui bloque, ce qui sera annulé avec elle et le sort du devis. */
@Component({
  selector: 'app-cancel-proforma-dialog',
  imports: [ReactiveFormsModule, RouterLink, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon, Skeleton],
  template: `
    <h2 mat-dialog-title>Annuler la proforma {{ data.number }}</h2>
    <mat-dialog-content><div class="body">
      @if (error()) {<p class="err" role="alert"><app-icon name="error" />{{ error() }}</p>}
      @if (!check()) {<app-skeleton [count]="3" />}
      @else if (!check()!.allowed) {
        <p class="note warn" role="status"><strong>Annulation impossible pour l’instant.</strong> La marchandise livrée et les factures doivent d’abord être traitées :</p>
        <ul class="blockers">@for (b of check()!.blockers; track b.id + b.message) {<li><a [routerLink]="[route(b.type), b.id]" mat-dialog-close>{{ b.number ?? 'Brouillon' }}</a> — {{ b.message }}</li>}</ul>
      } @else {
        <p class="note">La proforma est conservée avec le motif, l’auteur et la date. Aucun mouvement de stock ni écriture n’est créé.</p>
        <ul class="effects">
          @for (d of check()!.draftDeliveries; track d.id) {<li>Le bon de livraison en préparation <strong>{{ d.number }}</strong> sera annulé.</li>}
          @if (check()!.quotation; as q) {<li>@if (q.willCancel) {Le devis <strong>{{ q.number }}</strong> passera à « Annulé ».} @else {Le devis <strong>{{ q.number }}</strong> garde son statut : {{ q.reason }}.}</li>}
          @for (w of check()!.warnings; track w) {<li class="w">{{ w }}</li>}
        </ul>
        <mat-form-field appearance="outline"><mat-label>Motif de l’annulation</mat-label><textarea matInput rows="2" maxlength="300" [formControl]="reason" required></textarea>
          @if (reason.invalid && reason.touched) {<mat-error>3 caractères minimum</mat-error>}</mat-form-field>
      }
    </div></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Fermer</button>
      @if (check()?.allowed) {<button mat-flat-button color="warn" type="button" [disabled]="busy()" (click)="confirm()">Annuler la proforma</button>}</mat-dialog-actions>`,
  styles: CYCLE_DIALOG + `.effects .w{color:var(--accent-ink)}`,
})
export class CancelProformaDialog {
  data = inject<{ id: string; number: string }>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<CancelProformaDialog>); private svc = inject(SalesService);
  check = signal<Cancellation | null>(null); error = signal(''); busy = signal(false);
  reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] });
  route = (t: keyof typeof ROUTES) => ROUTES[t];
  constructor() { this.load(); }
  private load() { this.svc.cancellation(this.data.id).subscribe({ next: (c) => this.check.set(c), error: (e) => this.error.set(errorMessage(e)) }); }
  confirm() {
    if (this.reason.value.trim().length < 3) { this.reason.markAsTouched(); this.error.set('Indiquez le motif de l’annulation.'); return; }
    this.busy.set(true); this.error.set('');
    this.svc.action<SalesDoc>('proformas', this.data.id, 'cancel', { reason: this.reason.value.trim() }).subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); this.load(); } });
  }
}
