import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { Icon } from '../../shared/components/icon';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { Skeleton } from '../../shared/components/skeleton';
import { PaymentTerm, PaymentTermService } from './payment-term.service';

const noBlank = (c: { value: string }) => (c.value.trim() ? null : { required: true });

/**
 * Gestion des conditions de paiement (même principe que « Catégories & unités ») : ajout, recherche, modification,
 * désactivation, condition par défaut. Le délai en jours sert au calcul des échéances ; sans délai, c'est une description.
 */
@Component({
  selector: 'app-payment-terms-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, Icon, RowActions, Skeleton],
  template: `
    <h2 mat-dialog-title>Conditions de paiement</h2>
    <mat-dialog-content class="body">
      @if (canEdit()) {
        <form [formGroup]="form" (ngSubmit)="save()" class="add">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="label"><mat-label>{{ editing() ? 'Modifier la condition' : 'Nouvelle condition' }}</mat-label>
            <input matInput formControlName="label" maxlength="500" placeholder="Ex. 30 % à la commande et 70 % avant livraison" /></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="days"><mat-label>Délai (jours)</mat-label><input matInput type="number" min="0" max="365" step="1" formControlName="delayDays" /></mat-form-field>
          <button mat-flat-button color="primary" [disabled]="busy()"><app-icon [name]="editing() ? 'save' : 'add'" />{{ editing() ? 'Enregistrer' : 'Ajouter' }}</button>
          @if (editing()) {<button mat-button type="button" (click)="cancel()">Annuler</button>}
        </form>
        <p class="muted small">Avec un délai, l’échéance des factures est calculée. Sans délai, la condition est une description : l’échéancier se saisit sur chaque facture.
          @if (editing()?.used) { <strong>Les fiches qui portent cette condition suivront ; les documents déjà créés gardent leur texte.</strong> }</p>
      }
      @if (error()) {<div class="err" role="alert"><app-icon name="error" />{{ error() }}</div>}
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search"><mat-label>Rechercher une condition</mat-label><app-icon matPrefix name="search" />
        <input matInput [value]="q()" (input)="q.set($any($event.target).value)" /></mat-form-field>
      @if (loading()) {<app-skeleton />}
      @else if (!shown().length) {<p class="muted empty">{{ q() ? 'Aucune condition ne correspond à la recherche.' : 'Aucune condition : ajoutez la première ci-dessus.' }}</p>}
      @else {
        <ul>@for (t of shown(); track t.id) {
          <li [class.off]="!t.isActive"><div class="txt"><strong>{{ t.label }}</strong>
              <span class="muted">{{ t.delayDays === null ? 'Description (échéancier sur la facture)' : t.delayDays === 0 ? 'Échéance immédiate' : 'Échéance à ' + t.delayDays + ' jours' }} · {{ usage(t) }}</span></div>
            @if (t.isDefault) {<span class="chip info">Par défaut</span>}
            @if (!t.isActive) {<span class="chip off">Désactivée</span>}
            @if (canEdit() || canDelete()) {<app-row-actions [actions]="actions(t)" />}</li>}</ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-flat-button color="primary" type="button" mat-dialog-close>Fermer</button></mat-dialog-actions>`,
  styles: `.body{width:640px;max-width:100%;box-sizing:border-box;padding-top:8px!important}.add{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.label{flex:1 1 260px}.days{width:130px}.search{width:100%;margin-bottom:8px}.small{font-size:12px;margin:6px 0 12px}
    ul{list-style:none;margin:0;padding:0}li{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border)}li.off .txt strong{color:var(--muted)}.txt{display:flex;flex-direction:column;flex:1;min-width:0;overflow-wrap:anywhere}.txt span{font-size:12px}
    .err{display:flex;gap:8px;align-items:center;color:var(--danger);background:var(--danger-50);border:1px solid var(--danger-200);border-radius:var(--r-md);padding:8px 12px;margin-bottom:12px}.empty{padding:12px 0}`,
})
export class PaymentTermsDialog {
  private svc = inject(PaymentTermService); private auth = inject(AuthService); private toast = inject(ToastService); private dialog = inject(MatDialog);
  form = inject(FormBuilder).group({ label: ['', { validators: [noBlank, Validators.maxLength(500)], nonNullable: true }], delayDays: [null as number | null, [Validators.min(0), Validators.max(365), Validators.pattern(/^\d*$/)]] });
  private formView = viewChild(FormGroupDirective);
  q = signal(''); busy = signal(false); error = signal(''); loading = signal(true); editing = signal<PaymentTerm | null>(null);
  shown = computed(() => { const q = this.q().trim().toLocaleLowerCase('fr'); return this.svc.terms().filter((t) => !q || t.label.toLocaleLowerCase('fr').includes(q)); });
  canEdit = () => (this.editing() ? this.auth.has('customers:update') : this.auth.has('customers:create'));
  canDelete = () => this.auth.has('customers:delete');
  usage(t: PaymentTerm) { return t.used ? `${t.partyCount} fiche(s), ${t.documentCount} document(s)` : 'non utilisée'; }
  constructor() { this.svc.refresh().subscribe({ next: () => this.loading.set(false), error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } }); }
  private run(call: Observable<unknown>, done: string) {
    this.busy.set(true); this.error.set('');
    call.subscribe({ next: () => { this.busy.set(false); this.toast.success(done); this.cancel(); this.svc.load(); }, error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); } });
  }
  save() {
    if (this.form.invalid) { this.error.set('Saisissez un libellé ; le délai est un nombre entier de 0 à 365 jours.'); return; }
    const v = this.form.getRawValue(); const raw = v.delayDays as number | string | null;
    const body = { label: (v.label ?? '').trim(), delayDays: raw === null || raw === '' ? null : Number(raw) }; const e = this.editing();
    this.run(e ? this.svc.update(e.id, body) : this.svc.create(body), e ? 'Condition modifiée' : 'Condition ajoutée');
  }
  /** `resetForm` efface aussi l'état « soumis » : le champ vidé ne reste pas affiché en erreur. */
  cancel() { this.editing.set(null); const empty = { label: '', delayDays: null }; const view = this.formView(); if (view) view.resetForm(empty); else this.form.reset(empty); }
  actions(t: PaymentTerm): RowAction[] {
    const update = this.auth.has('customers:update');
    return [
      { label: 'Modifier', icon: 'edit', hidden: !update, run: () => { this.editing.set(t); this.form.setValue({ label: t.label, delayDays: t.delayDays }); } },
      { label: t.isDefault ? 'Ne plus proposer par défaut' : 'Définir par défaut', icon: 'check_circle', hidden: !update || !t.isActive, run: () => this.run(this.svc.setDefault(t.id, !t.isDefault), 'Condition par défaut enregistrée') },
      { label: t.isActive ? 'Désactiver' : 'Réactiver', icon: t.isActive ? 'block' : 'restore', hidden: !update, run: () => this.run(this.svc.setActive(t.id, !t.isActive), t.isActive ? 'Condition désactivée' : 'Condition réactivée') },
      { label: 'Supprimer', icon: 'delete', danger: true, hidden: !this.canDelete() || t.used, run: () => confirm(this.dialog, { title: 'Supprimer la condition', message: `Supprimer définitivement « ${t.label} » ?`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => { if (ok) this.run(this.svc.remove(t.id), 'Condition supprimée'); }) },
    ];
  }
}
export const openPaymentTerms = (dialog: MatDialog) => dialog.open(PaymentTermsDialog, { autoFocus: 'first-tabbable', maxWidth: '95vw' }).afterClosed();
