import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { errorMessage } from '../../core/services/api';
import { Api } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { Address, DeliveryAddress } from '../models/api.models';
import { AddressBody } from './address-card';
import { confirm } from './confirm-dialog';
import { openAddressDialog } from './delivery-address-dialog';
import { EmptyState } from './empty-state';
import { Icon } from './icon';
import { RowAction, RowActions } from './row-actions';

/**
 * « Adresses de livraison » d'un client ou d'un fournisseur : cartes, adresse par défaut, ajout, modification,
 * suppression (archivage si des documents l'utilisent) et réactivation. Chaque action renvoie la fiche à jour.
 */
@Component({
  selector: 'app-delivery-addresses',
  imports: [MatButtonModule, AddressBody, EmptyState, Icon, RowActions],
  template: `
    <div class="top"><h3><app-icon name="local_shipping" />Adresses de livraison @if (active().length) {<span class="count">{{ active().length }}</span>}</h3>
      @if (canEdit()) {<div class="acts">
        @if (billing()?.street || billing()?.city) {<button mat-stroked-button type="button" (click)="add(true)"><app-icon name="content_copy" />{{ billingLabel() }}</button>}
        <button mat-flat-button color="primary" type="button" (click)="add()"><app-icon name="add" />Ajouter une adresse</button></div>}</div>
    @if (!active().length) {<div class="card"><app-empty-state icon="local_shipping" message="Aucune adresse de livraison enregistrée." /></div>}
    <ul class="list">@for (a of active(); track a.id) {
      <li class="card item" [class.main]="a.isDefault">
        <header><strong class="label">{{ a.label }}</strong>@if (a.isDefault) {<span class="chip accent">Par défaut</span>}
          @if (canEdit()) {<app-row-actions class="menu" [actions]="actionsOf(a)" />}</header>
        <app-address-body [a]="a" />
      </li>}</ul>
    @if (archived().length) {
      <button mat-button type="button" class="more" [attr.aria-expanded]="showArchived()" (click)="showArchived.set(!showArchived())"><app-icon [name]="showArchived() ? 'expand_less' : 'expand_more'" />Adresses archivées ({{ archived().length }})</button>
      @if (showArchived()) {<ul class="list">@for (a of archived(); track a.id) {
        <li class="card item old"><header><strong class="label">{{ a.label }}</strong><span class="chip off">Archivée</span>
          @if (canEdit()) {<button mat-button type="button" class="menu" (click)="restore(a)"><app-icon name="unarchive" />Réactiver</button>}</header><app-address-body [a]="a" /></li>}</ul>}
    }`,
  styles: `:host{display:block}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}h3{margin:0;font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center}h3>app-icon{color:var(--brand)}
    .count{font-size:12px;font-weight:600;color:var(--brand);background:var(--brand-50);border-radius:999px;padding:0 8px;line-height:20px}.acts{display:flex;gap:8px;flex-wrap:wrap}
    .list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:12px}.item{padding:16px}.item.main{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}
    .old{background:var(--bg);color:var(--text-2)}header{display:flex;align-items:center;gap:8px;margin-bottom:8px;min-height:32px;flex-wrap:wrap}.label{overflow-wrap:anywhere}.menu{margin-left:auto}.more{margin-top:12px}`,
})
export class DeliveryAddresses {
  /** Chemin d'API du tiers : `/customers/:id` ou `/suppliers/:id`. */
  base = input.required<string>();
  addresses = input.required<DeliveryAddress[]>();
  canEdit = input(false);
  billing = input<Address | undefined>(undefined);
  billingLabel = input('Copier l’adresse de facturation');
  /** Fiche renvoyée par le serveur après une action. */
  changed = output<unknown>();
  private api = inject(Api); private dialog = inject(MatDialog); private toast = inject(ToastService);
  active = computed(() => this.addresses().filter((a) => !a.archived).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)));
  archived = computed(() => this.addresses().filter((a) => a.archived));
  showArchived = signal(false);

  private url = (a?: DeliveryAddress, suffix = '') => `${this.base()}/delivery-addresses${a ? `/${a.id}` : ''}${suffix}`;
  private done = (r: unknown, message: string) => { this.toast.success(message); this.changed.emit(r); };
  private handlers = (message: string) => ({ next: (r: unknown) => this.done(r, message), error: (e: unknown) => this.toast.error(errorMessage(e)) });
  private data = () => ({ billing: this.billing(), billingLabel: this.billingLabel() });

  add(copyBilling = false) {
    openAddressDialog(this.dialog, { ...this.data(), copyBilling, submit: (v) => this.api.post(this.url(), v) }).subscribe((r) => r && this.done(r, 'Adresse ajoutée'));
  }
  edit(a: DeliveryAddress) {
    // « Par défaut » n'est envoyé que s'il change : une simple modification ne déplace pas le défaut
    openAddressDialog(this.dialog, { ...this.data(), address: a, submit: ({ isDefault, ...v }) => this.api.put(this.url(a), { ...v, ...(isDefault !== a.isDefault && { isDefault }) }) })
      .subscribe((r) => r && this.done(r, 'Adresse modifiée'));
  }
  restore(a: DeliveryAddress) { this.api.post(this.url(a, '/restore')).subscribe(this.handlers('Adresse réactivée')); }
  remove(a: DeliveryAddress) {
    confirm(this.dialog, { title: 'Supprimer l’adresse', message: `Supprimer « ${a.label} » ? Si des documents l’utilisent, elle sera archivée : leurs adresses ne changent pas.`, confirmLabel: 'Supprimer', danger: true })
      .subscribe((ok) => ok && this.api.delete<{ addressArchived: boolean }>(this.url(a)).subscribe({
        next: (r) => this.done(r, r.addressArchived ? 'Adresse utilisée par des documents : archivée' : 'Adresse supprimée'), error: (e) => this.toast.error(errorMessage(e)),
      }));
  }
  actionsOf(a: DeliveryAddress): RowAction[] {
    return [
      { label: 'Modifier', icon: 'edit', run: () => this.edit(a) },
      { label: 'Définir par défaut', icon: 'check_circle', hidden: a.isDefault, run: () => this.api.post(this.url(a, '/default')).subscribe(this.handlers('Adresse par défaut mise à jour')) },
      { label: 'Supprimer', icon: 'delete', danger: true, run: () => this.remove(a) },
    ];
  }
}
