import { Component, DestroyRef, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { Icon } from '../../shared/components/icon';
import { applyPreset, CustomerForm, daysLabel, TERM_PREFIX, termValue } from './customer-form.model';
import { PaymentTermService } from '../payment-terms/payment-term.service';
import { openPaymentTerms } from '../payment-terms/payment-terms-dialog';
import { AuthService } from '../../core/authentication/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PAYMENT_METHODS, TERMS_EXAMPLES } from './customer.labels';

/**
 * Sections du formulaire client (identification, coordonnées, réseaux et localisation, conditions commerciales, fiscalité).
 * Utilisé à l'identique par la page de création / modification et par l'onglet « Informations » de la fiche.
 */
@Component({
  selector: 'app-customer-fields',
  imports: [MatButtonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonToggleModule, Icon],
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
          }
        </div>
      </section>

      <section class="card" formGroupName="address">
        <header><app-icon name="place" /><h3>Adresse de facturation</h3></header>
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
            <mat-hint>Format international ajouté selon le pays</mat-hint>@if (c.phone.invalid) {<mat-error>{{ c.phone.errors?.['duplicate'] ?? 'Numéro invalide' }}</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Téléphone secondaire</mat-label><input matInput type="tel" formControlName="secondaryPhone" />
            @if (c.secondaryPhone.invalid) {<mat-error>{{ c.secondaryPhone.errors?.['duplicate'] ?? 'Numéro invalide' }}</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" placeholder="contact@exemple.tn" />
            @if (c.email.invalid) {<mat-error>{{ c.email.errors?.['duplicate'] ?? 'E-mail invalide' }}</mat-error>}</mat-form-field>
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
            <mat-select formControlName="paymentPreset" (selectionChange)="preset()">@for (o of options(); track o.value) {<mat-option [value]="o.value">{{ o.label }}</mat-option>}<mat-option value="custom">Autre délai (en jours)</mat-option><mat-option value="free">Texte libre personnalisé</mat-option></mat-select>
            @if (canManage()) {<button matSuffix mat-icon-button type="button" aria-label="Gérer les conditions de paiement" title="Gérer les conditions de paiement" (click)="manage($event)"><app-icon name="settings" /></button>}</mat-form-field>
          @if (c.paymentPreset.value === 'custom') {
            <mat-form-field appearance="outline"><mat-label>Délai de paiement (jours)</mat-label><input matInput type="number" min="0" max="365" formControlName="paymentDelayDays" />
              @if (c.paymentDelayDays.invalid) {<mat-error>Entier entre 0 et 365</mat-error>}</mat-form-field>
          }
          @if (c.paymentPreset.value === 'free') {
            <div class="wide free">
              <mat-form-field appearance="outline"><mat-label>Conditions personnalisées</mat-label>
                <textarea matInput rows="2" maxlength="500" formControlName="paymentTermsText" placeholder="Ex. 30 % à la commande et le solde avant la livraison"></textarea>
                <mat-hint>Les échéances réelles se saisissent sur chaque facture.</mat-hint>
                <mat-hint align="end">{{ c.paymentTermsText.value.length }}/500</mat-hint>
                @if (c.paymentTermsText.invalid) {<mat-error>Saisissez les conditions (500 caractères maximum)</mat-error>}</mat-form-field>
              <div class="examples" role="group" aria-label="Exemples de conditions"><span class="muted">Exemples :</span>
                @for (e of examples; track e) {<button type="button" class="ex" (click)="useExample(e)">{{ e }}</button>}</div>
            </div>
          }
          <mat-form-field appearance="outline"><mat-label>Remise habituelle (%)</mat-label><input matInput type="number" min="0" max="100" step="0.1" formControlName="discountPct" />
            @if (c.discountPct.invalid) {<mat-error>Entre 0 et 100 %, un chiffre après la virgule</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Mode de paiement habituel</mat-label>
            <mat-select formControlName="paymentMethod"><mat-option value="">Non précisé</mat-option>@for (m of methods; track m.value) {<mat-option [value]="m.value">{{ m.label }}</mat-option>}</mat-select></mat-form-field>
        </div>
        <fieldset class="flags"><legend>Paramètres fiscaux</legend>
          <mat-slide-toggle formControlName="subjectToWithholding">Assujetti à la retenue à la source : <strong>{{ c.subjectToWithholding.value ? 'Oui' : 'Non' }}</strong></mat-slide-toggle>
          <mat-slide-toggle formControlName="stampExempt">Exonéré du timbre fiscal : <strong>{{ c.stampExempt.value ? 'Oui' : 'Non' }}</strong></mat-slide-toggle>
        </fieldset>
        <p class="muted small">Les paramètres fiscaux ne s’appliquent que si une règle validée existe dans Fiscalité (aucun taux n’est présumé).</p>
        <mat-form-field appearance="outline" class="notes"><mat-label>Notes internes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
      </section>
    </form>`,
  styles: `.sections{display:flex;flex-direction:column;gap:16px}header{display:flex;align-items:center;gap:10px;margin-bottom:14px;color:var(--brand)}h3{margin:0;font-size:16px;font-weight:600;color:var(--text)}
    .kind{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}.code{font-weight:600;color:var(--brand);background:var(--brand-50);padding:4px 12px;border-radius:999px}
    mat-button-toggle app-icon{margin-right:6px;vertical-align:middle}.wide{grid-column:1/-1}.flags{display:flex;gap:12px 28px;flex-wrap:wrap;margin:10px 0 6px;padding:10px 14px 14px;border:1px solid var(--border);border-radius:var(--r-md)}.flags legend{font-size:12px;font-weight:600;color:var(--muted);padding:0 6px}
    .free{margin-top:4px}.free mat-form-field{width:100%}.examples{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0 14px;font-size:12px}
    .ex{font:inherit;color:var(--brand);background:var(--brand-50);border:1px solid var(--brand-100);border-radius:999px;padding:3px 10px;cursor:pointer;text-align:left}.ex:hover{border-color:var(--brand)}.small{font-size:12px;margin:4px 0 12px}.notes{width:100%}`,
})
export class CustomerFields {
  form = input.required<CustomerForm>();
  code = input<string | null>(null);
  /** Nouveau client : seul cas où la condition par défaut de la société est préselectionnée. */
  creating = input(false);
  ref = inject(ReferenceDataService);
  methods = PAYMENT_METHODS; examples = TERMS_EXAMPLES;
  private terms = inject(PaymentTermService); private auth = inject(AuthService); private dialog = inject(MatDialog); private destroy = inject(DestroyRef);
  /** Conditions actives, plus la valeur déjà portée par la fiche si elle n'est plus proposée. */
  options() {
    const out = this.terms.terms().filter((t) => t.isActive).map((t) => ({ value: termValue(t), label: t.label }));
    const cur = this.c.paymentPreset.value;
    if (cur && cur !== 'custom' && cur !== 'free' && !out.some((o) => o.value === cur)) out.push({ value: cur, label: cur.startsWith(TERM_PREFIX) ? cur.slice(TERM_PREFIX.length) : daysLabel(Number(cur)) });
    return out.length ? out : [0, 30, 60].map((d) => ({ value: String(d), label: daysLabel(d) }));
  }
  canManage = () => this.auth.has('customers:create') || this.auth.has('customers:update');
  manage(e: Event) { e.stopPropagation(); openPaymentTerms(this.dialog).pipe(takeUntilDestroyed(this.destroy)).subscribe(); }
  private chosen() { const v = this.c.paymentPreset.value; return this.terms.terms().find((t) => termValue(t) === v); }
  ngOnInit() {
    this.terms.refresh().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => this.defaultTerm(), error: () => undefined });
  }
  /** Nouveau client : la condition par défaut de la société est préselectionnée tant que rien n'a été choisi. */
  private defaultTerm() {
    const preset = this.terms.terms().find((t) => t.isDefault && t.isActive);
    if (!this.creating() || !preset || this.c.paymentPreset.dirty || this.c.paymentTermsText.value) return;
    this.c.paymentPreset.setValue(termValue(preset)); this.preset();
  }
  get c() { return this.form().controls; }
  isCompany = () => this.form().controls.type.value === 'company';
  step = () => 1 / 10 ** this.ref.decimals();
  setType(t: 'company' | 'walk_in') { this.form().controls.type.setValue(t); }
  preset() { applyPreset(this.form(), this.chosen()); }
  useExample(text: string) { this.c.paymentTermsText.setValue(text); this.c.paymentTermsText.markAsDirty(); }
}
