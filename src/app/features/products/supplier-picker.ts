import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/authentication/auth.service';
import { Icon } from '../../shared/components/icon';
import { SupplierRef } from './product-form.model';

/**
 * Sélecteur de fournisseur avec recherche dynamique CÔTÉ SERVEUR (aucune liste tronquée à 100) : l'utilisateur tape, le serveur filtre.
 * Valeur : { id, name } ou null. Sans permission « fournisseurs : consulter », la valeur courante reste affichée mais ne peut pas être changée.
 */
@Component({
  selector: 'app-supplier-picker',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatButtonModule, Icon],
  template: `
    <mat-form-field appearance="outline" class="w" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <app-icon matPrefix name="store" />
      <input matInput [formControl]="text" [matAutocomplete]="auto" [placeholder]="canSearch ? 'Rechercher un fournisseur…' : ''" [readonly]="!canSearch" (blur)="onBlur()" />
      @if (control().value) {<button matSuffix mat-icon-button type="button" aria-label="Retirer le fournisseur" (click)="clear()"><app-icon name="close" /></button>}
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pick($event.option.value)" [displayWith]="show">
        @for (s of options(); track s.id) {<mat-option [value]="s">{{ s.name }}@if (s.city) { <span class="muted">— {{ s.city }}</span>}</mat-option>}
        @if (searched() && !options().length) {<mat-option disabled>Aucun fournisseur trouvé</mat-option>}
      </mat-autocomplete>
      @if (hint()) {<mat-hint>{{ hint() }}</mat-hint>}
    </mat-form-field>`,
  styles: `.w{width:100%}`,
})
export class SupplierPicker {
  control = input.required<FormControl<SupplierRef | null>>(); label = input('Fournisseur habituel'); hint = input('');
  private http = inject(HttpClient); private destroy = inject(DestroyRef); private auth = inject(AuthService);
  text = new FormControl('', { nonNullable: true }); options = signal<{ id: string; name: string; city?: string }[]>([]); searched = signal(false);
  canSearch = this.auth.has('suppliers:view');
  show = (s: SupplierRef | string | null) => (typeof s === 'string' ? s : s?.name ?? '');
  ngOnInit() {
    const c = this.control(); this.text.setValue(c.value?.name ?? '', { emitEvent: false });
    c.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => { if ((v?.name ?? '') !== this.text.value && !this.text.dirty) this.text.setValue(v?.name ?? '', { emitEvent: false }); });
    this.text.valueChanges.pipe(debounceTime(250), distinctUntilChanged(), switchMap((q) => {
      if (!this.canSearch || typeof q !== 'string' || q.trim().length < 1) return of(null);
      return this.http.get<{ items: { id: string; name: string; address?: { city?: string } }[] }>(`${environment.apiUrl}/suppliers`, { params: { q: q.trim(), limit: 20 } }).pipe(catchError(() => of(null)));
    }), takeUntilDestroyed(this.destroy)).subscribe((r) => { this.searched.set(r !== null); this.options.set((r?.items ?? []).map((s) => ({ id: s.id, name: s.name, city: s.address?.city }))); });
  }
  pick(s: { id: string; name: string }) { this.control().setValue({ id: s.id, name: s.name }); this.control().markAsDirty(); this.text.setValue(s.name, { emitEvent: false }); }
  clear() { this.control().setValue(null); this.control().markAsDirty(); this.text.setValue('', { emitEvent: false }); this.options.set([]); }
  onBlur() { setTimeout(() => this.text.setValue(this.control().value?.name ?? '', { emitEvent: false }), 150); } // texte non validé : retour à la sélection courante
}
