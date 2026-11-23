import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Icon } from '../../shared/components/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { EmptyState } from '../../shared/components/empty-state';
import { PageHeader } from '../../shared/components/page-header';
import { prompt } from '../../shared/components/prompt-dialog';
import { DOC_TYPE_LABELS, RuleDialog } from './rule-dialog';
import { FiscalRule, FiscalService, RuleKind } from './fiscal.service';

const REGIME: Record<string, string> = { taxable: 'Taxable', zero: 'Taux zéro', exempt: 'Exonération', suspended: 'Suspension' };

@Component({
  selector: 'app-fiscal-page',
  imports: [DatePipe, MatTabsModule, MatTableModule, MatButtonModule, Icon, PageHeader, EmptyState],
  template: `
    <div class="page">
      <app-page-header title="Fiscalité" subtitle="TVA, retenue à la source et timbre fiscal : règles historisées, avec date d’effet. Aucune règle n’est appliquée tant qu’elle n’est pas validée.">
        @if (auth.has('settings:create') && kind() === 'vat') {<button mat-stroked-button (click)="template()"><app-icon name="playlist_add" />Créer les brouillons de TVA courants</button>}
        @if (auth.has('settings:create')) {<button mat-flat-button color="primary" (click)="open()"><app-icon name="add" />Nouvelle règle</button>}
      </app-page-header>
      <div class="card warn"><app-icon name="info" /> Les taux et règles définitifs doivent être confirmés avec le comptable de l’entreprise avant la mise en production. Une règle validée n’est plus modifiable : créez une nouvelle version avec une date d’effet postérieure.</div>
      <div class="card">
        <mat-tab-group (selectedIndexChange)="setKind($event)">
          <mat-tab label="TVA"></mat-tab><mat-tab label="Retenue à la source"></mat-tab><mat-tab label="Timbre fiscal"></mat-tab>
        </mat-tab-group>
        @if (!rules().length) {<app-empty-state icon="rule" message="Aucune règle. Créez une règle (en brouillon) puis validez-la." />} @else {
        <div class="table-wrap"><table mat-table [dataSource]="rules()">
          <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Code</th><td mat-cell *matCellDef="let r"><strong>{{ r.code }}</strong><br><span class="muted">{{ r.label }}</span></td></ng-container>
          <ng-container matColumnDef="detail"><th mat-header-cell *matHeaderCellDef>Paramètres</th><td mat-cell *matCellDef="let r">{{ detail(r) }}</td></ng-container>
          <ng-container matColumnDef="from"><th mat-header-cell *matHeaderCellDef>Date d’effet</th><td mat-cell *matCellDef="let r">{{ r.effectiveFrom | date: 'dd/MM/yyyy' : 'UTC' }}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let r">
            <span class="chip" [class.ok]="r.status === 'validated'" [style.background]="r.status === 'draft' ? 'var(--accent-50)' : null" [style.color]="r.status === 'draft' ? 'var(--accent-ink)' : null">{{ r.status === 'validated' ? 'Validée' : 'Brouillon' }}</span>
            @if (r.isCurrent) {<span class="chip ok" style="margin-left:4px">En vigueur</span>} @if (!r.active) {<span class="chip off" style="margin-left:4px">Retrait</span>}</td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let r">
            @if (r.status === 'draft') {
              @if (auth.has('settings:validate')) {<button mat-stroked-button color="primary" (click)="validate(r)">Valider</button>}
              @if (auth.has('settings:update')) {<button mat-icon-button (click)="open(r)" aria-label="Modifier"><app-icon name="edit" /></button>}
              @if (auth.has('settings:delete')) {<button mat-icon-button (click)="remove(r)" aria-label="Supprimer"><app-icon name="delete" /></button>}
            } @else if (auth.has('settings:create')) {<button mat-button (click)="newVersion(r)"><app-icon name="history" />Nouvelle version</button>}
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr>
        </table></div>}
      </div>
    </div>`,
  styles: `.warn{background:var(--accent-50);border-color:var(--accent-300);margin-bottom:16px;display:flex;gap:8px;align-items:center}`,
})
export class FiscalPage {
  private svc = inject(FiscalService); private dialog = inject(MatDialog); private toast = inject(ToastService); private ref = inject(ReferenceDataService);
  auth = inject(AuthService);
  kinds: RuleKind[] = ['vat', 'withholding', 'stamp']; kind = signal<RuleKind>('vat'); rules = signal<FiscalRule[]>([]);
  cols = ['code', 'detail', 'from', 'status', 'actions'];
  constructor() { this.load(); }
  setKind(i: number) { this.kind.set(this.kinds[i]!); this.load(); }
  load() { this.svc.rules(this.kind()).subscribe({ next: (r) => this.rules.set(r), error: (e) => this.toast.error(errorMessage(e)) }); }
  detail(r: FiscalRule) {
    if (r.vat) return r.vat.regime === 'taxable' ? `${r.vat.ratePct} %` : REGIME[r.vat.regime];
    if (r.withholding) return `${r.withholding.ratePct} % sur ${r.withholding.base === 'ttc' ? 'TTC' : 'HT'}${r.withholding.minTotalMinor != null ? ` dès ${this.ref.format(r.withholding.minTotalMinor)}` : ''}${r.withholding.requireCustomerFlag ? ' — clients assujettis' : ''}`;
    if (r.stamp) return `${this.ref.format(r.stamp.amountMinor)} — ${r.stamp.docTypes.map((d) => DOC_TYPE_LABELS[d] ?? d).join(', ')}${r.stamp.minTotalMinor != null ? ` dès ${this.ref.format(r.stamp.minTotalMinor)}` : ''}`;
    return '';
  }
  open(rule?: FiscalRule) { this.dialog.open(RuleDialog, { data: { kind: this.kind(), rule } }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Brouillon enregistré'); this.load(); } }); }
  newVersion(r: FiscalRule) { this.dialog.open(RuleDialog, { data: { kind: this.kind(), newVersionOf: r } }).afterClosed().subscribe((x) => { if (x) { this.toast.success('Nouvelle version créée en brouillon'); this.load(); } }); }
  validate(r: FiscalRule) {
    confirm(this.dialog, { title: 'Valider la règle fiscale', confirmLabel: 'Valider',
      message: `La règle « ${r.code} » (${this.detail(r)}) s’appliquera aux documents datés à partir du ${new Date(r.effectiveFrom).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}. Une règle validée n’est plus modifiable. Avez-vous confirmé ces valeurs avec le comptable ?` })
      .subscribe((ok) => ok && this.svc.validate(r.id).subscribe({ next: () => { this.toast.success('Règle validée'); this.ref.reload(); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
  remove(r: FiscalRule) {
    confirm(this.dialog, { title: 'Supprimer le brouillon', message: `Supprimer « ${r.code} » ?`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.svc.remove(r.id).subscribe({ next: () => { this.toast.success('Supprimé'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }));
  }
  template() {
    prompt(this.dialog, { title: 'Brouillons de TVA courants (19 %, 13 %, 7 %, 0 %, exonéré, suspension)', label: 'Date d’effet (AAAA-MM-JJ)', value: `${new Date().getFullYear()}-01-01`, confirmLabel: 'Créer les brouillons' }).subscribe((d) => {
      if (d) this.svc.vatTemplate(d).subscribe({ next: (r) => { this.toast.success(`${r.length} brouillon(s) créé(s) — à valider`); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) });
    });
  }
}
