import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { PhoneLink } from '../../../shared/components/phone-link';
import { Customer2 } from '../../../shared/models/api.models';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CustomerFields } from '../customer-fields';
import { buildCustomerForm, customerBody, patchCustomerForm } from '../customer-form.model';
import { METHOD_LABEL, STATUS_CHIP, STATUS_LABEL, TYPE_LABEL } from '../customer.labels';
import { CustomerService } from '../customer.service';

/** Onglet Informations : consultation par sections, ou modification (mêmes champs et mêmes validations que le formulaire de création). */
@Component({
  selector: 'app-tab-info',
  imports: [DatePipe, MatButtonModule, Icon, CustomerFields, MoneyPipe, PhoneLink],
  template: `
    @if (editing()) {
      @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
      <app-customer-fields [form]="form" [code]="c().code" />
      <div class="bar"><span class="spacer"></span><button mat-button type="button" (click)="cancel()">Annuler</button>
        <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
    } @else {
      <div class="top"><h2>Informations générales</h2>@if (canEdit()) {<button mat-stroked-button type="button" (click)="edit()"><app-icon name="edit" />Modifier</button>}
        @else if (c().status === 'archived') {<span class="muted">Client archivé : réactivez-le pour le modifier.</span>}</div>
      <div class="grid">
        <section class="card"><h3>Identification</h3><dl>
          <dt>Type de client</dt><dd>{{ type[c().type] }}</dd><dt>Code client</dt><dd><strong class="code">{{ c().code ?? '—' }}</strong></dd>
          <dt>{{ c().type === 'company' ? 'Raison sociale' : 'Nom' }}</dt><dd>{{ c().name }}</dd><dt>Nom commercial</dt><dd>{{ v(c().tradeName) }}</dd>
          @if (c().type === 'company') {<dt>Matricule fiscal</dt><dd>{{ v(c().taxId) }}</dd>}
          <dt>Statut</dt><dd><span class="chip {{ chip[c().status] }}">{{ status[c().status] }}</span>@if (c().statusReason) { <span class="muted">— {{ c().statusReason }}</span>}</dd>
          <dt>Créé le</dt><dd>{{ c().createdAt | date: 'dd/MM/yyyy' }}</dd></dl></section>
        <section class="card"><h3>Informations fiscales et conditions</h3><dl>
          <dt>Retenue à la source</dt><dd><span class="chip {{ c().subjectToWithholding ? 'ok' : 'off' }}">{{ c().subjectToWithholding ? 'Assujetti' : 'Non assujetti' }}</span></dd>
          <dt>Exonéré du timbre fiscal</dt><dd><span class="chip {{ c().stampExempt ? 'warn' : 'off' }}">{{ c().stampExempt ? 'Oui' : 'Non' }}</span></dd>
          <dt>Conditions de paiement</dt><dd><span class="pre">{{ v(c().paymentTerms) }}</span>@if (c().paymentTermsCustom) { <span class="chip warn">Personnalisées</span><br><span class="muted small">Échéances saisies sur chaque facture.</span>} @else if (c().paymentDelayDays) { <span class="muted">({{ c().paymentDelayDays }} j)</span>}</dd>
          <dt>Mode de paiement habituel</dt><dd>{{ c().paymentMethod ? method[c().paymentMethod!] : '—' }}</dd><dt>Remise habituelle</dt><dd>{{ c().discountPct }} %</dd>
          <dt>Plafond de crédit</dt><dd>{{ c().creditLimitMinor === null ? 'Illimité' : (c().creditLimitMinor | money) }}</dd></dl></section>
        <section class="card"><h3>Coordonnées</h3><dl>
          <dt>Téléphone</dt><dd>@if (c().phone) {<app-phone [info]="c().phoneInfo" [value]="c().phone" />} @else {—}</dd>
          <dt>Téléphone secondaire</dt><dd>@if (c().secondaryPhone) {<app-phone [info]="c().secondaryPhoneInfo" [value]="c().secondaryPhone" />} @else {—}</dd>
          <dt>E-mail</dt><dd>@if (c().email) {<a [href]="'mailto:' + c().email">{{ c().email }}</a>} @else {—}</dd><dt>Adresse</dt><dd>{{ v(addr()) }}</dd>
          <dt>Site Internet</dt><dd>@if (c().website) {<a [href]="c().website" target="_blank" rel="noopener noreferrer">{{ c().website }}</a>} @else {—}</dd></dl></section>
        <section class="card"><h3>Réseaux sociaux et localisation</h3><dl>
          <dt>Facebook</dt><dd>@if (c().social.facebook) {<a [href]="c().social.facebook" target="_blank" rel="noopener noreferrer">{{ c().social.facebook }}</a>} @else {—}</dd>
          <dt>LinkedIn</dt><dd>@if (c().social.linkedin) {<a [href]="c().social.linkedin" target="_blank" rel="noopener noreferrer">{{ c().social.linkedin }}</a>} @else {—}</dd>
          <dt>Instagram</dt><dd>@if (c().social.instagram) {<a [href]="c().social.instagram" target="_blank" rel="noopener noreferrer">{{ c().social.instagram }}</a>} @else {—}</dd>
          <dt>Google Maps</dt><dd>@if (c().mapsUrl) {<a [href]="c().mapsUrl" target="_blank" rel="noopener noreferrer">Ouvrir la localisation</a>} @else {—}</dd></dl></section>
      </div>
      @if (c().notes) {<section class="card" style="margin-top:16px"><h3>Notes internes</h3><p class="notes">{{ c().notes }}</p></section>}
    }`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}h3{margin:0 0 12px;font-size:15px;font-weight:600}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}dl{margin:0;display:grid;grid-template-columns:minmax(120px,40%) 1fr;gap:10px 16px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}
    .code{color:var(--brand)}.pre{white-space:pre-wrap}.small{font-size:12px}.notes{margin:0;white-space:pre-wrap}.bar{display:flex;gap:8px;margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg)}.err{color:var(--danger);display:flex;gap:8px;align-items:center;margin-bottom:12px;background:var(--danger-50);border-color:var(--danger-200)}
    @media (max-width:520px){dl{grid-template-columns:1fr;gap:2px}dd{margin-bottom:8px}}`,
})
export class TabInfo {
  c = input.required<Customer2>(); saved = output<Customer2>();
  private fb = inject(FormBuilder); private svc = inject(CustomerService); private toast = inject(ToastService); private ref = inject(ReferenceDataService); private auth = inject(AuthService);
  form = buildCustomerForm(this.fb); editing = signal(false); saving = signal(false); error = signal('');
  type = TYPE_LABEL; status = STATUS_LABEL; chip = STATUS_CHIP; method = METHOD_LABEL;
  canEdit = computed(() => this.auth.has('customers:update') && this.c().status !== 'archived');
  addr = computed(() => { const a = this.c().address; return [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', '); });
  v = (x: string | null | undefined) => x || '—';
  constructor() { effect(() => { const c = this.c(); if (!this.editing()) patchCustomerForm(this.form, c, this.ref); }); }
  edit() { patchCustomerForm(this.form, this.c(), this.ref); this.error.set(''); this.editing.set(true); }
  cancel() { this.editing.set(false); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Veuillez corriger les champs en erreur.'); return; }
    this.saving.set(true); this.error.set('');
    this.svc.update(this.c().id, customerBody(this.form, this.ref, true)).subscribe({
      next: (u) => { this.saving.set(false); this.editing.set(false); this.toast.success('Informations enregistrées'); this.saved.emit(u); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
