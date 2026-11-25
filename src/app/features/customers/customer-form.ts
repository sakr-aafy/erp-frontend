import { Component, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { ContactGroup, ContactsEditor } from '../../shared/components/contacts-editor';
import { Icon } from '../../shared/components/icon';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { CustomerFields } from './customer-fields';
import { buildCustomerForm, customerBody, patchCustomerForm } from './customer-form.model';
import { CustomerService } from './customer.service';

/** Création / modification d'un client (mêmes sections que l'onglet « Informations » de la fiche). */
@Component({
  selector: 'app-customer-form',
  imports: [RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, ContactsEditor, CustomerFields],
  template: `
    <div class="page">
      <app-page-header [title]="id() ? 'Modifier le client' : 'Nouveau client'" subtitle="Le code client est généré automatiquement. Le matricule fiscal, lorsqu’il est renseigné, doit être unique.">
        <a mat-stroked-button [routerLink]="id() ? ['/customers', id()] : ['/customers']"><app-icon name="arrow_back" />Retour</a>
      </app-page-header>
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
        @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <app-customer-fields [form]="form" [code]="code()" />
        @if (!id()) {
          <section class="card" style="margin-top:16px"><header><app-icon name="group" /><h3>Contacts (facultatif)</h3></header>
            <p class="muted small">Vous pourrez aussi gérer les personnes de contact depuis l’onglet « Contacts » de la fiche.</p>
            <app-contacts-editor [array]="contacts" /></section>
        }
        <div class="toolbar-row actions"><span class="spacer"></span><a mat-button [routerLink]="id() ? ['/customers', id()] : ['/customers']">Annuler</a>
          <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
      }
    </div>`,
  styles: `.err{color:var(--danger);margin-bottom:16px;display:flex;gap:8px;align-items:center;border-color:var(--danger-200);background:var(--danger-50)}h3{margin:0;font-size:16px}
    header{display:flex;align-items:center;gap:10px;color:var(--brand);margin-bottom:6px}.small{font-size:12px;margin:0 0 12px}.actions{margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg)}`,
})
export class CustomerForm {
  id = input<string>();
  private fb = inject(FormBuilder); private svc = inject(CustomerService); private router = inject(Router); private toast = inject(ToastService); private ref = inject(ReferenceDataService);
  form = buildCustomerForm(this.fb);
  contacts: FormArray<ContactGroup> = this.fb.array<ContactGroup>([]);
  loading = signal(false); saving = signal(false); error = signal(''); code = signal<string | null>(null);

  ngOnInit() {
    const id = this.id(); if (!id) return;
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: (c) => { patchCustomerForm(this.form, c, this.ref); this.code.set(c.code); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/customers'); },
    });
  }

  save() {
    if (this.form.invalid || this.contacts.invalid) { this.form.markAllAsTouched(); this.contacts.markAllAsTouched(); this.error.set('Veuillez corriger les champs en erreur.'); return; }
    this.saving.set(true); this.error.set('');
    const id = this.id();
    const body = customerBody(this.form, this.ref, !!id);
    const payload = id ? body : { ...body, contacts: this.contacts.getRawValue().map((c) => ({ name: c.name, role: c.role || undefined, email: c.email || undefined, phone: c.phone || undefined, isPrimary: c.isPrimary })) };
    (id ? this.svc.update(id, payload) : this.svc.create(payload)).subscribe({
      next: (c) => { this.toast.success(id ? 'Client modifié' : `Client créé (${c.code})`); this.router.navigate(['/customers', c.id]); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
