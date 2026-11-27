import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { errorMessage } from '../../../core/services/api';
import { Api } from '../../../core/services/api.service';
import { Icon } from '../../../shared/components/icon';
import { Skeleton } from '../../../shared/components/skeleton';
import { DecimalInput } from '../../../shared/directives/decimal-input.directive';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';
import { Returnable, SalesDoc, WarehouseOption } from '../sales.models';
import { SalesService } from '../sales.service';
import { CYCLE_DIALOG } from './dialog.styles';

const reasonControl = () => new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] });

/** Annulation d'un BL validé non facturé : la réintégration au stock exige la confirmation du retour physique. */
@Component({
  selector: 'app-delivery-cancel-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, Icon],
  template: `
    <h2 mat-dialog-title>Annuler la livraison {{ data.number }}</h2>
    <mat-dialog-content><div class="body">
      @if (error()) {<p class="err" role="alert"><app-icon name="error" />{{ error() }}</p>}
      <p class="note warn">Le stock et les numéros de série sont réintégrés dans le magasin de sortie et les quantités redeviennent à livrer. Le bon de livraison est conservé.</p>
      <mat-form-field appearance="outline"><mat-label>Motif de l’annulation</mat-label><textarea matInput rows="2" maxlength="300" [formControl]="reason" required></textarea></mat-form-field>
      <mat-checkbox class="confirm" [checked]="confirmed()" (change)="confirmed.set($event.checked)">Je confirme que la marchandise est physiquement en magasin (revenue ou jamais partie).</mat-checkbox>
    </div></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Fermer</button><button mat-flat-button color="warn" type="button" [disabled]="busy() || !confirmed()" (click)="save()">Annuler la livraison</button></mat-dialog-actions>`,
  styles: CYCLE_DIALOG,
})
export class DeliveryCancelDialog {
  data = inject<{ id: string; number: string }>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<DeliveryCancelDialog>); private svc = inject(SalesService);
  reason = reasonControl(); confirmed = signal(false); busy = signal(false); error = signal('');
  save() {
    if (this.reason.value.trim().length < 3) { this.error.set('Indiquez le motif de l’annulation.'); return; }
    this.busy.set(true); this.error.set('');
    this.svc.action<SalesDoc>('delivery-notes', this.data.id, 'cancel', { reason: this.reason.value.trim(), returnConfirmed: true }).subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

/** Retour physique, total ou partiel : quantités non facturées, ou créditées par un avoir « retour de marchandise ». */
@Component({
  selector: 'app-return-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule, DecimalInput, Icon, Skeleton, QtyPipe],
  template: `
    <h2 mat-dialog-title>Retour physique — {{ data.number }}</h2>
    <mat-dialog-content><div class="body">
      @if (error()) {<p class="err" role="alert"><app-icon name="error" />{{ error() }}</p>}
      @if (!info()) {<app-skeleton [count]="3" />}
      @else if (!any()) {<p class="note warn" role="status"><strong>Aucune quantité retournable.</strong> Une quantité facturée exige d’abord un avoir « retour de marchandise » validé sur la facture.</p>}
      @else {
        <div class="table-wrap"><table><thead><tr><th>Désignation</th><th class="r">Livré</th><th class="r">Retournable</th><th class="r">Quantité retournée</th></tr></thead>
          <tbody>@for (l of info()!.lines; track l.lineId; let i = $index) {<tr><td>{{ l.designation }}@if (l.credited) {<small class="muted">{{ l.credited | qty }} créditée(s) par avoir</small>}@if (l.billed && !l.credited) {<small class="muted">{{ l.billed | qty }} facturée(s)</small>}
              @if (l.serials.length && l.returnable) {<div class="serials" role="group" [attr.aria-label]="'Numéros de série retournés ' + l.designation">@for (s of l.serials; track s) {<mat-checkbox [checked]="chosen(l.lineId).includes(s)" (change)="toggle(l.lineId, i, s, $event.checked)">{{ s }}</mat-checkbox>}</div>}</td>
            <td class="r" data-label="Livré">{{ l.delivered | qty }} {{ l.unit }}</td><td class="r" data-label="Retournable">{{ l.returnable | qty }}</td>
            <td class="r" data-label="Quantité retournée"><input appDecimal class="q" [formControl]="quantities[i]!" [readOnly]="!!l.serials.length || !l.returnable" [class.bad]="over(i)" [attr.aria-label]="'Quantité retournée ' + l.designation" />@if (over(i)) {<small class="err-t">Maximum {{ l.returnable | qty }}</small>}</td></tr>}</tbody></table></div>
        @if (warehouses().length) {<mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Magasin de réintégration</mat-label><mat-select [formControl]="warehouse">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>}
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Motif du retour</mat-label><textarea matInput rows="2" maxlength="300" [formControl]="reason" required></textarea></mat-form-field>
        <mat-checkbox class="confirm" [checked]="confirmed()" (change)="confirmed.set($event.checked)">Je confirme avoir constaté le retour physique de ces quantités au magasin.</mat-checkbox>
      }
    </div></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Fermer</button>
      @if (any()) {<button mat-flat-button color="primary" type="button" [disabled]="busy() || !confirmed()" (click)="save()">Enregistrer le retour</button>}</mat-dialog-actions>`,
  styles: CYCLE_DIALOG + `.err-t{color:var(--danger)}`,
})
export class ReturnDialog {
  data = inject<{ id: string; number: string; warehouseId: string | null }>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<ReturnDialog>); private svc = inject(SalesService); private api = inject(Api);
  info = signal<Returnable | null>(null); warehouses = signal<WarehouseOption[]>([]); selected = signal<Record<string, string[]>>({});
  quantities: FormControl<number | null>[] = []; warehouse = new FormControl('', { nonNullable: true }); reason = reasonControl(); confirmed = signal(false); busy = signal(false); error = signal('');
  /** Une même saisie soumise deux fois n'enregistre qu'un retour. */
  private requestId = crypto.randomUUID();
  any = computed(() => !!this.info()?.lines.some((l) => l.returnable > 0));
  chosen = (lineId: string) => this.selected()[lineId] ?? [];
  over = (i: number) => (Number(this.quantities[i]?.value) || 0) > this.info()!.lines[i]!.returnable + 1e-9;
  constructor() {
    this.svc.returnable(this.data.id).subscribe({ next: (r) => { this.quantities = r.lines.map(() => new FormControl<number | null>(0)); this.info.set(r); }, error: (e) => this.error.set(errorMessage(e)) });
    this.api.get('/warehouses').subscribe({ next: (w: WarehouseOption[]) => { const active = w.filter((x) => x.isActive); this.warehouses.set(active); this.warehouse.setValue(active.find((x) => x.id === this.data.warehouseId)?.id ?? active.find((x) => x.isDefault)?.id ?? active[0]?.id ?? ''); },
      error: () => undefined }); // sans « stock : consulter », le magasin de sortie du bon est repris par le serveur
  }
  toggle(lineId: string, i: number, serial: string, on: boolean) {
    const list = on ? [...this.chosen(lineId), serial] : this.chosen(lineId).filter((s) => s !== serial);
    this.selected.update((v) => ({ ...v, [lineId]: list })); this.quantities[i]!.setValue(list.length);
  }
  save() {
    const lines = this.info()!.lines.map((l, i) => ({ lineId: l.lineId, quantity: Number(this.quantities[i]!.value) || 0, ...(this.chosen(l.lineId).length && { serials: this.chosen(l.lineId) }) })).filter((l) => l.quantity > 0);
    if (!lines.length) { this.error.set('Indiquez au moins une quantité retournée.'); return; }
    if (this.info()!.lines.some((_, i) => this.over(i))) { this.error.set('Une quantité dépasse ce qui peut être retourné.'); return; }
    if (this.reason.value.trim().length < 3) { this.error.set('Indiquez le motif du retour.'); return; }
    this.busy.set(true); this.error.set('');
    this.svc.returnDelivery(this.data.id, { reason: this.reason.value.trim(), returnConfirmed: true, requestId: this.requestId, ...(this.warehouse.value && { warehouseId: this.warehouse.value }), lines })
      .subscribe({ next: (r) => this.ref.close(r), error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); } });
  }
}

/** Choix des numéros de série disponibles dans le magasin de sortie. */
@Component({
  selector: 'app-serial-picker',
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, Icon, Skeleton],
  template: `
    <h2 mat-dialog-title>Numéros de série — {{ data.designation }}</h2>
    <mat-dialog-content><div class="body">
      @if (error()) {<p class="err" role="alert"><app-icon name="error" />{{ error() }}</p>}
      <p class="note" role="status">{{ picked().length }} sélectionné(s) sur {{ data.quantity }} requis — magasin {{ data.warehouseLabel }}</p>
      @if (!items()) {<app-skeleton [count]="3" />}
      @else if (!items()!.length) {<p class="note warn">Aucun numéro de série disponible pour cet article dans ce magasin.</p>}
      @else {
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Rechercher un numéro</mat-label><app-icon matPrefix name="search" /><input matInput [value]="q()" (input)="q.set($any($event.target).value)" /></mat-form-field>
        <div class="serials list">@for (s of shown(); track s.serialNumber) {<mat-checkbox [checked]="picked().includes(s.serialNumber)" [disabled]="!!s.assignedTo || (!picked().includes(s.serialNumber) && picked().length >= data.quantity)" (change)="toggle(s.serialNumber, $event.checked)">{{ s.serialNumber }}@if (s.assignedTo) { <small class="muted">(BL {{ s.assignedTo }})</small>}</mat-checkbox>}</div>
      }
    </div></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" type="button" (click)="ref.close(picked())">Valider la sélection</button></mat-dialog-actions>`,
  styles: CYCLE_DIALOG + `.list{max-height:320px;overflow:auto}`,
})
export class SerialPicker {
  data = inject<{ productId: string; warehouseId: string; warehouseLabel: string; designation: string; quantity: number; selected: string[]; excludeId?: string }>(MAT_DIALOG_DATA); ref = inject(MatDialogRef<SerialPicker>); private svc = inject(SalesService);
  items = signal<{ serialNumber: string; assignedTo: string | null }[] | null>(null); picked = signal<string[]>(this.data.selected); q = signal(''); error = signal('');
  shown = computed(() => { const q = this.q().trim().toLowerCase(); return (this.items() ?? []).filter((s) => !q || s.serialNumber.toLowerCase().includes(q)); });
  constructor() {
    this.svc.availableSerials(this.data.productId, this.data.warehouseId, this.data.excludeId).subscribe({ next: (r) => { this.items.set(r.items); this.picked.update((p) => p.filter((s) => r.items.some((x) => x.serialNumber === s))); }, error: (e) => this.error.set(errorMessage(e)) });
  }
  toggle(s: string, on: boolean) { this.picked.update((p) => (on ? [...p, s] : p.filter((x) => x !== s))); }
}
