import { Component, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { ContactGroup, ContactsEditor, contactGroup } from '../../shared/components/contacts-editor';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { CustomerService } from './customer.service';

@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatButtonModule, PageHeader, Skeleton, ContactsEditor],
  template: `
    <div class="page">
      <app-page-header [title]="id() ? 'Modifier le client' : 'Nouveau client'" subtitle="Le matricule fiscal doit être unique. Sans limite de crédit, les ventes ne sont pas plafonnées." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card" style="color:var(--danger);margin-bottom:16px" role="alert">{{ error() }}</div>}
        <div class="card" style="margin-bottom:16px"><h3>Identification</h3><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Raison sociale</mat-label><input matInput formControlName="name" />
            @if (form.controls.name.invalid && form.controls.name.touched) {<mat-error>2 caractères minimum</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Matricule fiscal</mat-label><input matInput formControlName="taxId" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Téléphone</mat-label><input matInput formControlName="phone" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" />
            @if (form.controls.email.invalid) {<mat-error>E-mail invalide</mat-error>}</mat-form-field>
        </div></div>
        <div class="card" style="margin-bottom:16px" formGroupName="address"><h3>Adresse</h3><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Rue</mat-label><input matInput formControlName="street" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Code postal</mat-label><input matInput formControlName="postalCode" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Ville</mat-label><input matInput formControlName="city" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Pays</mat-label><input matInput formControlName="country" /></mat-form-field>
        </div></div>
        <div class="card" style="margin-bottom:16px"><h3>Conditions fiscales</h3>
          <p class="muted">Utilisées par les règles de retenue à la source et de timbre fiscal validées dans Fiscalité (aucune n’est appliquée sans règle validée).</p>
          <div class="flags"><mat-slide-toggle formControlName="subjectToWithholding">Client assujetti à la retenue à la source</mat-slide-toggle>
            <mat-slide-toggle formControlName="stampExempt">Client exonéré du timbre fiscal</mat-slide-toggle></div></div>
        <div class="card" style="margin-bottom:16px"><h3>Conditions commerciales</h3><div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Conditions de paiement</mat-label><input matInput formControlName="paymentTerms" placeholder="Ex. 30 jours fin de mois" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Délai de paiement (jours)</mat-label><input matInput type="number" min="0" max="365" formControlName="paymentDelayDays" />
            @if (form.controls.paymentDelayDays.invalid) {<mat-error>Entier entre 0 et 365</mat-error>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Limite de crédit ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="step()" formControlName="creditLimit" />
            <mat-hint>Vide = illimitée</mat-hint>@if (form.controls.creditLimit.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
        </div>
          <mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field></div>
        <div class="card" style="margin-bottom:16px"><h3>Contacts et interlocuteurs</h3><app-contacts-editor [array]="contacts" /></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button [routerLink]="id() ? ['/customers', id()] : ['/customers']">Annuler</a>
          <button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}
    </div>`,
  styles: `h3{margin:0 0 12px;font-size:16px}.flags{display:flex;gap:24px;flex-wrap:wrap}`,
})
export class CustomerForm {
  id = input<string>();
  private fb = inject(FormBuilder); private svc = inject(CustomerService); private router = inject(Router); private toast = inject(ToastService);
  ref = inject(ReferenceDataService);
  contacts: FormArray<ContactGroup> = this.fb.array<ContactGroup>([]);
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]], taxId: [''], phone: [''], email: ['', Validators.email],
    address: this.fb.nonNullable.group({ street: [''], city: [''], postalCode: [''], country: [''] }),
    paymentTerms: [''], paymentDelayDays: [0, [Validators.min(0), Validators.max(365)]], creditLimit: [null as number | null, Validators.min(0)], notes: [''],
    subjectToWithholding: [false], stampExempt: [false],
  });
  loading = signal(false); saving = signal(false); error = signal('');
  step = () => 1 / 10 ** this.ref.decimals();

  ngOnInit() {
    const id = this.id(); if (!id) return;
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: (c) => {
        this.form.patchValue({ name: c.name, taxId: c.taxId ?? '', phone: c.phone ?? '', email: c.email ?? '', address: { street: c.address.street ?? '', city: c.address.city ?? '', postalCode: c.address.postalCode ?? '', country: c.address.country ?? '' },
          paymentTerms: c.paymentTerms ?? '', paymentDelayDays: c.paymentDelayDays, creditLimit: c.creditLimitMinor == null ? null : this.ref.fromMinor(c.creditLimitMinor), notes: c.notes ?? '',
          subjectToWithholding: c.subjectToWithholding, stampExempt: c.stampExempt });
        c.contacts.forEach((k) => this.contacts.push(contactGroup(this.fb, k)));
        this.loading.set(false);
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/customers'); },
    });
  }

  save() {
    if (this.form.invalid || this.contacts.invalid) { this.form.markAllAsTouched(); this.contacts.markAllAsTouched(); this.error.set('Veuillez corriger les champs en erreur.'); return; }
    this.saving.set(true); this.error.set('');
    const v = this.form.getRawValue();
    const body = {
      name: v.name, taxId: v.taxId || undefined, phone: v.phone || undefined, email: v.email || undefined, address: v.address, paymentTerms: v.paymentTerms || undefined,
      paymentDelayDays: Number(v.paymentDelayDays) || 0, creditLimitMinor: v.creditLimit === null || (v.creditLimit as unknown) === '' ? null : this.ref.toMinor(Number(v.creditLimit)), notes: v.notes || undefined,
      subjectToWithholding: v.subjectToWithholding, stampExempt: v.stampExempt,
      contacts: this.contacts.getRawValue().map((c) => ({ name: c.name, role: c.role || undefined, email: c.email || undefined, phone: c.phone || undefined, isPrimary: c.isPrimary })),
    };
    const id = this.id();
    (id ? this.svc.update(id, this.nullify(body)) : this.svc.create(body)).subscribe({
      next: (c) => { this.toast.success(id ? 'Client modifié' : 'Client créé'); this.router.navigate(['/customers', c.id]); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
  /** À la modification, un champ vidé doit être effacé côté serveur (null), pas ignoré. */
  private nullify(b: Record<string, unknown>) {
    const out = { ...b };
    for (const k of ['taxId', 'phone', 'email', 'paymentTerms', 'notes']) if (out[k] === undefined) out[k] = null;
    return out;
  }
}
