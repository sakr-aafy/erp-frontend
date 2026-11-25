import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { Icon } from '../../shared/components/icon';
import { applyPreset, CustomerForm } from './customer-form.model';
import { PAYMENT_METHODS, TERMS } from './customer.labels';

/**
 * Sections du formulaire client (identification, coordonnées, réseaux et localisation, conditions commerciales, fiscalité).
 * Utilisé à l'identique par la page de création / modification et par l'onglet « Informations » de la fiche.
 */
@Component({
  selector: 'app-customer-fields',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonToggleModule, Icon],
  template: `
    <form [formGroup]="form()" class="sections" (submit)="$event.preventDefault()">
      <section class="card">
        <header><app-icon name="badge" /><h3>Identification</h3></header>
        <div class="kind" role="group" aria-label="Type de client">
          <mat-button-toggle-group [value]="form().controls.type.value" (change)="setType($event.value)" hideSingleSelectionIndicator aria-label="Type de client">
            <mat-button-toggle value="company"><app-icon name="domain" />Société</mat-button-toggle>
            <mat-button-toggle value="walk_in"><app-icon name="person" />Passager</mat-button-toggle>
          </mat-button-toggle-group>
          @if (code()) {<span class="code">{{ code() }}</span>} @else {<span class="muted">Le code client (CL-00001…) est généré automatiquement à l’enregistrement.</span>}
        </div>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>{{ isCompany() ? 'Raison sociale' : 'Nom du client' }}</mat-label><input matInput formControlName="name" required />
            @if (c.name.invalid && c.name.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Nom commercial</mat-label><input matInput formControlName="tradeName" /></mat-form-field>
          @if (isCompany()) {
            <mat-form-field appearance="outline"><mat-label>Matricule fiscal</mat-label><input matInput formControlName="taxId" placeholder="Identifiant fiscal" /><mat-hint>Unique par société</mat-hint></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Registre de commerce (RC)</mat-label><input matInput formControlName="registryNumber" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Secteur d’activité</mat-label><input matInput formControlName="sector" placeholder="Industrie, commerce, agriculture…" /></mat-form-field>
          }
        </div>
      </section>

      <section class="card" formGroupName="address">
        <header><app-icon name="place" /><h3>Coordonnées</h3></header>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="wide"><mat-label>Adresse complète</mat-label><input matInput formControlName="street" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="city" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="postalCode" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Pays</mat-label><input matInput formControlName="country" /></mat-form-field>
        </div>
      </section>
      <section class="card">
        <header><app-icon name="phone" /><h3>Contact</h3></header>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Téléphone principal</mat-label><input matInput type="tel" formControlName="phone" placeholder="+216 71 000 000" />
            @if (c.phone.invalid) {<mat-error>Numéro invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Téléphone secondaire</mat-label><input matInput type="tel" formControlName="secondaryPhone" />
            @if (c.secondaryPhone.invalid) {<mat-error>Numéro invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" placeholder="contact@exemple.tn" />
            @if (c.email.invalid) {<mat-error>E-mail invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Site Internet</mat-label><input matInput formControlName="website" placeholder="https://" />
            @if (c.website.invalid) {<mat-error>URL invalide (http:// ou https://)</mat-error>}</mat-form-field>
        </div>
      </section>
      <section class="card">
        <header><app-icon name="public" /><h3>Réseaux sociaux et localisation</h3></header>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Facebook</mat-label><input matInput formControlName="facebook" placeholder="https://facebook.com/…" />@if (c.facebook.invalid) {<mat-error>URL invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>LinkedIn</mat-label><input matInput formControlName="linkedin" placeholder="https://linkedin.com/…" />@if (c.linkedin.invalid) {<mat-error>URL invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Instagram</mat-label><input matInput formControlName="instagram" placeholder="https://instagram.com/…" />@if (c.instagram.invalid) {<mat-error>URL invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Localisation (lien Google Maps)</mat-label><input matInput formControlName="mapsUrl" placeholder="https://maps.google.com/…" />@if (c.mapsUrl.invalid) {<mat-error>URL invalide</mat-error>}</mat-form-field>
        </div>
      </section>

      <section class="card">
        <header><app-icon name="payments" /><h3>Conditions commerciales et financières</h3></header>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Plafond de crédit ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="creditLimit" />
            <mat-hint>Vide = illimité</mat-hint>@if (c.creditLimit.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Conditions de paiement</mat-label>
            <mat-select formControlName="paymentPreset" (selectionChange)="preset()">@for (t of terms; track t.days) {<mat-option [value]="'' + t.days">{{ t.label }}</mat-option>}<mat-option value="custom">Personnalisé…</mat-option></mat-select></mat-form-field>
          @if (c.paymentPreset.value === 'custom') {
            <mat-form-field appearance="outline"><mat-label>Délai de paiement (jours)</mat-label><input matInput type="number" min="0" max="365" formControlName="paymentDelayDays" />
              @if (c.paymentDelayDays.invalid) {<mat-error>Entier entre 0 et 365</mat-error>}</mat-form-field>
          }
          <mat-form-field appearance="outline"><mat-label>Remise habituelle (%)</mat-label><input matInput type="number" min="0" max="100" step="0.01" formControlName="discountPct" />
            @if (c.discountPct.invalid) {<mat-error>Entre 0 et 100 %</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Mode de paiement habituel</mat-label>
            <mat-select formControlName="paymentMethod"><mat-option value="">Non précisé</mat-option>@for (m of methods; track m.value) {<mat-option [value]="m.value">{{ m.label }}</mat-option>}</mat-select></mat-form-field>
        </div>
        <div class="flags">
          <mat-slide-toggle formControlName="subjectToWithholding">Assujetti à la retenue à la source</mat-slide-toggle>
          <mat-slide-toggle formControlName="stampExempt">Exonéré du timbre fiscal</mat-slide-toggle>
        </div>
        <p class="muted small">Les paramètres fiscaux ne s’appliquent que si une règle validée existe dans Fiscalité (aucun taux n’est présumé).</p>
        <mat-form-field appearance="outline" class="notes"><mat-label>Notes internes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
      </section>
    </form>`,
  styles: `.sections{display:flex;flex-direction:column;gap:16px}header{display:flex;align-items:center;gap:10px;margin-bottom:14px;color:var(--brand)}h3{margin:0;font-size:16px;font-weight:600;color:var(--text)}
    .kind{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}.code{font-weight:600;color:var(--brand);background:var(--brand-50);padding:4px 12px;border-radius:999px}
    mat-button-toggle app-icon{margin-right:6px;vertical-align:middle}.wide{grid-column:1/-1}.flags{display:flex;gap:28px;flex-wrap:wrap;margin:6px 0}.small{font-size:12px;margin:4px 0 12px}.notes{width:100%}`,
})
export class CustomerFields {
  form = input.required<CustomerForm>();
  code = input<string | null>(null);
  ref = inject(ReferenceDataService);
  terms = TERMS; methods = PAYMENT_METHODS;
  get c() { return this.form().controls; }
  isCompany = () => this.form().controls.type.value === 'company';
  step = () => 1 / 10 ** this.ref.decimals();
  setType(t: 'company' | 'walk_in') { this.form().controls.type.setValue(t); }
  preset() { applyPreset(this.form()); }
}
