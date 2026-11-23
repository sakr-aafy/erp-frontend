import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, of, switchMap } from 'rxjs';
import { Api } from '../../core/services/api.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';

export interface LineOpts { price?: boolean; discount?: boolean; vat?: boolean; serials?: boolean; priceDecimals?: number; priceLabel?: string; forbidFree?: boolean }
export const lineGroup = (fb: FormBuilder, l: Partial<{ productId: string; reference: string; designation: string; quantity: number; unitPrice: number; discountPct: number; vatCode: string; orderLineId: string; serials: string }> = {}) =>
  fb.nonNullable.group({ productId: [l.productId ?? ''], reference: [l.reference ?? ''], designation: [l.designation ?? '', Validators.required], quantity: [l.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
    unitPrice: [l.unitPrice ?? 0, [Validators.required, Validators.min(0)]], discountPct: [l.discountPct ?? 0, [Validators.min(0), Validators.max(100)]], vatCode: [l.vatCode ?? ''], orderLineId: [l.orderLineId ?? ''], serials: [l.serials ?? ''] });
export type LineGroup = ReturnType<typeof lineGroup>;

/** Éditeur de lignes (articles) réutilisé par les achats, transferts, importations. */
@Component({
  selector: 'app-lines-editor',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, Icon, MatAutocompleteModule],
  template: `
    <div class="table-wrap"><table class="lines"><thead><tr><th>Article</th><th class="r">Qté</th>@if (opts().price) {<th class="r">{{ opts().priceLabel ?? 'Prix unitaire' }}</th>}@if (opts().discount) {<th class="r">Rem. %</th>}@if (opts().vat) {<th>TVA</th>}@if (opts().serials) {<th>N° de série</th>}<th></th></tr></thead>
      <tbody>@if (!array().length) {<tr><td colspan="7" class="muted">Aucune ligne : ajoutez un article ci-dessous.</td></tr>}
        @for (g of array().controls; track $index; let i = $index) {<tr [formGroup]="g">
          <td><input class="w" formControlName="designation" aria-label="Désignation" [readonly]="!!g.controls.productId.value" />@if (g.controls.reference.value) {<small class="muted">{{ g.controls.reference.value }}</small>}</td>
          <td class="r"><input class="q" type="number" min="0.001" step="0.001" formControlName="quantity" aria-label="Quantité" /></td>
          @if (opts().price) {<td class="r"><input class="p" type="number" min="0" [step]="1 / 10 ** dec()" formControlName="unitPrice" aria-label="Prix unitaire" /></td>}
          @if (opts().discount) {<td class="r"><input class="d" type="number" min="0" max="100" step="0.01" formControlName="discountPct" aria-label="Remise %" /></td>}
          @if (opts().vat) {<td><select formControlName="vatCode" aria-label="Code TVA"><option value="">(article)</option>@for (v of ref.vatRates(); track v.code) {<option [value]="v.code">{{ v.code }}</option>}</select></td>}
          @if (opts().serials) {<td><textarea rows="1" formControlName="serials" placeholder="un par ligne (si article suivi par série)" aria-label="Numéros de série"></textarea></td>}
          <td><button mat-icon-button type="button" (click)="array().removeAt(i)" aria-label="Retirer la ligne"><app-icon name="delete" /></button></td></tr>}</tbody></table></div>
    <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:100%;max-width:520px;margin-top:12px"><mat-label>Ajouter un article du catalogue</mat-label><app-icon matPrefix name="search" />
      <input matInput [formControl]="search" [matAutocomplete]="pa" placeholder="Référence ou désignation" />
      <mat-autocomplete #pa="matAutocomplete" (optionSelected)="add($event.option.value)">@for (p of options(); track p.id) {<mat-option [value]="p">{{ p.reference }} — {{ p.name }}</mat-option>}</mat-autocomplete></mat-form-field>`,
  styles: `.lines{width:100%;border-collapse:collapse;min-width:640px}.lines th,.lines td{padding:6px 8px;border-bottom:1px solid var(--erp-border);text-align:left;vertical-align:middle}.lines th{color:var(--muted);font-weight:500;font-size:13px}.r{text-align:right!important}
    .lines input,.lines select,.lines textarea{font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px 8px;background:#fff}.w{width:100%;min-width:200px}.q{width:80px;text-align:right}.p{width:120px;text-align:right}.d{width:70px;text-align:right}`,
})
export class LinesEditor {
  array = input.required<FormArray<LineGroup>>(); opts = input<LineOpts>({});
  private api = inject(Api); ref = inject(ReferenceDataService); private fb = inject(FormBuilder);
  dec = computed(() => this.opts().priceDecimals ?? this.ref.decimals());
  search = new FormControl('', { nonNullable: true }); options = signal<{ id: string; reference: string; name: string; purchasePriceMinor: number; salePriceMinor: number; vatRateCode: string }[]>([]);
  constructor() { this.search.valueChanges.pipe(debounceTime(250), switchMap((v) => (v.length ? this.api.get('/products', { q: v, limit: 10, active: 'true' }) : of(null))), takeUntilDestroyed()).subscribe((r) => { if (r) this.options.set(r.items); }); }
  add(p: { id: string; reference: string; name: string; purchasePriceMinor: number; vatRateCode: string }) {
    this.array().push(lineGroup(this.fb, { productId: p.id, reference: p.reference, designation: p.name, unitPrice: this.opts().priceDecimals ? 0 : this.ref.fromMinor(p.purchasePriceMinor), vatCode: '' }));
    this.search.setValue('');
  }
}

/** Autocomplétion d'une partie (client / fournisseur) : renvoie l'identifiant choisi. */
@Component({
  selector: 'app-party-picker',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule],
  template: `<mat-form-field appearance="outline" style="width:100%"><mat-label>{{ label() }}</mat-label>
    <input matInput [formControl]="ctrl" [matAutocomplete]="a" [readonly]="readonly()" />
    <mat-autocomplete #a="matAutocomplete" [displayWith]="show" (optionSelected)="picked.emit($event.option.value.id)">@for (o of options(); track o.id) {<mat-option [value]="o">{{ o.name }} <small class="muted">{{ o.taxId }}</small></mat-option>}</mat-autocomplete></mat-form-field>`,
})
export class PartyPicker {
  initial = input<{ id: string; name: string } | null>(null);
  label = input('Fournisseur'); endpoint = input('/suppliers'); extra = input<Record<string, string | boolean>>({}); readonly = input(false);
  picked = output<string>();
  private api = inject(Api); ctrl = new FormControl<string | { id: string; name: string }>('', { nonNullable: true }); options = signal<{ id: string; name: string; taxId: string | null }[]>([]);
  show = (o: { name: string } | string | null) => (typeof o === 'string' ? o : o?.name ?? '');
  constructor() { this.ctrl.valueChanges.pipe(debounceTime(250), switchMap((v) => (typeof v === 'string' && v.length ? this.api.get(this.endpoint(), { q: v, limit: 10, status: 'active', ...this.extra() }) : of(null))), takeUntilDestroyed()).subscribe((r) => { if (r) this.options.set(r.items); }); }
  constructor2 = effect(() => { const i = this.initial(); if (i) this.ctrl.setValue(i, { emitEvent: false }); });
}
