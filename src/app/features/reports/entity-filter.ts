import { Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Api } from '../../core/services/api.service';
import { Icon } from '../../shared/components/icon';

export interface EntityOption { id: string; label: string }
export type EntityKind = 'customer' | 'supplier' | 'product';
const SOURCES: Record<EntityKind, { path: string; label: (r: { name?: string; reference?: string }) => string }> = {
  customer: { path: '/customers', label: (r) => r.name ?? '' }, supplier: { path: '/suppliers', label: (r) => r.name ?? '' }, product: { path: '/products', label: (r) => `${r.reference ?? ''} — ${r.name ?? ''}` },
};

/** Filtre par entité (client, fournisseur, article) : recherche côté serveur avec saisie semi-automatique ; la valeur est un identifiant. */
@Component({
  selector: 'app-entity-filter',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatButtonModule, Icon],
  template: `<mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label><input matInput [formControl]="ctl" [matAutocomplete]="auto" [placeholder]="'Rechercher…'" />
      @if (ctl.value) {<button mat-icon-button matSuffix type="button" (click)="clear()" aria-label="Effacer le filtre"><app-icon name="close" /></button>}
      <mat-autocomplete #auto="matAutocomplete" [displayWith]="show" (optionSelected)="pick($event.option.value)">@for (o of options(); track o.id) {<mat-option [value]="o">{{ o.label }}</mat-option>}</mat-autocomplete>
    </mat-form-field>`,
})
export class EntityFilter {
  kind = input.required<EntityKind>(); label = input.required<string>(); value = input<string>(''); changed = output<string>();
  private api = inject(Api); ctl = new FormControl<string | EntityOption>('', { nonNullable: true }); options = signal<EntityOption[]>([]);
  show = (o: EntityOption | string | null) => (typeof o === 'string' ? o : o?.label ?? '');
  ngOnInit() {
    const id = this.value();
    if (id) this.api.get(`${SOURCES[this.kind()].path}/${id}`).subscribe({ next: (r) => this.ctl.setValue({ id, label: SOURCES[this.kind()].label(r) }, { emitEvent: false }), error: () => undefined });
    this.ctl.valueChanges.pipe(debounceTime(250), distinctUntilChanged(), switchMap((v) => (typeof v === 'string' && v.length >= 1 ? this.api.get(SOURCES[this.kind()].path, { q: v, limit: 8 }) : of(null)))).subscribe({ next: (r) => this.options.set(r ? r.items.map((x: { id: string }) => ({ id: x.id, label: SOURCES[this.kind()].label(x as never) })) : []), error: () => this.options.set([]) });
  }
  pick(o: EntityOption) { this.changed.emit(o.id); }
  clear() { this.ctl.setValue('', { emitEvent: false }); this.options.set([]); this.changed.emit(''); }
}
