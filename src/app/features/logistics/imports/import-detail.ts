import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../../core/services/api.service';
import { AuthService } from '../../../core/authentication/auth.service';
import { errorMessage } from '../../../core/services/api';
import { DownloadService } from '../../../core/services/download.service';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { ToastService } from '../../../core/services/toast.service';
import { confirm } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';
import { prompt } from '../../../shared/components/prompt-dialog';
import { Skeleton } from '../../../shared/components/skeleton';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { QtyPipe } from '../../../shared/pipes/quantity.pipe';

export const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', ordered: 'Commandé', shipped: 'Expédié', customs: 'En douane', arrived: 'Arrivé', closed: 'Clôturé', integrated: 'Intégré au stock', cancelled: 'Annulé' };
const NEXT: Record<string, string> = { draft: 'ordered', ordered: 'shipped', shipped: 'customs', customs: 'arrived' };
const CHARGE_LABELS: Record<string, string> = { freight: 'Fret / transport', customs_duty: 'Droits de douane', customs_fees: 'Frais de douane', transit: 'Transit', insurance: 'Assurance', other: 'Autres frais' };
const DOC_KINDS: Record<string, string> = { invoice: 'Facture', packing_list: 'Liste de colisage', bill_of_lading: 'Connaissement', customs_declaration: 'Déclaration en douane', insurance: 'Assurance', certificate: 'Certificat', other: 'Autre' };

@Component({
  selector: 'app-charge-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `<h2 mat-dialog-title>{{ data.charge ? 'Modifier le frais' : 'Ajouter un frais annexe' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()"><mat-dialog-content style="display:flex;flex-direction:column;min-width:min(440px,86vw)">
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      <mat-form-field appearance="outline"><mat-label>Type de frais</mat-label><mat-select formControlName="type">@for (t of types; track t.key) {<mat-option [value]="t.key">{{ t.label }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Libellé</mat-label><input matInput formControlName="label" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Devise du frais</mat-label><mat-select formControlName="currency">@for (c of currencies; track c) {<mat-option [value]="c">{{ c }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Montant ({{ form.controls.currency.value }})</mat-label><input matInput type="number" min="0" [step]="1 / 10 ** dec()" formControlName="amount" />@if (form.controls.amount.invalid) {<mat-error>Montant positif requis</mat-error>}</mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Date de l’opération (taux du jour)</mat-label><input matInput type="date" formControlName="date" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Taux de change (vide = taux du jour)</mat-label><input matInput type="number" min="0" step="0.000001" formControlName="rate" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Répartition sur les articles</mat-label><mat-select formControlName="allocation"><mat-option value="value">Au prorata de la valeur</mat-option><mat-option value="quantity">Au prorata des quantités</mat-option></mat-select></mat-form-field>
    </mat-dialog-content><mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary">Enregistrer</button></mat-dialog-actions></form>`,
})
export class ChargeDialog {
  data = inject<{ fileId: string; currency: string; charge?: any }>(MAT_DIALOG_DATA); private ref_ = inject(MatDialogRef<ChargeDialog>); private api = inject(Api); ref = inject(ReferenceDataService);  
  types = Object.entries(CHARGE_LABELS).map(([key, label]) => ({ key, label })); currencies = [this.data.currency, this.ref.data()?.baseCurrency ?? 'TND'].filter((v, i, a) => a.indexOf(v) === i); error = signal('');
  c = this.data.charge;
  form = new FormBuilder().nonNullable.group({ type: [this.c?.type ?? 'freight'], label: [this.c?.label ?? ''], currency: [this.c?.currency ?? this.data.currency], amount: [this.c ? this.ref.fromMinor(this.c.amountMinor, this.ref.decimalsOf(this.c.currency)) : (null as number | null), [Validators.required, Validators.min(0)]],
    date: [this.c?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)], rate: [null as number | null], allocation: [this.c?.allocation ?? 'value'] });
  dec = () => this.ref.decimalsOf(this.form.controls.currency.value);
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; } const v = this.form.getRawValue();
    const body = { type: v.type, label: v.label || undefined, amountMinor: this.ref.toMinor(Number(v.amount), this.dec()), currency: v.currency, date: v.date || undefined, ...(v.rate && { exchangeRate: Number(v.rate) }), allocation: v.allocation };
    (this.c ? this.api.put(`/imports/${this.data.fileId}/charges/${this.c.id}`, body) : this.api.post(`/imports/${this.data.fileId}/charges`, body)).subscribe({ next: (f) => this.ref_.close(f), error: (e) => this.error.set(errorMessage(e)) });
  }
}

@Component({
  selector: 'app-integrate-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `<h2 mat-dialog-title>Intégrer les marchandises au stock</h2>
    <mat-dialog-content style="display:flex;flex-direction:column;min-width:min(480px,88vw)">
      <p class="muted">Entrée en stock au coût de revient rendu (clôturé). Le dossier passera à « intégré » et ne sera plus modifiable.</p>
      @if (error()) {<div style="color:var(--danger)" role="alert">{{ error() }}</div>}
      <mat-form-field appearance="outline"><mat-label>Magasin</mat-label><mat-select [formControl]="wh">@for (w of warehouses(); track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select></mat-form-field>
      @for (l of data.lines; track l.id; let i = $index) {<mat-form-field appearance="outline"><mat-label>N° de série — {{ l.designation }} (si article suivi par série)</mat-label><textarea matInput rows="2" [formControl]="serials[i]!"></textarea></mat-form-field>}
    </mat-dialog-content><mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="wh.invalid">Intégrer</button></mat-dialog-actions>`,
})
export class IntegrateDialog {
  data = inject<{ fileId: string; lines: any[] }>(MAT_DIALOG_DATA); private ref_ = inject(MatDialogRef<IntegrateDialog>); private api = inject(Api);  
  warehouses = signal<{ id: string; code: string; name: string }[]>([]); wh = new FormControl('', { nonNullable: true, validators: Validators.required }); serials = this.data.lines.map(() => new FormControl('', { nonNullable: true })); error = signal('');
  constructor() { this.api.get('/warehouses').subscribe((w) => { this.warehouses.set(w.filter((x: { isActive: boolean }) => x.isActive)); const d = w.find((x: { isDefault: boolean }) => x.isDefault); if (d) this.wh.setValue(d.id); }); }
  save() { const serials: Record<string, string[]> = {}; this.data.lines.forEach((l, i) => { const s = this.serials[i]!.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); if (s.length) serials[l.id] = s; });
    this.api.post(`/imports/${this.data.fileId}/integrate`, { warehouseId: this.wh.value, ...(Object.keys(serials).length && { serials }) }).subscribe({ next: (f) => this.ref_.close(f), error: (e) => this.error.set(errorMessage(e)) }); }
}

/** Dossier d'importation : statuts, frais annexes (recalcul automatique), coût de revient rendu, documents, clôture, intégration au stock. */
@Component({
  selector: 'app-import-detail',
  imports: [QtyPipe, DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, MoneyPipe],
  template: `
    <div class="page">@if (!d()) {<div class="card"><app-skeleton /></div>} @else {
      <app-page-header [title]="'Dossier d’importation ' + d().number" [subtitle]="d().supplier?.name + ' — ' + d().currency + ' (taux ' + d().exchangeRate + ' au ' + (d().exchangeRateDate | date: 'dd/MM/yyyy' : 'UTC') + ')'">
        @if (d().editableLines && auth.has('imports:update')) {<a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>}
        @if (d().status === 'draft' && auth.has('imports:delete')) {<button mat-stroked-button color="warn" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
        @if (cancellable() && auth.has('imports:update')) {<button mat-stroked-button color="warn" (click)="cancel()"><app-icon name="cancel" />Annuler</button>}
        @if (next() && auth.has('imports:update')) {<button mat-stroked-button (click)="advance()"><app-icon name="arrow_forward" />Passer à « {{ label(next()!) }} »</button>}
        @if (['ordered', 'shipped', 'customs', 'arrived'].includes(d().status) && auth.has('imports:validate')) {<button mat-flat-button color="primary" (click)="close()"><app-icon name="lock" />Clôturer le dossier</button>}
        @if (d().status === 'closed' && auth.has('imports:validate')) {<button mat-flat-button color="primary" (click)="integrate()"><app-icon name="inventory" />Intégrer au stock</button>}
      </app-page-header>
      <p><span class="chip" [class.ok]="['closed', 'integrated'].includes(d().status)" [class.off]="d().status === 'cancelled'">{{ label(d().status) }}</span> <span class="muted">commande du {{ d().orderDate | date: 'dd/MM/yyyy' : 'UTC' }}{{ d().reference ? ' — réf. ' + d().reference : '' }}</span>
        @if (d().receiptId) {<a [routerLink]="['/goods-receipts', d().receiptId]" style="margin-left:12px">Réception d’intégration</a>}</p>
      @if (d().status === 'closed') {<div class="card info">Dossier clôturé : les frais sont figés et le coût de revient rendu est définitif. Il peut être intégré au stock.</div>}
      <div class="kpis"><div class="card"><span class="muted">Valeur FOB (devise de base)</span><strong>{{ d().totals.fobBaseMinor | money }}</strong></div><div class="card"><span class="muted">Frais annexes</span><strong>{{ d().totals.chargesBaseMinor | money }}</strong></div><div class="card"><span class="muted">Coût de revient rendu</span><strong>{{ d().totals.landedMinor | money }}</strong></div></div>
      <div class="card"><h3>Coût de revient par article</h3><div class="table-wrap"><table class="lines"><thead><tr><th>Article</th><th class="r">Qté</th><th class="r">FOB</th><th class="r">Frais répartis</th><th class="r">Coût rendu</th><th class="r">Coût unitaire</th></tr></thead>
        <tbody>@for (l of d().lines; track l.id) {<tr><td>{{ l.reference }} — {{ l.designation }}</td><td class="r">{{ l.quantity | qty }}</td><td class="r">{{ l.fobBaseMinor | money }}</td><td class="r">{{ l.allocatedChargesMinor | money }}</td><td class="r"><strong>{{ l.landedTotalMinor | money }}</strong></td><td class="r">{{ l.unitLandedMinor | money }}</td></tr>}</tbody></table></div></div>
      <div class="card" style="margin-top:16px"><div class="toolbar-row"><h3 style="margin:0">Frais annexes</h3><span class="spacer"></span>@if (d().chargesOpen && auth.has('imports:update')) {<button mat-flat-button color="primary" (click)="charge()"><app-icon name="add" />Ajouter un frais</button>}</div>
        @if (!d().charges.length) {<p class="muted">Aucun frais. Le coût de revient est recalculé automatiquement à chaque ajout.</p>} @else {<div class="table-wrap"><table class="lines"><thead><tr><th>Type</th><th class="r">Montant</th><th class="r">Taux</th><th class="r">En devise de base</th><th>Répartition</th><th></th></tr></thead>
          <tbody>@for (c of d().charges; track c.id) {<tr><td>{{ chargeLabel(c.type) }}<br><span class="muted">{{ c.label }}</span></td><td class="r">{{ fmtForeign(c) }} {{ c.currency }}</td><td class="r">{{ c.exchangeRate }}</td><td class="r"><strong>{{ c.amountBaseMinor | money }}</strong></td><td>{{ c.allocation === 'value' ? 'Valeur' : 'Quantité' }}</td>
            <td>@if (d().chargesOpen && auth.has('imports:update')) {<button mat-icon-button (click)="charge(c)" aria-label="Modifier"><app-icon name="edit" /></button><button mat-icon-button (click)="removeCharge(c)" aria-label="Supprimer"><app-icon name="delete" /></button>}</td></tr>}</tbody></table></div>}</div>
      <div class="card" style="margin-top:16px"><div class="toolbar-row"><h3 style="margin:0">Documents d’importation</h3><span class="spacer"></span>@if (auth.has('imports:update') && d().status !== 'cancelled') {<button mat-stroked-button (click)="addDoc()"><app-icon name="note_add" />Ajouter un document</button>}</div>
        @if (!d().documents.length) {<p class="muted">Aucun document suivi (facture, connaissement, déclaration en douane…).</p>}
        @for (doc of d().documents; track doc.id) {<div class="doc"><span>{{ doc.name }} <small class="muted">({{ kindLabel(doc.kind) }})</small></span><span class="chip" [class.ok]="doc.status === 'received'">{{ doc.status === 'received' ? 'Reçu' : 'En attente' }}</span><span class="muted">{{ doc.fileName }}</span><span class="spacer"></span>
          @if (doc.hasFile) {<button mat-button (click)="download(doc)"><app-icon name="download" />Télécharger</button>}
          @if (auth.has('imports:update')) {<input #f type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.docx" (change)="upload(doc, f)" /><button mat-button (click)="f.click()"><app-icon name="upload_file" />{{ doc.hasFile ? 'Remplacer' : 'Joindre' }}</button>
            @if (!doc.hasFile) {<button mat-button (click)="toggleDoc(doc)">{{ doc.status === 'received' ? 'Marquer en attente' : 'Marquer reçu' }}</button>}}</div>}</div>
    }</div>`,
  styles: `h3{margin:0 0 12px;font-size:16px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:16px}.kpis .card{display:flex;flex-direction:column;gap:6px}.kpis strong{font-size:20px}
    .lines{width:100%;border-collapse:collapse;min-width:640px}.lines th,.lines td{padding:8px;border-bottom:1px solid var(--erp-border);text-align:left}.lines th{color:var(--muted);font-weight:500;font-size:13px}.r{text-align:right!important}.info{background:var(--brand-50);border-color:var(--brand-200);margin-bottom:12px}
    .doc{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--erp-border)}`,
})
export class ImportDetail {
  id = input.required<string>(); d = signal<any>(null);  
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); private dl = inject(DownloadService); private ref = inject(ReferenceDataService); auth = inject(AuthService);
  label = (s: string) => STATUS_LABELS[s] ?? s; chargeLabel = (t: string) => CHARGE_LABELS[t] ?? t; kindLabel = (k: string) => DOC_KINDS[k] ?? k;
  next = () => NEXT[this.d().status] ?? null; cancellable = () => ['draft', 'ordered', 'shipped', 'customs', 'arrived'].includes(this.d().status);
  fmtForeign = (c: { amountMinor: number; currency: string }) => this.ref.fromMinor(c.amountMinor, this.ref.decimalsOf(c.currency)).toLocaleString('fr-FR', { minimumFractionDigits: this.ref.decimalsOf(c.currency) });
  ngOnInit() { this.ref.load$().subscribe(); this.load(); }
  load() { this.api.get(`/imports/${this.id()}`).subscribe({ next: (f) => this.d.set(f), error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/imports']); } }); }
  private done(msg: string) { return { next: (f: unknown) => { this.d.set(f); this.toast.success(msg); }, error: (e: unknown) => this.toast.error(errorMessage(e)) }; }
  advance() { this.api.post(`/imports/${this.id()}/status`, { status: this.next() }).subscribe(this.done('Statut mis à jour')); }
  cancel() { prompt(this.dialog, { title: 'Annuler le dossier', label: 'Motif', confirmLabel: 'Annuler le dossier' }).subscribe((r) => r && this.api.post(`/imports/${this.id()}/status`, { status: 'cancelled', reason: r }).subscribe(this.done('Dossier annulé'))); }
  close() { confirm(this.dialog, { title: 'Clôturer le dossier', message: 'Les frais annexes seront figés et le coût de revient rendu deviendra définitif. Continuer ?', confirmLabel: 'Clôturer' }).subscribe((ok) => ok && this.api.post(`/imports/${this.id()}/close`).subscribe(this.done('Dossier clôturé'))); }
  integrate() { this.dialog.open(IntegrateDialog, { data: { fileId: this.id(), lines: this.d().lines } }).afterClosed().subscribe((f) => { if (f) { this.d.set(f); this.toast.success('Marchandises intégrées au stock au coût rendu'); } }); }
  charge(c?: unknown) { this.dialog.open(ChargeDialog, { data: { fileId: this.id(), currency: this.d().currency, charge: c } }).afterClosed().subscribe((f) => { if (f) { this.d.set(f); this.toast.success('Frais enregistré : coût de revient recalculé'); } }); }
  removeCharge(c: { id: string }) { confirm(this.dialog, { title: 'Supprimer le frais', message: 'Le coût de revient sera recalculé.', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete<unknown>(`/imports/${this.id()}/charges/${c.id}`).subscribe(this.done('Frais supprimé'))); }
  remove() { confirm(this.dialog, { title: 'Supprimer', message: 'Supprimer ce brouillon de dossier ?', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/imports/${this.id()}`).subscribe({ next: () => { this.toast.success('Supprimé'); this.router.navigate(['/imports']); }, error: (e) => this.toast.error(errorMessage(e)) })); }
  addDoc() { prompt(this.dialog, { title: 'Nouveau document à suivre', label: 'Intitulé (ex. Connaissement BL)', confirmLabel: 'Ajouter' }).subscribe((n) => n && this.api.post(`/imports/${this.id()}/documents`, { name: n, kind: 'other' }).subscribe(this.done('Document ajouté'))); }
  toggleDoc(doc: { id: string; status: string }) { this.api.patch(`/imports/${this.id()}/documents/${doc.id}`, { status: doc.status === 'received' ? 'pending' : 'received' }).subscribe(this.done('Statut du document mis à jour')); }
  upload(doc: { id: string }, input: HTMLInputElement) { const f = input.files?.[0]; if (!f) return; this.api.upload(`/imports/${this.id()}/documents/${doc.id}/file`, f).subscribe({ ...this.done('Fichier enregistré'), error: (e) => { this.toast.error(errorMessage(e)); input.value = ''; } }); }
  download(doc: { id: string; fileName: string }) { this.dl.save(`/imports/${this.id()}/documents/${doc.id}/file`, {}, doc.fileName).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
}
void MatDialogModule;
