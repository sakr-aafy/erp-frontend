import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { FieldsGeneral } from '../product-fields';
import { generalBody } from '../product-form.model';
import { STATUS_CHIP, STATUS_HELP } from '../product.labels';
import { ProductService } from '../product.service';
import { TabEditBase } from './tab-edit-base';

/** Onglet 1 — Général : identification, catégorie, marque, modèle, unité, description, statut. */
@Component({
  selector: 'app-tab-general',
  imports: [DatePipe, MatButtonModule, Icon, FieldsGeneral],
  template: `
    @if (editing()) {
      @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
      <app-fields-general [form]="form" />
      <div class="bar"><button mat-button type="button" (click)="cancel()">Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
    } @else {
      <div class="top"><div><h2>Général</h2><p class="muted">Identification et caractéristiques de l’article</p></div>
        @if (canEdit()) {<button mat-stroked-button type="button" (click)="edit()"><app-icon name="edit" />Modifier</button>} @else if (p().status === 'archived') {<span class="muted">Article archivé : réactivez-le pour le modifier.</span>}</div>
      <div class="grid">
        <section class="card"><h3>Identification</h3><dl>
          <dt>Code article</dt><dd><strong class="code">{{ p().reference }}</strong></dd><dt>Désignation (nom de l’article)</dt><dd>{{ p().name }}</dd>
          <dt>Catégorie</dt><dd>{{ p().familyName ?? '—' }}</dd><dt>Sous-catégorie</dt><dd>{{ p().subName ?? '—' }}</dd><dt>Marque</dt><dd>{{ p().brand ?? '—' }}</dd><dt>Modèle</dt><dd>{{ p().model ?? '—' }}</dd>
          <dt>Unité de vente</dt><dd>{{ p().unitName ?? p().unitCode }}</dd><dt>Type</dt><dd>{{ p().kind === 'service' ? 'Service' : 'Produit' }}</dd><dt>Suivi par numéro de série</dt><dd>{{ p().hasSerial ? 'Oui' : 'Non' }}</dd></dl></section>
        <section class="card"><h3>Statut</h3>
          <p><span class="chip {{ chip[p().status] }}">{{ p().statusLabel }}</span>@if (p().statusReason) { <span class="muted">— {{ p().statusReason }}</span>}</p>
          <p class="help">{{ help[p().status] }}</p>
          @if (p().statusChangedAt) {<p class="muted small">Dernier changement : {{ p().statusChangedAt | date: 'dd/MM/yyyy HH:mm' }}</p>}
          <p class="muted small">Créé le {{ p().createdAt | date: 'dd/MM/yyyy' }}. Les opérations passées (documents, mouvements, historique) restent toujours consultables.</p></section>
      </div>
      <section class="card" style="margin-top:16px"><h3>Description</h3><p class="desc">{{ p().description || 'Aucune description.' }}</p></section>
    }`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}h3{margin:0 0 12px;font-size:15px;font-weight:600}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}dl{margin:0;display:grid;grid-template-columns:minmax(120px,42%) 1fr;gap:10px 16px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}.code{color:var(--brand)}
    .help{margin:8px 0;color:var(--text-2)}.small{font-size:12px;margin:4px 0}.desc{margin:0;white-space:pre-wrap}.bar{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg)}
    .err{color:var(--danger);display:flex;gap:8px;align-items:center;margin-bottom:12px;background:var(--danger-50);border-color:var(--danger-200)}@media (max-width:520px){dl{grid-template-columns:1fr;gap:2px}dd{margin-bottom:8px}}`,
})
export class TabGeneral extends TabEditBase {
  private svc = inject(ProductService); private toast = inject(ToastService); chip = STATUS_CHIP; help = STATUS_HELP;
  save() {
    const bad = this.invalidMessage(); if (bad) { this.error.set(bad); return; }
    this.saving.set(true); this.error.set('');
    this.svc.update(this.p().id, generalBody(this.form, true)).subscribe({
      next: (u) => { this.saving.set(false); this.editing.set(false); this.toast.success('Informations enregistrées'); this.saved.emit(u); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
