import { Component, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { ContactGroup, ContactsEditor } from '../../shared/components/contacts-editor';
import { Icon } from '../../shared/components/icon';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { SupplierFields } from './supplier-fields';
import { buildSupplierForm, patchSupplierForm, supplierBody } from './supplier-form.model';
import { FINANCE_PERMISSIONS } from './supplier.labels';
import { SupplierService } from './supplier.service';

/** Création / modification d'un fournisseur (mêmes sections que l'onglet « Informations » de la fiche). */
@Component({
  selector: 'app-supplier-form',
  imports: [RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, ContactsEditor, SupplierFields],
  template: `
    <div class="page">
      <app-page-header [title]="id() ? 'Modifier le fournisseur' : 'Nouveau fournisseur'" subtitle="Le code fournisseur est généré automatiquement. Le matricule fiscal, lorsqu’il est renseigné, doit être unique.">
        <a mat-stroked-button [routerLink]="id() ? ['/suppliers', id()] : ['/suppliers']"><app-icon name="arrow_back" />Retour</a>
      </app-page-header>
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
        @if (error()) {<div class="card err" role="alert"><app-icon name="error" />{{ error() }}</div>}
        <app-supplier-fields [form]="form" [code]="code()" [withAmounts]="amounts" />
        @if (!id()) {
          <section class="card" style="margin-top:16px"><header><app-icon name="group" /><h3>Contacts (facultatif)</h3></header>
            <p class="muted small">Vous pourrez aussi gérer les personnes de contact depuis l’onglet « Contacts » de la fiche.</p>
            <app-contacts-editor [array]="contacts" /></section>
        }
        <div class="toolbar-row actions"><span class="spacer"></span><a mat-button [routerLink]="id() ? ['/suppliers', id()] : ['/suppliers']">Annuler</a>
          <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="save()"><app-icon name="save" />Enregistrer</button></div>
      }
    </div>`,
  styles: `.err{color:var(--danger);margin-bottom:16px;display:flex;gap:8px;align-items:center;border-color:var(--danger-200);background:var(--danger-50)}h3{margin:0;font-size:16px}
    header{display:flex;align-items:center;gap:10px;color:var(--brand);margin-bottom:6px}.small{font-size:12px;margin:0 0 12px}.actions{margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:var(--bg)}`,
})
export class SupplierFormPage {
  id = input<string>();
  private fb = inject(FormBuilder); private svc = inject(SupplierService); private router = inject(Router); private toast = inject(ToastService); private ref = inject(ReferenceDataService);
  private auth = inject(AuthService);
  amounts = FINANCE_PERMISSIONS.some((p) => this.auth.has(p));
  form = buildSupplierForm(this.fb);
  contacts: FormArray<ContactGroup> = this.fb.array<ContactGroup>([]);
  loading = signal(false); saving = signal(false); error = signal(''); code = signal<string | null>(null);

  ngOnInit() {
    this.ref.load$().subscribe(); const id = this.id(); if (!id) return;
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: (s) => { patchSupplierForm(this.form, s, this.ref); this.code.set(s.code); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/suppliers'); },
    });
  }

  save() {
    if (this.form.invalid || this.contacts.invalid) { this.form.markAllAsTouched(); this.contacts.markAllAsTouched(); this.error.set('Veuillez corriger les champs en erreur.'); return; }
    this.saving.set(true); this.error.set('');
    const id = this.id();
    const body = supplierBody(this.form, this.ref, !!id, this.amounts);
    const payload = id ? body : { ...body, contacts: this.contacts.getRawValue().map((c) => ({ name: c.name, role: c.role || undefined, email: c.email || undefined, phone: c.phone || undefined, isPrimary: c.isPrimary })) };
    (id ? this.svc.update(id, payload) : this.svc.create(payload)).subscribe({
      next: (s) => { this.toast.success(id ? 'Fournisseur modifié' : `Fournisseur créé (${s.code})`); this.router.navigate(['/suppliers', s.id]); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
