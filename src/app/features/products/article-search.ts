import { Component, DestroyRef, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Icon } from '../../shared/components/icon';
import { pagedLookup, watchPanelScroll } from '../../shared/components/paged-lookup';
import { ProductSuggestion } from '../../shared/models/api.models';
import { ProductThumb } from './product-thumb';
import { ProductQuery, ProductService } from './product.service';

export interface ArticleSearchValue { q: string; product: ProductSuggestion | null }

/**
 * Recherche d'un article : les suggestions s'affichent au clic (sans saisie), se filtrent par code, désignation, catégorie
 * ou sous-catégorie (côté serveur, avec les filtres de la liste). Choisir un article filtre le tableau sur lui ;
 * sans sélection, le texte saisi reste une recherche ordinaire du tableau.
 */
@Component({
  selector: 'app-article-search',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, Icon, ProductThumb],
  template: `
    <mat-form-field appearance="outline" class="w" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <app-icon matPrefix name="search" />
      <input #box matInput [formControl]="text" [matAutocomplete]="auto" [placeholder]="placeholder()" autocomplete="off"
        (focus)="open()" (click)="open()" (input)="typed()" (keydown.enter)="submit($event)" />
      @if (lookup.loading()) {<mat-spinner matSuffix diameter="18" class="spin" aria-label="Chargement" />}
      @if (hasValue()) {<button matSuffix mat-icon-button type="button" aria-label="Effacer la recherche" (click)="clear($event)"><app-icon name="close" /></button>}
      <mat-autocomplete #auto="matAutocomplete" class="lookup-panel" panelWidth="min(460px, calc(100vw - 76px))" (optionSelected)="pick($event.option.value)" [displayWith]="show" (opened)="onOpened()" (closed)="opened = false">
        @for (p of lookup.items(); track p.id) {
          <mat-option [value]="p"><span class="opt">
            <app-product-thumb [productId]="p.id" [photoId]="p.mainPhotoId" [kind]="p.kind" [alt]="p.name" [size]="36" />
            <span class="txt"><span class="name"><span class="code">{{ p.reference }}</span> {{ p.name }}</span>
              <span class="sub">{{ p.familyName ?? 'Sans catégorie' }}@if (p.subName) { › {{ p.subName }}}</span></span></span></mat-option>}
        @if (lookup.loading()) {<mat-option disabled class="state">Chargement…</mat-option>}
        @if (lookup.error()) {<mat-option disabled class="state">Impossible de charger les articles. Fermez la liste et réessayez.</mat-option>}
        @if (lookup.empty()) {<mat-option disabled class="state">Aucun article trouvé</mat-option>}
        @if (lookup.items().length && lookup.items().length < lookup.total()) {<mat-option disabled class="state">{{ lookup.items().length }} sur {{ lookup.total() }} — faites défiler pour la suite</mat-option>}
      </mat-autocomplete>
    </mat-form-field>`,
  styles: `:host{display:block}.w{width:100%}.spin{margin-right:6px}`,
})
export class ArticleSearch {
  /** Filtres courants de la liste, appliqués aux suggestions. */
  filters = input<Partial<ProductQuery>>({});
  label = input('Rechercher un article'); placeholder = input('Code, désignation, catégorie…');
  /** Sélecteur d'ajout (lignes d'un document) : le champ se vide après chaque choix et le texte libre n'est pas signalé. */
  resetOnPick = input(false);
  changed = output<ArticleSearchValue>();
  private svc = inject(ProductService); private destroy = inject(DestroyRef);
  private trigger = viewChild.required(MatAutocompleteTrigger); private box = viewChild.required<ElementRef<HTMLInputElement>>('box'); private auto = viewChild.required<MatAutocomplete>('auto');
  text = new FormControl<string | ProductSuggestion>('', { nonNullable: true });
  selected: ProductSuggestion | null = null; opened = false;
  lookup = pagedLookup<ProductSuggestion>((q, page) => this.svc.suggest({ ...this.filters(), q, page, limit: 15 }), this.destroy);
  private pending: ReturnType<typeof setTimeout> | undefined;
  show = (p: ProductSuggestion | string | null) => (typeof p === 'string' ? p : p?.name ?? '');
  hasValue() { return !!this.selected || !!this.text.value; }
  open() {
    if (this.opened) return;
    this.opened = true;
    // Article déjà choisi : la liste complète est proposée ; sinon le texte saisi filtre les suggestions
    if (this.selected) this.box().nativeElement.select();
    this.lookup.open(this.selected ? '' : String(this.text.value));
    this.trigger().openPanel();
  }
  typed() {
    const q = String(this.text.value); this.opened = true; this.selected = null; this.lookup.type(q);
    clearTimeout(this.pending); if (!this.resetOnPick()) this.pending = setTimeout(() => this.changed.emit({ q: q.trim(), product: null }), 300);
  }
  onOpened() { this.opened = true; setTimeout(() => watchPanelScroll(this.auto().panel?.nativeElement, this.lookup.more)); }
  pick(p: ProductSuggestion) {
    clearTimeout(this.pending); this.opened = false; this.selected = this.resetOnPick() ? null : p; this.text.setValue(this.resetOnPick() ? '' : p.name); this.changed.emit({ q: '', product: p });
  }
  /** Entrée sans suggestion active : recherche textuelle immédiate. */
  submit(e: Event) {
    if (this.trigger().activeOption) return;
    e.preventDefault(); clearTimeout(this.pending); this.trigger().closePanel();
    if (!this.selected) this.changed.emit({ q: String(this.text.value).trim(), product: null });
  }
  clear(e: Event) { e.stopPropagation(); clearTimeout(this.pending); this.trigger().closePanel(); this.opened = false; this.selected = null; this.text.setValue(''); this.changed.emit({ q: '', product: null }); }
}
