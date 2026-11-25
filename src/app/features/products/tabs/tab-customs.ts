import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { FieldsCustoms } from '../product-fields';
import { customsBody } from '../product-form.model';
import { ProductService } from '../product.service';
import { TabEditBase } from './tab-edit-base';

/** Onglet 5 — Douane : NGP, DD, FODEC, RPD, pays, règlement. La TVA est celle du code de l'article (source unique, modifiable dans l'onglet Prix). */
@Component({
  selector: 'app-tab-customs',
  imports: [RouterLink, MatButtonModule, Icon, FieldsCustoms],
  template: `
    @if (editing()) {
      @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
      <app-fields-customs [form]="form" />
      <div class="bar"><button mat-button type="button" (click)="cancel()">Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
    } @else {
      <div class="top"><div><h2>Douane</h2><p class="muted">Informations nécessaires à l’importation</p></div>@if (canEdit()) {<button mat-stroked-button type="button" (click)="edit()"><app-icon name="edit" />Modifier</button>}</div>
      @if (c(); as c) {
        <div class="grid">
          <section class="card"><h3>Identification douanière</h3><dl><dt>Code NGP du fournisseur</dt><dd>{{ c.supplierHsCode ?? '—' }}</dd><dt>Code NGP tunisien</dt><dd>{{ c.tnHsCode ?? '—' }}</dd></dl></section>
          <section class="card"><h3>Taxes et droits</h3><dl><dt>DD — Droits de douane</dt><dd>{{ pct(c.ddPct) }}</dd><dt>FODEC</dt><dd>{{ pct(c.fodecPct) }}</dd><dt>RPD</dt><dd>{{ pct(c.rpdPct) }}</dd>
            <dt>TVA</dt><dd>{{ p().vatRateCode }}@if (p().vatRatePct !== null) { — {{ p().vatRatePct }} %} <span class="muted small">(identique à l’onglet Prix ; <a routerLink="." [queryParams]="{ tab: 'prices' }">modifier</a>)</span></dd></dl></section>
          <section class="card"><h3>Origine et réglementation</h3><dl><dt>Pays d’origine</dt><dd>{{ c.originCountry ?? '—' }}</dd><dt>Pays de provenance</dt><dd>{{ c.provenanceCountry ?? '—' }}</dd><dt>Règlement particulier</dt><dd>{{ c.specialRegulation ?? '—' }}</dd></dl></section>
        </div>
        <div class="hint"><app-icon name="info" />Ces valeurs sont copiées dans chaque dossier d’importation à l’ajout de l’article (instantané daté) ; un dossier existant ou clôturé n’est jamais modifié. Aucun taux ni code NGP n’est présumé : faites valider les valeurs par votre transitaire ou comptable.</div>
      } @else {<div class="card"><p class="muted"><app-icon name="lock" /> Les données douanières sont réservées aux utilisateurs autorisés.</p></div>}
    }`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}h3{margin:0 0 12px;font-size:15px;font-weight:600}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
    dl{margin:0;display:grid;grid-template-columns:minmax(120px,45%) 1fr;gap:10px 16px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}.small{font-size:12px}.hint{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:var(--r-md);background:var(--brand-50);color:var(--text-2);font-size:13px;margin-top:16px}.hint app-icon{color:var(--brand);margin-top:1px;flex:none}
    .bar{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg)}.err{color:var(--danger);display:flex;gap:8px;align-items:center;margin-bottom:12px;background:var(--danger-50);border-color:var(--danger-200)}`,
})
export class TabCustoms extends TabEditBase {
  private svc = inject(ProductService); private toast = inject(ToastService);
  c = () => this.p().customs; pct = (v: number | null) => (v === null ? '—' : `${v} %`);
  save() {
    const bad = this.invalidMessage(); if (bad) { this.error.set(bad); return; }
    this.saving.set(true); this.error.set('');
    this.svc.saveCustoms(this.p().id, customsBody(this.form, true)).subscribe({
      next: (u) => { this.saving.set(false); this.editing.set(false); this.toast.success('Données douanières enregistrées'); this.saved.emit(u); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
