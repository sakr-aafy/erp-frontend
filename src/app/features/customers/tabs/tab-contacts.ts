import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state';
import { Icon } from '../../../shared/components/icon';
import { RowAction, RowActions } from '../../../shared/components/row-actions';
import { Contact, Customer2 } from '../../../shared/models/api.models';
import { openContactDialog } from '../customer-dialogs';
import { CustomerService } from '../customer.service';

/** Onglet Contacts : plusieurs personnes de contact, un seul contact principal à tout instant (garanti côté serveur). */
@Component({
  selector: 'app-tab-contacts',
  imports: [MatButtonModule, Icon, EmptyState, RowActions],
  template: `
    <div class="top"><h2>Personnes de contact</h2>@if (canEdit()) {<button mat-flat-button color="primary" type="button" (click)="add()"><app-icon name="add" />Ajouter</button>}</div>
    @if (!c().contacts.length) {<div class="card"><app-empty-state icon="group" message="Aucun contact enregistré pour ce client."/></div>}
    <div class="list">@for (k of c().contacts; track k._id) {
      <article class="card k" [class.main]="k.isPrimary">
        <span class="av">{{ initials(k.name) }}</span>
        <div class="body"><div class="nm"><strong>{{ k.name }}</strong>@if (k.isPrimary) {<span class="chip ok">Contact principal</span>}</div>
          @if (k.role) {<span class="muted">{{ k.role }}</span>}
          <div class="lines">@if (k.phone) {<a [href]="'tel:' + k.phone"><app-icon name="phone" />{{ k.phone }}</a>}@if (k.email) {<a [href]="'mailto:' + k.email"><app-icon name="mail" />{{ k.email }}</a>}</div></div>
        @if (canEdit()) {<app-row-actions [actions]="actionsOf(k)" />}
      </article>}</div>
    <p class="muted small">Un client peut avoir plusieurs contacts ; un seul est désigné contact principal.</p>`,
  styles: `.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}h2{margin:0;font-size:16px;font-weight:600}.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
    .k{display:flex;align-items:flex-start;gap:14px;padding:16px}.k.main{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}.av{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--brand-50);color:var(--brand);font-weight:600;flex:none}
    .body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.nm{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.lines{display:flex;flex-direction:column;gap:4px;margin-top:6px}.lines a{display:inline-flex;align-items:center;gap:8px;color:var(--text-2);text-decoration:none;overflow-wrap:anywhere}
    .lines a:hover{color:var(--brand)}.lines app-icon{color:var(--brand)}.small{font-size:12px;margin-top:12px}`,
})
export class TabContacts {
  c = input.required<Customer2>(); changed = output<Customer2>();
  private svc = inject(CustomerService); private dialog = inject(MatDialog); private toast = inject(ToastService); private auth = inject(AuthService);
  canEdit = computed(() => this.auth.has('customers:update') && this.c().status !== 'archived');
  initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join('');
  private done = (msg: string) => ({ next: (u: Customer2) => { this.toast.success(msg); this.changed.emit(u); }, error: (e: unknown) => this.toast.error(errorMessage(e)) });
  add() { openContactDialog(this.dialog, { submit: (v) => this.svc.addContact(this.c().id, v) }).subscribe((r) => { if (r) { this.toast.success('Contact ajouté'); this.changed.emit(r as Customer2); } }); }
  edit(k: Contact) { openContactDialog(this.dialog, { contact: k, submit: (v) => this.svc.updateContact(this.c().id, k._id!, v) }).subscribe((r) => { if (r) { this.toast.success('Contact modifié'); this.changed.emit(r as Customer2); } }); }
  actionsOf(k: Contact): RowAction[] {
    return [
      { label: 'Modifier', icon: 'edit', run: () => this.edit(k) },
      { label: 'Définir comme principal', icon: 'check_circle', hidden: k.isPrimary, run: () => this.svc.setPrimary(this.c().id, k._id!).subscribe(this.done('Contact principal mis à jour')) },
      { label: 'Supprimer', icon: 'delete', danger: true, run: () => confirm(this.dialog, { title: 'Supprimer le contact', message: `Supprimer « ${k.name} » ?${k.isPrimary ? ' Un autre contact deviendra principal.' : ''}`, confirmLabel: 'Supprimer', danger: true })
        .subscribe((ok) => ok && this.svc.removeContact(this.c().id, k._id!).subscribe(this.done('Contact supprimé'))) },
    ];
  }
}
