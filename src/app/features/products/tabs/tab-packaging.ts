import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { FieldsPackaging } from '../product-fields';
import { packagingBody } from '../product-form.model';
import { PACKAGING_LABEL, num } from '../product.labels';
import { ProductService } from '../product.service';
import { TabEditBase } from './tab-edit-base';

/** Onglet 2 — Dimensions et Poids : dimensions (mm), poids (kg), type d'emballage et volume total calculé. */
@Component({
  selector: 'app-tab-packaging',
  imports: [MatButtonModule, Icon, FieldsPackaging],
  template: `
    @if (editing()) {
      @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
      <app-fields-packaging [form]="form" [product]="p()" />
      <div class="bar"><button mat-button type="button" (click)="cancel()">Annuler</button><button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
    } @else {
      <div class="top"><div><h2>Dimensions et Poids</h2><p class="muted">Caractéristiques logistiques, reprises par le module Importations</p></div>
        @if (canEdit() && p().kind === 'product') {<button mat-stroked-button type="button" (click)="edit()"><app-icon name="edit" />Modifier</button>}</div>
      @if (p().kind === 'service') {<div class="card"><p class="muted"><app-icon name="info" /> Un service n’a ni dimensions ni poids.</p></div>}
      @else if (!has()) {<div class="card empty"><app-icon name="straighten" /><p>Aucune dimension ni aucun poids renseigné.</p>@if (canEdit()) {<button mat-flat-button color="primary" type="button" (click)="edit()">Renseigner les dimensions et le poids</button>}</div>}
      @else {
        @if (pk()!.review; as r) {<div class="review" role="alert"><app-icon name="warning" /><span><strong>Dimensions à vérifier.</strong> Ancienne saisie pour {{ r.parcelCount }} colis@if (r.previousTotalM3 !== null) { (volume total alors : {{ num(r.previousTotalM3, 9) }} m³)} : confirmez ou corrigez les dimensions de l’article complet.</span></div>}
        <div class="kpis"><div class="kpi main"><span class="muted">Volume total</span><strong>{{ pk()!.volumeM3 === null ? 'Non calculé' : num(pk()!.volumeM3, 9) + ' m³' }}</strong>@if (pk()!.volumeM3 === null) {<span class="muted small">Dimensions incomplètes</span>}</div>
          <div class="kpi"><span class="muted">Poids net</span><strong>{{ pk()!.netWeightKg === null ? '—' : num(pk()!.netWeightKg) + ' kg' }}</strong></div>
          <div class="kpi"><span class="muted">Poids brut</span><strong>{{ pk()!.grossWeightKg === null ? '—' : num(pk()!.grossWeightKg) + ' kg' }}</strong></div></div>
        <section class="card"><dl>
          <dt>Longueur</dt><dd>{{ pk()!.lengthMm === null ? '—' : num(pk()!.lengthMm) + ' mm' }}</dd><dt>Largeur</dt><dd>{{ pk()!.widthMm === null ? '—' : num(pk()!.widthMm) + ' mm' }}</dd><dt>Hauteur</dt><dd>{{ pk()!.heightMm === null ? '—' : num(pk()!.heightMm) + ' mm' }}</dd>
          <dt>Type d’emballage</dt><dd>{{ label() }}</dd></dl></section>
      }
    }`,
  styles: `.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.top p{margin:2px 0 0;font-size:13px}.small{font-size:12px}.review{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 14px;border-radius:var(--r-md);background:var(--accent-50);border:1px solid var(--accent-300)}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px 16px;display:flex;flex-direction:column;gap:4px}.kpi.main{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}.kpi strong{font-size:20px;font-variant-numeric:tabular-nums}
    dl{margin:0;display:grid;grid-template-columns:minmax(160px,40%) 1fr;gap:10px 16px}dt{color:var(--muted)}dd{margin:0}.empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:36px;color:var(--muted);text-align:center}
    .bar{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg)}.err{color:var(--danger);display:flex;gap:8px;align-items:center;margin-bottom:12px;background:var(--danger-50);border-color:var(--danger-200)}`,
})
export class TabPackaging extends TabEditBase {
  private svc = inject(ProductService); private toast = inject(ToastService); num = num;
  pk = () => this.p().packaging;
  has = () => { const k = this.pk(); return !!k && [k.lengthMm, k.widthMm, k.heightMm, k.netWeightKg, k.grossWeightKg, k.type].some((x) => x !== null); };
  label = () => { const k = this.pk(); return k?.type ? (k.type === 'other' && k.typeLabel ? k.typeLabel : PACKAGING_LABEL[k.type] ?? k.type) : '—'; };
  save() {
    const bad = this.invalidMessage(); if (bad) { this.error.set(bad); return; }
    this.saving.set(true); this.error.set('');
    this.svc.savePackaging(this.p().id, packagingBody(this.form, true)).subscribe({
      next: (u) => { this.saving.set(false); this.editing.set(false); this.toast.success('Dimensions et poids enregistrés'); this.saved.emit(u); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
