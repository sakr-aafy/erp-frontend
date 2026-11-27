import { Component, DestroyRef, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Icon } from '../../shared/components/icon';
import { pagedLookup, watchPanelScroll } from '../../shared/components/paged-lookup';
import { Customer2 } from '../../shared/models/api.models';
import { CustomerService } from './customer.service';

export interface CustomerSearchValue { q: string; customer: Customer2 | null }

/**
 * Recherche d'un client : les clients sont proposés au clic, sans saisie, puis filtrés par le serveur (code, raison sociale,
 * matricule fiscal, téléphone, e-mail) avec chargement progressif de toute la liste.
 */
@Component({
  selector: 'app-customer-search',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, Icon],
  template: `
    <mat-form-field appearance="outline" class="w" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <app-icon matPrefix name="search" />
      <input #box matInput [formControl]="text" [matAutocomplete]="auto" [placeholder]="placeholder()" autocomplete="off" [required]="required()"
        (focus)="open()" (click)="open()" (input)="typed()" (keydown.enter)="submit($event)" (blur)="restore()" />
      @if (lookup.loading()) {<mat-spinner matSuffix diameter="18" class="spin" aria-label="Chargement" />}
      @if (hasValue()) {<button matSuffix mat-icon-button type="button" aria-label="Effacer le client" (click)="clear($event)"><app-icon name="close" /></button>}
      <mat-autocomplete #auto="matAutocomplete" class="lookup-panel" panelWidth="min(460px, calc(100vw - 76px))" (optionSelected)="pick($event.option.value)" [displayWith]="show" (opened)="onOpened()" (closed)="opened = false">
        @for (c of lookup.items(); track c.id) {
          <mat-option [value]="c"><span class="opt"><span class="code">{{ c.code ?? '—' }}</span>
            <span class="txt"><span class="name">{{ c.name }}</span>@if (detail(c); as info) {<span class="sub">{{ info }}</span>}</span></span></mat-option>}
        @if (lookup.loading()) {<mat-option disabled class="state">Chargement…</mat-option>}
        @if (lookup.error()) {<mat-option disabled class="state">Impossible de charger les clients. Fermez la liste et réessayez.</mat-option>}
        @if (lookup.empty()) {<mat-option disabled class="state">Aucun client trouvé</mat-option>}
        @if (lookup.items().length && lookup.items().length < lookup.total()) {<mat-option disabled class="state">{{ lookup.items().length }} sur {{ lookup.total() }} — faites défiler pour la suite</mat-option>}
      </mat-autocomplete>
      @if (error()) {<mat-hint class="bad" role="alert">{{ error() }}</mat-hint>}
    </mat-form-field>`,
  styles: `:host{display:block}.w{width:100%}.spin{margin-right:6px}.bad{color:var(--danger)}`,
})
export class CustomerSearch {
  label = input('Rechercher un client'); placeholder = input('Code, nom, matricule, téléphone, e-mail…');
  /** Filtres appliqués aux suggestions (ex. clients actifs pour un nouveau document). */
  filters = input<Record<string, string>>({ status: 'open' });
  /** Client déjà choisi (modification d'un document, préselection). */
  selection = input<{ name?: string | null; id?: string } | null>(null);
  /** Sélecteur de formulaire : le texte libre n'est pas une valeur, il revient à la sélection en quittant le champ. */
  pickOnly = input(false); required = input(false); error = input('');
  changed = output<CustomerSearchValue>();
  private svc = inject(CustomerService); private destroy = inject(DestroyRef);
  private trigger = viewChild.required(MatAutocompleteTrigger); private box = viewChild.required<ElementRef<HTMLInputElement>>('box'); private auto = viewChild.required<MatAutocomplete>('auto');
  text = new FormControl<string | Customer2>('', { nonNullable: true });
  private selectedName = ''; selected = false; opened = false;
  lookup = pagedLookup<Customer2>((q, page) => this.svc.list({ ...this.filters(), q, page, limit: 15 }), this.destroy);
  private pending: ReturnType<typeof setTimeout> | undefined;
  constructor() {
    effect(() => { const s = this.selection(); if (s?.name) { this.selected = true; this.selectedName = s.name; this.text.setValue(s.name, { emitEvent: false }); } });
  }
  show = (c: Customer2 | string | null) => (typeof c === 'string' ? c : c?.name ?? '');
  detail(c: Customer2) { return [c.address?.city, c.taxId && `MF ${c.taxId}`, c.phoneInfo?.display ?? c.phone, c.email].filter(Boolean).join(' · '); }
  hasValue() { return this.selected || !!this.text.value; }
  open() {
    if (this.opened) return;
    this.opened = true;
    if (this.selected) this.box().nativeElement.select(); // client déjà choisi : la liste complète est proposée
    this.lookup.open(this.selected ? '' : String(this.text.value));
    this.trigger().openPanel();
  }
  typed() {
    const q = String(this.text.value); this.opened = true; this.selected = false; this.lookup.type(q);
    clearTimeout(this.pending); if (!this.pickOnly()) this.pending = setTimeout(() => this.changed.emit({ q: q.trim(), customer: null }), 300);
    else this.changed.emit({ q: '', customer: null });
  }
  onOpened() { this.opened = true; setTimeout(() => watchPanelScroll(this.auto().panel?.nativeElement, this.lookup.more)); }
  pick(c: Customer2) { clearTimeout(this.pending); this.opened = false; this.selected = true; this.selectedName = c.name; this.text.setValue(c.name); this.changed.emit({ q: '', customer: c }); }
  /** Entrée sans suggestion active : recherche textuelle immédiate dans la liste. */
  submit(e: Event) {
    if (this.trigger().activeOption) return;
    e.preventDefault(); if (this.pickOnly()) return;
    clearTimeout(this.pending); this.trigger().closePanel(); if (!this.selected) this.changed.emit({ q: String(this.text.value).trim(), customer: null });
  }
  restore() { if (this.pickOnly()) setTimeout(() => { if (!this.selected && typeof this.text.value === 'string' && this.text.value !== '') this.text.setValue('', { emitEvent: false }); }, 200); }
  clear(e: Event) { e.stopPropagation(); clearTimeout(this.pending); this.trigger().closePanel(); this.opened = false; this.selected = false; this.selectedName = ''; this.text.setValue(''); this.changed.emit({ q: '', customer: null }); }
}
