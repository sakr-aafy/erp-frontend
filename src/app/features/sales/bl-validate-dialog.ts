import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Api } from '../../core/services/api.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';

/** Validation d'un BL : choix du magasin de sortie ; autorisation explicite du stock négatif (permission inventory:validate). */
@Component({
  selector: 'app-bl-validate-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatSlideToggleModule],
  template: `<h2 mat-dialog-title>Valider la livraison</h2>
    <form [formGroup]="form" (ngSubmit)="save()"><mat-dialog-content style="display:flex;flex-direction:column;min-width:min(440px,86vw)">
      <p class="muted">La livraison est acquise et le stock sort du magasin choisi, valorisé au coût moyen pondéré. Un stock insuffisant refuse la validation.</p>
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      <mat-form-field appearance="outline"><mat-label>Magasin de sortie</mat-label><mat-select formControlName="warehouseId">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
      @if (auth.has('inventory:validate')) {<mat-slide-toggle formControlName="allowNegativeStock">Autoriser un stock négatif (autorisation explicite, auditée)</mat-slide-toggle>}
    </mat-dialog-content><mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" [disabled]="loading()">Valider</button></mat-dialog-actions></form>`,
})
export class BlValidateDialog {
  data = inject<{ id: string }>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<BlValidateDialog>); private api = inject(Api); auth = inject(AuthService);
  warehouses = signal<{ id: string; code: string; name: string }[]>([]); form = new FormBuilder().nonNullable.group({ warehouseId: [''], allowNegativeStock: [false] }); loading = signal(false); error = signal('');
  constructor() { this.api.get('/warehouses').subscribe((w) => { this.warehouses.set(w.filter((x: { isActive: boolean }) => x.isActive)); const d = w.find((x: { isDefault: boolean }) => x.isDefault); if (d) this.form.controls.warehouseId.setValue(d.id); }); }
  save() { const v = this.form.getRawValue(); this.loading.set(true); this.api.post(`/delivery-notes/${this.data.id}/validate`, { ...(v.warehouseId && { warehouseId: v.warehouseId }), ...(v.allowNegativeStock && { allowNegativeStock: true }) }).subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } }); }
}
