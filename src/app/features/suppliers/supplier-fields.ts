import { Component, computed, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/authentication/auth.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { Icon } from '../../shared/components/icon';
import { SupplierCategoryDto } from '../../shared/models/api.models';
import { PAYMENT_METHODS, TERMS, TERMS_EXAMPLES } from '../customers/customer.labels';
import { openSupplierCategories } from './category-manager';
import { applySupplierPreset, SupplierForm } from './supplier-form.model';
import { SupplierService } from './supplier.service';

/**
 * Sections du formulaire fournisseur, à l'identique du formulaire client (identification, adresse, contact, réseaux,
 * conditions). Utilisé par la page de création / modification et par l'onglet « Informations » de la fiche.
 */
@Component({
  selector: 'app-supplier-fields',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatTooltipModule, Icon],
  template: `
    <form [formGroup]="form()" class="sections" (submit)="$event.preventDefault()">
      <section class="card">
        <header><app-icon name="badge" /><h3>Identification</h3></header>
        <div class="kind">@if (code()) {<span class="code">{{ code() }}</span>} @else {<span class="muted">Le code fournisseur (FR-00001…) est généré automatiquement à l’enregistrement.</span>}</div>
        <div class="form-grid">
          <mat-form-field appearance="outline">@if (canManage) {<button matPrefix mat-icon-button class="gear" type="button" (click)="$event.stopPropagation(); manage()" aria-label="Gérer les catégories de fournisseurs" matTooltip="Gérer les catégories"><app-icon name="settings" /></button>}
            <mat-label>Catégorie de fournisseur</mat-label>
            <mat-select formControlName="categoryId"><mat-option value="">Non classé</mat-option>@for (k of options(); track k.id) {<mat-option [value]="k.id">{{ k.name }}@if (!k.isActive) { (désactivée)}</mat-option>}</mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Raison sociale</mat-label><input matInput formControlName="name" required />
            @if (c.name.invalid && c.name.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Nom commercial</mat-label><input matInput formControlName="tradeName" maxlength="150" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Matricule fiscal</mat-label><input matInput formControlName="taxId" /><mat-hint>{{ c.isForeign.value ? 'Identifiant fiscal du pays, facultatif' : 'Unique par société' }}</mat-hint></mat-form-field>
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
            <mat-hint>Format international ajouté selon le pays</mat-hint>@if (c.phone.invalid) {<mat-error>Numéro invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Téléphone secondaire</mat-label><input matInput type="tel" formControlName="secondaryPhone" />
            @if (c.secondaryPhone.invalid) {<mat-error>Numéro invalide</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" placeholder="contact@exemple.com" />
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
        <fieldset class="flags"><legend>Origine</legend>
          <mat-slide-toggle formControlName="isForeign" (change)="c.currency.updateValueAndValidity()">Fournisseur étranger : <strong>{{ c.isForeign.value ? 'Oui' : 'Non (local)' }}</strong></mat-slide-toggle>
        </fieldset>
        <div class="form-grid">
          @if (c.isForeign.value) {
            <mat-form-field appearance="outline"><mat-label>Devise habituelle</mat-label><mat-select formControlName="currency">@for (cur of ref.data()?.currencies ?? []; track cur.code) {<mat-option [value]="cur.code">{{ cur.code }} {{ cur.name }}</mat-option>}</mat-select>
              <mat-hint>Reprise sur les dossiers d’importation</mat-hint>@if (c.currency.invalid) {<mat-error>Devise requise pour un fournisseur étranger</mat-error>}</mat-form-field>
          }
          <mat-form-field appearance="outline"><mat-label>Délai de livraison habituel (jours)</mat-label><input matInput type="number" min="0" max="1000" formControlName="leadTimeDays" />
            @if (c.leadTimeDays.invalid) {<mat-error>Entier entre 0 et 1000</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Conditions de paiement</mat-label>
            <mat-select formControlName="paymentPreset" (selectionChange)="preset()">@for (t of terms; track t.days) {<mat-option [value]="'' + t.days">{{ t.label }}</mat-option>}<mat-option value="custom">Autre délai (en jours)</mat-option><mat-option value="free">Conditions personnalisées</mat-option></mat-select></mat-form-field>
          @if (c.paymentPreset.value === 'custom') {
            <mat-form-field appearance="outline"><mat-label>Délai de paiement (jours)</mat-label><input matInput type="number" min="0" max="365" formControlName="paymentDelayDays" />
              @if (c.paymentDelayDays.invalid) {<mat-error>Entier entre 0 et 365</mat-error>}</mat-form-field>
          }
          @if (c.paymentPreset.value === 'free') {
            <div class="wide free">
              <mat-form-field appearance="outline"><mat-label>Conditions personnalisées</mat-label>
                <textarea matInput rows="2" maxlength="500" formControlName="paymentTermsText" placeholder="Ex. 30 % à la commande et 70 % avant expédition"></textarea>
                <mat-hint>Aucune échéance n’est déduite de ce texte.</mat-hint>
                <mat-hint align="end">{{ c.paymentTermsText.value.length }}/500</mat-hint>
                @if (c.paymentTermsText.invalid) {<mat-error>Saisissez les conditions (500 caractères maximum)</mat-error>}</mat-form-field>
              <div class="examples" role="group" aria-label="Exemples de conditions"><span class="muted">Exemples :</span>
                @for (e of examples; track e) {<button type="button" class="ex" (click)="useExample(e)">{{ e }}</button>}</div>
            </div>
          }
          <mat-form-field appearance="outline"><mat-label>Remise habituelle (%)</mat-label><input matInput type="number" min="0" max="100" step="0.01" formControlName="discountPct" />
            <mat-hint>Proposée sur les nouvelles commandes</mat-hint>@if (c.discountPct.invalid) {<mat-error>Entre 0 et 100 %</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Mode de règlement habituel</mat-label>
            <mat-select formControlName="paymentMethod"><mat-option value="">Non précisé</mat-option>@for (m of methods; track m.value) {<mat-option [value]="m.value">{{ m.label }}</mat-option>}</mat-select></mat-form-field>
          @if (withAmounts()) {
            <mat-form-field appearance="outline"><mat-label>Seuil de blocage des commandes ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="blockThreshold" />
              <mat-hint>Vide = seuil des paramètres (ou aucun)</mat-hint>@if (c.blockThreshold.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          }
        </div>
        <p class="muted small">Fiscalité des achats : la TVA est saisie ligne par ligne sur les commandes et factures, selon les règles validées dans Fiscalité. Aucune retenue à la source ni timbre n’est calculé automatiquement sur les achats.</p>
        <mat-form-field appearance="outline" class="notes"><mat-label>Notes internes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
      </section>
    </form>`,
  styles: `.sections{display:flex;flex-direction:column;gap:16px}header{display:flex;align-items:center;gap:10px;margin-bottom:14px;color:var(--brand)}h3{margin:0;font-size:16px;font-weight:600;color:var(--text)}
    .kind{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}.code{font-weight:600;color:var(--brand);background:var(--brand-50);padding:4px 12px;border-radius:999px}
    .gear{width:36px;height:36px;margin:0 4px 0 8px;padding:0;border-radius:var(--r-md);color:var(--muted);--icon-size:1.15rem}.gear:hover,.gear:focus-visible{background:var(--brand-50);color:var(--brand)}
    .wide{grid-column:1/-1}.flags{display:flex;gap:12px 28px;flex-wrap:wrap;margin:0 0 16px;padding:10px 14px 14px;border:1px solid var(--border);border-radius:var(--r-md)}.flags legend{font-size:12px;font-weight:600;color:var(--muted);padding:0 6px}
    .free{margin-top:4px}.free mat-form-field{width:100%}.examples{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0 14px;font-size:12px}
    .ex{font:inherit;color:var(--brand);background:var(--brand-50);border:1px solid var(--brand-100);border-radius:999px;padding:3px 10px;cursor:pointer;text-align:left}.ex:hover{border-color:var(--brand)}.small{font-size:12px;margin:4px 0 12px}.notes{width:100%}`,
})
export class SupplierFields {
  form = input.required<SupplierForm>();
  code = input<string | null>(null);
  /** Le seuil de blocage n'est affiché qu'avec une permission financière. */
  withAmounts = input(true);
  ref = inject(ReferenceDataService); private svc = inject(SupplierService); private dialog = inject(MatDialog); private auth = inject(AuthService);
  terms = TERMS; methods = PAYMENT_METHODS; examples = ['30 % à la commande et 70 % avant expédition', 'Paiement à 60 jours', 'Paiement après réception', 'Paiement selon contrat', TERMS_EXAMPLES[1]!];
  canManage = this.auth.has('suppliers:create') || this.auth.has('suppliers:update') || this.auth.has('suppliers:delete');
  private categories = signal<SupplierCategoryDto[]>([]);
  /** Catégories actives, plus la catégorie déjà portée par le fournisseur même désactivée. */
  options = computed(() => this.categories().filter((x) => x.isActive || x.id === this.form().controls.categoryId.value));
  get c() { return this.form().controls; }
  step = () => 1 / 10 ** this.ref.decimals();
  ngOnInit() { this.load(); }
  private load() { this.svc.categories().subscribe((r) => { this.categories.set(r.items); const id = this.c.categoryId.value; if (id && !r.items.some((x) => x.id === id)) this.c.categoryId.setValue(''); }); }
  manage() { openSupplierCategories(this.dialog).subscribe(() => this.load()); }
  preset() { applySupplierPreset(this.form()); }
  useExample(text: string) { this.c.paymentTermsText.setValue(text); this.c.paymentTermsText.markAsDirty(); }
}
