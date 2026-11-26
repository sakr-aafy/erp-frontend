import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from '../../shared/components/icon';
import { MatTableModule } from '@angular/material/table';
import { errorMessage } from '../../core/services/api';
import { DownloadService } from '../../core/services/download.service';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { DeliveryAddresses } from '../../shared/components/delivery-addresses';
import { AuthService } from '../../core/authentication/auth.service';
import { Skeleton } from '../../shared/components/skeleton';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { SupplierDto } from '../../shared/models/api.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { SupplierService } from './supplier.service';

@Component({
  selector: 'app-supplier-detail',
  imports: [DeliveryAddresses, RouterLink, MatButtonModule, Icon, MatTableModule, PageHeader, Skeleton, HasPermissionDirective, MoneyPipe],
  template: `
    <div class="page">
      @if (!c()) {<div class="card"><app-skeleton /></div>} @else {
      <app-page-header [title]="c()!.name" [subtitle]="(c()!.code ? c()!.code + ' · ' : '') + (c()!.tradeName ? c()!.tradeName + ' · ' : '') + (c()!.taxId ?? 'Sans matricule fiscal') + (c()!.isArchived ? ' — ARCHIVÉ' : '')">
        <button mat-stroked-button (click)="print()"><app-icon name="print" />Imprimer la fiche</button>
        <ng-container *appHasPermission="'suppliers:update'">
          @if (!c()!.isArchived) {<a mat-stroked-button [routerLink]="['edit']"><app-icon name="edit" />Modifier</a><button mat-stroked-button (click)="archive()"><app-icon name="archive" />Archiver</button>}
          @else {<button mat-flat-button color="primary" (click)="reactivate()"><app-icon name="unarchive" />Réactiver</button>}
        </ng-container>
        <button mat-stroked-button color="warn" *appHasPermission="'suppliers:delete'" (click)="remove()"><app-icon name="delete" />Supprimer</button>
      </app-page-header>
      <div class="kpis">
        <div class="card"><span class="muted">Solde dû</span><strong [style.color]="c()!.ordersBlocked ? 'var(--danger)' : null">{{ c()!.balanceMinor | money }}</strong></div>
        <div class="card"><span class="muted">Seuil de blocage</span><strong>{{ c()!.effectiveThresholdMinor === null ? 'Aucun' : (c()!.effectiveThresholdMinor | money) }}</strong></div>
        <div class="card"><span class="muted">Délai de livraison</span><strong>{{ c()!.leadTimeDays === null ? '—' : c()!.leadTimeDays + ' j' }}</strong></div>
        <div class="card"><span class="muted">Délai de paiement</span><strong>{{ c()!.paymentDelayDays }} j</strong></div>
      </div>
      @if (c()!.ordersBlocked) {<div class="card warn"><app-icon name="block" /> Seuil d’impayés dépassé : les nouvelles commandes sont bloquées pour ce fournisseur.</div>}
      <div class="cols">
        <div class="card"><h3>Coordonnées</h3>
          <dl><dt>Adresse</dt><dd>{{ address() || '—' }}</dd><dt>Téléphone</dt><dd>{{ c()!.phone || '—' }}</dd><dt>E-mail</dt><dd>{{ c()!.email || '—' }}</dd>
            <dt>Conditions de paiement</dt><dd>{{ c()!.paymentTerms || '—' }}</dd><dt>Fournisseur étranger</dt><dd>{{ c()!.isForeign ? 'Oui (' + (c()!.currency ?? '—') + ')' : 'Non' }}</dd><dt>Notes</dt><dd>{{ c()!.notes || '—' }}</dd></dl></div>
        <div class="card"><h3>Contacts</h3>
          @if (!c()!.contacts.length) {<p class="muted">Aucun contact.</p>}
          @for (k of c()!.contacts; track k._id) {<div class="contact"><strong>{{ k.name }}</strong> @if (k.isPrimary) {<span class="chip ok">Principal</span>}<br>
            <span class="muted">{{ k.role }} {{ k.phone }} {{ k.email }}</span></div>}</div>
      </div>
      <app-delivery-addresses class="addresses" [base]="'/suppliers/' + id()" [addresses]="c()!.deliveryAddresses" [canEdit]="canEditAddresses()" [billing]="c()!.address" billingLabel="Copier l’adresse du fournisseur" (changed)="onAddresses($event)" />}
    </div>`,
  styles: `.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:16px}.kpis .card{display:flex;flex-direction:column;gap:6px}.kpis strong{font-size:20px}
    .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}h3{margin:0 0 12px;font-size:16px}dl{margin:0;display:grid;grid-template-columns:150px 1fr;gap:8px}dt{color:var(--muted)}dd{margin:0}
    .warn{background:var(--accent-50);border-color:var(--accent-300);margin-bottom:16px;display:flex;gap:8px;align-items:center}.contact{margin-bottom:10px}.addresses{margin-top:20px}`,
})
export class SupplierDetail {
  id = input.required<string>();
  private svc = inject(SupplierService); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); private dl = inject(DownloadService);
  private auth = inject(AuthService);
  c = signal<SupplierDto | null>(null);
  canEditAddresses = () => this.auth.has('suppliers:update') && !this.c()?.isArchived;
  onAddresses(s: unknown) { this.c.set(s as SupplierDto); }
  address = () => { const a = this.c()?.address; return a ? [a.street, a.postalCode, a.city, a.country].filter(Boolean).join(', ') : ''; };
  ngOnInit() { this.load(); }
  load() { this.svc.get(this.id()).subscribe({ next: (c) => this.c.set(c), error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/suppliers'); } }); }
  print() { this.dl.openPdf(`/suppliers/${this.id()}/pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  archive() {
    confirm(this.dialog, { title: 'Archiver le fournisseur', message: 'Un fournisseur archivé ne peut plus recevoir de commandes. Il pourra être réactivé.', confirmLabel: 'Archiver' }).subscribe((ok) => ok &&
      this.svc.archive(this.id()).subscribe({ next: (c) => { this.c.set(c); this.toast.success('Fournisseur archivé'); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
  reactivate() { this.svc.reactivate(this.id()).subscribe({ next: (c) => { this.c.set(c); this.toast.success('Fournisseur réactivé'); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  remove() {
    confirm(this.dialog, { title: 'Supprimer le fournisseur', message: `Supprimer définitivement « ${this.c()!.name} » ? Impossible si le solde n’est pas nul ou si des documents existent.`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok &&
      this.svc.remove(this.id()).subscribe({ next: () => { this.toast.success('Fournisseur supprimé'); this.router.navigateByUrl('/suppliers'); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
}
