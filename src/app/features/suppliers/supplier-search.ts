import { Component, DestroyRef, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Icon } from '../../shared/components/icon';
import { pagedLookup, watchPanelScroll } from '../../shared/components/paged-lookup';
import { SupplierDto } from '../../shared/models/api.models';
import { SUPPLIER_STATUS_CHIP } from './supplier.labels';
import { SupplierQuery, SupplierService } from './supplier.service';

export interface SupplierSearchValue { q: string; supplier: SupplierDto | null }

/**
 * Recherche d'un fournisseur (même composant que la recherche d'article) : suggestions au clic sans saisie, par code, raison
 * sociale, nom commercial, matricule fiscal, téléphone ou e-mail (côté serveur, avec les filtres de la liste).
 */
@Component({
  selector: 'app-supplier-search',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, Icon],
  template: `
    <mat-form-field appearance="outline" class="w" subscriptSizing="dynamic">
      <mat-label>Rechercher un fournisseur</mat-label>
      <app-icon matPrefix name="search" />
      <input #box matInput [formControl]="text" [matAutocomplete]="auto" placeholder="Code, nom, matricule, téléphone, e-mail…" autocomplete="off"
        (focus)="open()" (click)="open()" (input)="typed()" (keydown.enter)="submit($event)" />
      @if (lookup.loading()) {<mat-spinner matSuffix diameter="18" class="spin" aria-label="Chargement" />}
      @if (hasValue()) {<button matSuffix mat-icon-button type="button" aria-label="Effacer la recherche" (click)="clear($event)"><app-icon name="close" /></button>}
      <mat-autocomplete #auto="matAutocomplete" class="lookup-panel" panelWidth="min(460px, calc(100vw - 76px))" (optionSelected)="pick($event.option.value)" [displayWith]="show" (opened)="onOpened()" (closed)="opened = false">
        @for (s of lookup.items(); track s.id) {
          <mat-option [value]="s"><span class="opt"><span class="code">{{ s.code ?? '—' }}</span><span class="txt"><span class="name">{{ s.name }}</span>
            <span class="sub">{{ s.categoryName ?? 'Non classé' }}@if (s.tradeName) { · {{ s.tradeName }}}@if (s.address.city) { · {{ s.address.city }}}</span></span>@if (s.status !== 'active') {<span class="chip {{ chip[s.status] }}">{{ s.statusLabel }}</span>}</span></mat-option>}
        @if (lookup.loading()) {<mat-option disabled class="state">Chargement…</mat-option>}
        @if (lookup.error()) {<mat-option disabled class="state">Impossible de charger les fournisseurs. Fermez la liste et réessayez.</mat-option>}
        @if (lookup.empty()) {<mat-option disabled class="state">Aucun fournisseur trouvé</mat-option>}
        @if (lookup.items().length && lookup.items().length < lookup.total()) {<mat-option disabled class="state">{{ lookup.items().length }} sur {{ lookup.total() }} — faites défiler pour la suite</mat-option>}
      </mat-autocomplete>
    </mat-form-field>`,
  styles: `:host{display:block}.w{width:100%}.spin{margin-right:6px}`,
})
export class SupplierSearch {
  filters = input<Partial<SupplierQuery>>({});
  changed = output<SupplierSearchValue>();
  private svc = inject(SupplierService); private destroy = inject(DestroyRef);
  private trigger = viewChild.required(MatAutocompleteTrigger); private box = viewChild.required<ElementRef<HTMLInputElement>>('box'); private auto = viewChild.required<MatAutocomplete>('auto');
  text = new FormControl<string | SupplierDto>('', { nonNullable: true });
  selected: SupplierDto | null = null; opened = false; chip = SUPPLIER_STATUS_CHIP;
  lookup = pagedLookup<SupplierDto>((q, page) => this.svc.list({ ...this.filters(), q, page, limit: 15 }), this.destroy);
  private pending: ReturnType<typeof setTimeout> | undefined;
  show = (s: SupplierDto | string | null) => (typeof s === 'string' ? s : s?.name ?? '');
  hasValue() { return !!this.selected || !!this.text.value; }
  open() {
    if (this.opened) return;
    this.opened = true;
    if (this.selected) this.box().nativeElement.select();
    this.lookup.open(this.selected ? '' : String(this.text.value));
    this.trigger().openPanel();
  }
  typed() {
    const q = String(this.text.value); this.opened = true; this.selected = null; this.lookup.type(q);
    clearTimeout(this.pending); this.pending = setTimeout(() => this.changed.emit({ q: q.trim(), supplier: null }), 300);
  }
  onOpened() { this.opened = true; setTimeout(() => watchPanelScroll(this.auto().panel?.nativeElement, this.lookup.more)); }
  pick(s: SupplierDto) { clearTimeout(this.pending); this.selected = s; this.opened = false; this.text.setValue(s.name); this.changed.emit({ q: '', supplier: s }); }
  submit(e: Event) {
    if (this.trigger().activeOption) return;
    e.preventDefault(); clearTimeout(this.pending); this.trigger().closePanel();
    if (!this.selected) this.changed.emit({ q: String(this.text.value).trim(), supplier: null });
  }
  clear(e: Event) { e.stopPropagation(); clearTimeout(this.pending); this.trigger().closePanel(); this.opened = false; this.selected = null; this.text.setValue(''); this.changed.emit({ q: '', supplier: null }); }
}
