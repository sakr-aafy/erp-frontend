import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { Company, Settings } from '../../shared/models/api.models';

const DOC_TYPES: Record<string, string> = {
  quotation: 'Devis', proforma: 'Facture proforma', invoice: 'Facture de vente', creditNote: 'Facture d’avoir',
  deliveryNote: 'Bon de livraison', purchaseOrder: 'Commande d’achat', goodsReceipt: 'Réception', purchaseInvoice: 'Facture d’achat',
  importFile: 'Dossier d’importation', expense: 'Dépense',
};

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, RouterLink, MatTabsModule, MatFormFieldModule, MatInputModule, MatButtonModule, Icon, MatSelectModule, MatSlideToggleModule, MatCheckboxModule, PageHeader, Skeleton],
  template: `
    <div class="page">
      <app-page-header title="Paramètres" subtitle="Société, devises, achats et numérotation des documents." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form class="card" [formGroup]="form" (ngSubmit)="save()">
        <mat-tab-group>
          <mat-tab label="Société"><div class="form-grid tab" formGroupName="company">
            <mat-form-field appearance="outline"><mat-label>Raison sociale</mat-label><input matInput formControlName="name" />@if (form.controls.company.controls.name.invalid) {<mat-error>Requis</mat-error>}</mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Matricule fiscal</mat-label><input matInput formControlName="taxId" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Adresse</mat-label><input matInput formControlName="address" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Téléphone</mat-label><input matInput formControlName="phone" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" /></mat-form-field>
          </div></mat-tab>
          <mat-tab label="Devises"><div class="tab">
            <mat-form-field appearance="outline"><mat-label>Devise de base</mat-label>
              <mat-select formControlName="baseCurrency">@for (c of currencies.controls; track $index) {<mat-option [value]="c.controls.code.value">{{ c.controls.code.value }}</mat-option>}</mat-select></mat-form-field>
            @for (c of currencies.controls; track $index) {
              <div class="row" [formGroup]="c">
                <mat-form-field appearance="outline"><mat-label>Code (ISO)</mat-label><input matInput formControlName="code" maxlength="3" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Nom</mat-label><input matInput formControlName="name" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Symbole</mat-label><input matInput formControlName="symbol" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Décimales</mat-label><input matInput type="number" formControlName="decimals" min="0" max="6" /></mat-form-field>
                <button mat-icon-button type="button" (click)="currencies.removeAt($index)" aria-label="Retirer"><app-icon name="delete" /></button>
              </div>}
            <button mat-stroked-button type="button" (click)="addCurrency()"><app-icon name="add" />Ajouter une devise</button>
            <p class="muted">Les montants sont stockés en entiers (plus petite unité de la devise, selon le nombre de décimales).</p>
          </div></mat-tab>
          <mat-tab label="Fiscalité"><div class="tab">
            <p>La TVA, la retenue à la source et le timbre fiscal sont gérés dans la page <a routerLink="/fiscal">Fiscalité</a> : règles historisées avec date d’effet, appliquées seulement après validation.</p>
          </div></mat-tab>
          <mat-tab label="Achats"><div class="tab">
            <p class="muted">Seuil global de solde impayé au-delà duquel les commandes d’un fournisseur sont bloquées (chaque fournisseur peut avoir son propre seuil). Vide = pas de blocage.</p>
            <mat-form-field appearance="outline" style="max-width:360px"><mat-label>Seuil de blocage global ({{ form.controls.baseCurrency.value }})</mat-label>
              <input matInput type="number" min="0" step="0.001" formControlName="supplierThreshold" />@if (form.controls.supplierThreshold.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
          </div></mat-tab>
          <mat-tab label="Numérotation"><div class="tab">
            <p class="muted">Format : préfixe + année (optionnelle) + numéro séquentiel généré côté serveur. Les formats légaux sont à valider.</p>
            @for (n of numbering.controls; track $index) {
              <div class="row" [formGroup]="n">
                <mat-form-field appearance="outline"><mat-label>Document</mat-label>
                  <mat-select formControlName="docType">@for (d of docTypes; track d.key) {<mat-option [value]="d.key">{{ d.label }}</mat-option>}</mat-select></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Préfixe</mat-label><input matInput formControlName="prefix" maxlength="10" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Chiffres</mat-label><input matInput type="number" formControlName="padding" min="1" max="12" /></mat-form-field>
                <mat-checkbox formControlName="includeYear">Année</mat-checkbox>
                <mat-checkbox formControlName="resetYearly">Remise à zéro annuelle</mat-checkbox>
                <button mat-icon-button type="button" (click)="numbering.removeAt($index)" aria-label="Retirer"><app-icon name="delete" /></button>
              </div>}
            <button mat-stroked-button type="button" (click)="addNumbering()"><app-icon name="add" />Ajouter un format</button>
          </div></mat-tab>
        </mat-tab-group>
        @if (error()) {<div style="color:var(--danger);margin:12px 0" role="alert">{{ error() }}</div>}
        <div class="toolbar-row" style="margin-top:16px"><span class="spacer"></span>
          @if (canEdit) {<button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button>}</div>
      </form>}
    </div>`,
  styles: `.tab{padding:20px 0;display:flex;flex-direction:column;gap:4px}.tab.form-grid{display:grid}
    .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.row mat-form-field{flex:1;min-width:140px}`,
})
export class SettingsPage {
  private http = inject(HttpClient); private fb = inject(FormBuilder); private toast = inject(ToastService); private ref = inject(ReferenceDataService);
  canEdit = inject(AuthService).has('settings:update');
  docTypes = Object.entries(DOC_TYPES).map(([key, label]) => ({ key, label }));
  loading = signal(true); saving = signal(false); error = signal('');
  private decimalsOf = (code: string) => this.currencies.controls.find((c) => c.controls.code.value === code)?.controls.decimals.value ?? 3;

  form = this.fb.nonNullable.group({
    company: this.fb.nonNullable.group({ name: ['', Validators.required], taxId: [''], address: [''], phone: [''], email: ['', Validators.email] }),
    baseCurrency: ['', Validators.required],
    currencies: this.fb.array([this.currencyGroup()]),
    numbering: this.fb.array<ReturnType<SettingsPage['numberingGroup']>>([]),
    supplierThreshold: [null as number | null, Validators.min(0)],
  });
  get currencies() { return this.form.controls.currencies; }
  get numbering() { return this.form.controls.numbering; }

  currencyGroup(c?: { code: string; name?: string; symbol?: string; decimals: number }) {
    return this.fb.nonNullable.group({ code: [c?.code ?? '', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]], name: [c?.name ?? ''], symbol: [c?.symbol ?? ''], decimals: [c?.decimals ?? 2, [Validators.required, Validators.min(0), Validators.max(6)]] });
  }
  numberingGroup(n?: { docType: string; prefix: string; padding: number; includeYear: boolean; resetYearly: boolean }) {
    return this.fb.nonNullable.group({ docType: [n?.docType ?? '', Validators.required], prefix: [n?.prefix ?? ''], padding: [n?.padding ?? 5, [Validators.required, Validators.min(1), Validators.max(12)]], includeYear: [n?.includeYear ?? true], resetYearly: [n?.resetYearly ?? true] });
  }
  addCurrency() { this.currencies.push(this.currencyGroup()); }
  addNumbering() { this.numbering.push(this.numberingGroup()); }

  constructor() {
    forkJoin({ c: this.http.get<Company>(`${environment.apiUrl}/companies/current`), s: this.http.get<Settings>(`${environment.apiUrl}/settings`) }).subscribe({
      next: ({ c, s }) => {
        this.form.controls.company.patchValue({ name: c.name, taxId: c.taxId ?? '', address: c.address ?? '', phone: c.phone ?? '', email: c.email ?? '' });
        this.currencies.clear(); s.currencies.forEach((x) => this.currencies.push(this.currencyGroup(x)));
        this.form.controls.baseCurrency.setValue(s.baseCurrency);
        s.numbering.forEach((n) => this.numbering.push(this.numberingGroup(n)));
        const dec = s.currencies.find((x) => x.code === s.baseCurrency)?.decimals ?? 3;
        this.form.controls.supplierThreshold.setValue(s.supplierBlockThresholdMinor != null ? s.supplierBlockThresholdMinor / 10 ** dec : null);
        if (!this.canEdit) this.form.disable();
        this.loading.set(false);
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.loading.set(false); },
    });
  }

  save() {
    const v = this.form.getRawValue();
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error.set('Certains champs sont invalides (voir chaque onglet).'); return; }
    this.saving.set(true); this.error.set('');
    const dec = this.decimalsOf(v.baseCurrency);
    const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== '' && x !== null)) as Partial<T>;
    const company = clean(v.company);
    const settings = {
      baseCurrency: v.baseCurrency,
      currencies: v.currencies.map((c) => clean(c)),
      numbering: v.numbering,
      supplierBlockThresholdMinor: v.supplierThreshold === null || (v.supplierThreshold as unknown) === '' ? null : Math.round(Number(v.supplierThreshold) * 10 ** dec),
    };
    forkJoin([this.http.put(`${environment.apiUrl}/companies/current`, company), this.http.put(`${environment.apiUrl}/settings`, settings)]).subscribe({
      next: () => { this.toast.success('Paramètres enregistrés'); this.saving.set(false); this.ref.reload(); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
