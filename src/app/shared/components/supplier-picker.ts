import { Component, DestroyRef, ElementRef, inject, input, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/authentication/auth.service';
import { SupplierOption } from '../models/api.models';
import { Icon } from './icon';
import { pagedLookup, watchPanelScroll } from './paged-lookup';

export interface SupplierRef { id: string; name: string; code?: string | null; archived?: boolean }
const PAGE = 20;

/**
 * Sélecteur de fournisseur : la liste s'ouvre au clic (champ vide compris), recherche côté serveur par code, raison sociale,
 * nom commercial ou matricule fiscal, pages suivantes au défilement (aucune limite aux premiers fournisseurs).
 * `includeArchived` : pour un FILTRE (anciennes associations consultables) ; sinon seuls les fournisseurs actifs sont proposés.
 * Sans permission « fournisseurs : consulter », la valeur courante reste affichée mais ne peut pas être changée.
 */
@Component({
  selector: 'app-supplier-picker',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, Icon],
  template: `
    <mat-form-field appearance="outline" class="w" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <app-icon matPrefix name="store" />
      <input #box matInput [formControl]="text" [matAutocomplete]="auto" [placeholder]="canSearch ? 'Choisir ou rechercher…' : ''" [readonly]="!canSearch" autocomplete="off"
        (focus)="open()" (click)="open()" (input)="typed()" (blur)="onBlur()" />
      @if (lookup.loading()) {<mat-spinner matSuffix diameter="18" class="spin" aria-label="Chargement" />}
      @if (control().value && canSearch) {<button matSuffix mat-icon-button type="button" aria-label="Retirer le fournisseur" (click)="clear($event)"><app-icon name="close" /></button>}
      <mat-autocomplete #auto="matAutocomplete" class="lookup-panel" panelWidth="min(380px, calc(100vw - 76px))" (optionSelected)="pick($event.option.value)" [displayWith]="show" (opened)="onOpened()" (closed)="onClosed()">
        @for (s of lookup.items(); track s.id) {
          <mat-option [value]="s"><span class="opt"><span class="code">{{ s.code ?? '—' }}</span><span class="txt"><span class="name">{{ s.name }}</span>@if (s.tradeName) {<span class="sub">{{ s.tradeName }}</span>}</span>@if (s.isArchived) {<span class="chip off">Archivé</span>}</span></mat-option>}
        @if (lookup.loading()) {<mat-option disabled class="state">Chargement…</mat-option>}
        @if (lookup.error()) {<mat-option disabled class="state">Impossible de charger les fournisseurs. Fermez la liste et réessayez.</mat-option>}
        @if (lookup.empty()) {<mat-option disabled class="state">Aucun fournisseur trouvé</mat-option>}
        @if (lookup.items().length && lookup.items().length < lookup.total()) {<mat-option disabled class="state">{{ lookup.items().length }} sur {{ lookup.total() }} — faites défiler pour la suite</mat-option>}
      </mat-autocomplete>
      @if (hint()) {<mat-hint>{{ hint() }}</mat-hint>}
      @else if (control().value?.archived) {<mat-hint>Fournisseur archivé : conservé tant que vous ne le changez pas</mat-hint>}
    </mat-form-field>`,
  styles: `.w{width:100%}.spin{margin-right:6px}`,
})
export class SupplierPicker {
  control = input.required<FormControl<SupplierRef | null>>(); label = input('Fournisseur habituel'); hint = input(''); includeArchived = input(false);
  private http = inject(HttpClient); private destroy = inject(DestroyRef); private auth = inject(AuthService);
  private trigger = viewChild.required(MatAutocompleteTrigger); private box = viewChild.required<ElementRef<HTMLInputElement>>('box'); private auto = viewChild.required<MatAutocomplete>('auto');
  text = new FormControl<string | SupplierOption>('', { nonNullable: true });
  canSearch = this.auth.has('suppliers:view');
  lookup = pagedLookup<SupplierOption>((q, page) => {
    let p = new HttpParams().set('page', page).set('limit', PAGE).set('status', this.includeArchived() ? 'all' : 'active').set('sort', 'name'); if (q) p = p.set('q', q);
    return this.http.get<{ items: SupplierOption[]; total: number }>(`${environment.apiUrl}/suppliers`, { params: p });
  }, this.destroy);
  private opened = false;
  show = (s: SupplierOption | string | null) => (typeof s === 'string' ? s : s?.name ?? '');
  ngOnInit() {
    const c = this.control(); this.text.setValue(c.value?.name ?? '', { emitEvent: false });
    c.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => { if (!this.opened) this.text.setValue(v?.name ?? '', { emitEvent: false }); });
  }
  /** Au clic : la liste complète (première page), même si un fournisseur est déjà choisi. */
  open() {
    if (!this.canSearch || this.opened) return;
    this.opened = true; this.lookup.open(''); this.box().nativeElement.select();
    this.trigger().openPanel();
  }
  typed() { const v = this.text.value; if (this.canSearch && typeof v === 'string') { this.opened = true; this.lookup.type(v); } }
  onOpened() { this.opened = true; setTimeout(() => watchPanelScroll(this.auto().panel?.nativeElement, this.lookup.more)); }
  onClosed() { this.opened = false; this.restore(); }
  pick(s: SupplierOption) { this.opened = false; this.control().setValue({ id: s.id, name: s.name, code: s.code, archived: s.isArchived }); this.control().markAsDirty(); this.text.setValue(s.name, { emitEvent: false }); }
  clear(e: Event) { e.stopPropagation(); this.opened = false; this.trigger().closePanel(); this.control().setValue(null); this.control().markAsDirty(); this.text.setValue('', { emitEvent: false }); }
  /** Texte non validé : retour à la sélection courante. */
  onBlur() { setTimeout(() => { if (!this.trigger().panelOpen) { this.opened = false; this.restore(); } }, 150); }
  private restore() { this.text.setValue(this.control().value?.name ?? '', { emitEvent: false }); }
}
