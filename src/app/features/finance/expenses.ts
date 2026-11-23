import { DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../core/services/api.service';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { DownloadService } from '../../core/services/download.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { EmptyState } from '../../shared/components/empty-state';
import { PageHeader } from '../../shared/components/page-header';
import { RowAction, RowActions } from '../../shared/components/row-actions';
import { prompt } from '../../shared/components/prompt-dialog';
import { Skeleton } from '../../shared/components/skeleton';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { METHODS } from './finance-dialogs';

export const EXPENSE_STATUS: Record<string, string> = { draft: 'Brouillon', submitted: 'Soumise', validated: 'Validée', rejected: 'Rejetée', cancelled: 'Annulée' };
const css = `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 16px}.kv{padding:6px 0}.kv .k{color:var(--erp-muted,var(--muted));font-size:13px}h3{margin:0 0 12px;font-size:16px}.warn{border-color:var(--danger-200)}.r{text-align:right}`;

/** Saisie / modification d'une dépense (brouillon ou rejetée). */
@Component({
  selector: 'app-expense-form',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, Icon, MatInputModule, MatSelectModule, PageHeader],
  template: `<div class="page"><app-page-header [title]="id() ? 'Modifier la dépense' : 'Nouvelle dépense'" subtitle="Une dépense validée n’est plus modifiable : elle ne peut qu’être annulée (mouvement inverse)."><a mat-stroked-button routerLink="/expenses"><app-icon name="arrow_back" />Retour</a></app-page-header>
    <form [formGroup]="form" class="card grid">
      @if (error()) {<div style="color:var(--danger);grid-column:1/-1" role="alert">{{ error() }}</div>}
      <mat-form-field appearance="outline"><mat-label>Catégorie</mat-label><mat-select formControlName="categoryId">@for (c of cats(); track c.id) {<mat-option [value]="c.id">{{ c.name }}</mat-option>}</mat-select>@if (form.controls.categoryId.invalid && form.controls.categoryId.touched) {<mat-error>Requise</mat-error>}</mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Montant ({{ ref.symbol() }})</mat-label><input matInput type="number" min="0" [step]="1 / 10 ** ref.decimals()" formControlName="amount" />@if (form.controls.amount.invalid && form.controls.amount.touched) {<mat-error>Montant positif requis</mat-error>}</mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" [max]="today" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Bénéficiaire</mat-label><input matInput formControlName="beneficiary" />@if (form.controls.beneficiary.invalid && form.controls.beneficiary.touched) {<mat-error>Requis</mat-error>}</mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Mode de paiement</mat-label><mat-select formControlName="method">@for (m of methods; track m.key) {<mat-option [value]="m.key">{{ m.label }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Compte de trésorerie</mat-label><mat-select formControlName="account"><mat-option value="">— à préciser avant validation —</mat-option>@for (a of accounts(); track a.id) {<mat-option [value]="a.id">{{ a.name }}</mat-option>}</mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Référence (n° de facture, reçu…)</mat-label><input matInput formControlName="reference" /></mat-form-field>
      <mat-form-field appearance="outline" style="grid-column:1/-1"><mat-label>Description</mat-label><textarea matInput rows="3" formControlName="description"></textarea></mat-form-field>
      <div style="grid-column:1/-1;display:flex;gap:8px"><button mat-flat-button color="primary" type="button" [disabled]="loading()" (click)="save()">Enregistrer</button><a mat-button routerLink="/expenses">Annuler</a></div>
      <p class="muted" style="grid-column:1/-1">Les justificatifs (PDF, PNG, JPG) s’ajoutent depuis la fiche de la dépense, une fois enregistrée.</p></form></div>`,
  styles: css,
})
export class ExpenseForm {
  id = input<string>(); private api = inject(Api); private router = inject(Router); private toast = inject(ToastService); ref = inject(ReferenceDataService); methods = METHODS;
  cats = signal<any[]>([]); accounts = signal<any[]>([]); error = signal(''); loading = signal(false); today = new Date().toISOString().slice(0, 10);  
  form = new FormBuilder().nonNullable.group({ categoryId: ['', Validators.required], amount: [0, [Validators.required, Validators.min(1 / 10 ** this.ref.decimals())]], date: [this.today, Validators.required], beneficiary: ['', [Validators.required, Validators.minLength(2)]], method: ['cash'], account: [''], reference: [''], description: [''] });
  ngOnInit() {
    this.api.get('/expense-categories').subscribe((c) => this.cats.set(c.filter((x: { isActive: boolean }) => x.isActive))); this.api.get('/treasury/accounts', { active: true }).subscribe({ next: (a) => this.accounts.set(a), error: () => undefined });
    if (this.id()) this.api.get(`/expenses/${this.id()}`).subscribe((e) => this.form.patchValue({ categoryId: e.categoryId, amount: this.ref.fromMinor(e.amountMinor), date: e.date.slice(0, 10), beneficiary: e.beneficiary, method: e.method, account: e.treasuryAccountId ?? '', reference: e.reference ?? '', description: e.description ?? '' }));
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; } const v = this.form.getRawValue(); this.loading.set(true);
    const body = { categoryId: v.categoryId, amountMinor: this.ref.toMinor(Number(v.amount)), date: v.date, beneficiary: v.beneficiary, method: v.method, ...(v.account && { treasuryAccountId: v.account }), ...(v.reference && { reference: v.reference }), ...(v.description && { description: v.description }) };
    (this.id() ? this.api.put(`/expenses/${this.id()}`, body) : this.api.post('/expenses', body)).subscribe({ next: (e) => { this.toast.success(`Dépense ${e.number} enregistrée`); this.router.navigate(['/expenses', e.id]); }, error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); } });
  }
}

/** Fiche dépense : workflow (soumission, validation, rejet, annulation), justificatifs, traçabilité comptable. */
@Component({
  selector: 'app-expense-detail',
  imports: [DatePipe, RouterLink, MatButtonModule, Icon, PageHeader, Skeleton, MoneyPipe],
  template: `<div class="page">@if (!d()) {<div class="card"><app-skeleton /></div>} @else {
    <app-page-header [title]="'Dépense ' + d().number" [subtitle]="d().beneficiary">
      <a mat-stroked-button routerLink="/expenses"><app-icon name="arrow_back" />Liste</a>
      @if (d().editable && auth.has('expenses:update')) {<a mat-stroked-button routerLink="edit"><app-icon name="edit" />Modifier</a>}
      @if (d().status === 'draft' && auth.has('expenses:delete')) {<button mat-stroked-button color="warn" (click)="remove()"><app-icon name="delete" />Supprimer</button>}
      @if (d().status === 'draft' && auth.has('expenses:update')) {<button mat-flat-button color="primary" (click)="submit()"><app-icon name="send" />Soumettre</button>}
      @if (d().status === 'submitted' && auth.has('expenses:validate')) {<button mat-stroked-button color="warn" (click)="reject()"><app-icon name="thumb_down" />Rejeter</button><button mat-flat-button color="primary" (click)="validate()"><app-icon name="verified" />Valider</button>}
      @if (d().status === 'validated' && auth.has('expenses:validate')) {<button mat-stroked-button color="warn" (click)="cancel()"><app-icon name="undo" />Annuler la dépense</button>}</app-page-header>
    <div style="margin-bottom:12px"><span class="chip" [class.ok]="d().status === 'validated'" [class.off]="d().status === 'cancelled' || d().status === 'rejected'">{{ label(d().status) }}</span></div>
    @if (d().status === 'rejected') {<div class="card warn" style="margin-bottom:12px"><strong>Rejetée :</strong> {{ d().rejectReason }}</div>}
    @if (d().status === 'cancelled') {<div class="card warn" style="margin-bottom:12px"><strong>Annulée :</strong> {{ d().cancelReason }} — un mouvement de trésorerie inverse a été créé.</div>}
    @if (d().status === 'validated') {<div class="card" style="margin-bottom:12px"><app-icon style="vertical-align:middle" name="lock" /> Validée le {{ d().validatedAt | date: 'dd/MM/yyyy HH:mm' }} : non modifiable. Mouvement de trésorerie et écriture comptable générés (<a routerLink="/accounting">Comptabilité</a>).</div>}
    <div class="card grid"><div class="kv"><div class="k">Catégorie</div>{{ d().categoryName }}</div><div class="kv"><div class="k">Montant</div><strong>{{ d().amountMinor | money }}</strong></div><div class="kv"><div class="k">Date</div>{{ d().date | date: 'dd/MM/yyyy' : 'UTC' }}</div>
      <div class="kv"><div class="k">Mode de paiement</div>{{ method(d().method) }}</div><div class="kv"><div class="k">Compte de trésorerie</div>{{ accountName() }}</div><div class="kv"><div class="k">Référence</div>{{ d().reference || '—' }}</div>
      <div class="kv" style="grid-column:1/-1"><div class="k">Description</div>{{ d().description || '—' }}</div></div>
    <div class="card" style="margin-top:12px"><h3>Justificatifs</h3>
      @if (!d().attachments.length) {<p class="muted">Aucun justificatif.</p>}
      @for (a of d().attachments; track a.id) {<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><app-icon name="attach_file" /><a href="javascript:void(0)" (click)="download(a)">{{ a.name }}</a><span class="muted">{{ (a.size / 1024).toFixed(0) }} Ko</span>
        @if (['draft', 'rejected', 'submitted'].includes(d().status) && auth.has('expenses:update')) {<button mat-icon-button (click)="removeAtt(a)" aria-label="Retirer"><app-icon name="close" /></button>}</div>}
      @if (['draft', 'rejected', 'submitted'].includes(d().status) && auth.has('expenses:update')) {<input #f type="file" accept=".pdf,.png,.jpg,.jpeg" hidden (change)="upload($any($event.target).files[0]); f.value = ''" /><button mat-stroked-button (click)="f.click()"><app-icon name="upload" />Ajouter un justificatif</button><span class="muted" style="margin-left:8px">PDF, PNG ou JPG — 5 Mo max</span>}</div>}</div>`,
  styles: css,
})
export class ExpenseDetail {
  id = input.required<string>(); d = signal<any>(null); accounts = signal<any[]>([]);  
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); private router = inject(Router); private dl = inject(DownloadService); auth = inject(AuthService);
  label = (s: string) => EXPENSE_STATUS[s] ?? s; method = (m: string) => METHODS.find((x) => x.key === m)?.label ?? m; accountName = () => this.accounts().find((a) => a.id === this.d()?.treasuryAccountId)?.name ?? '— non précisé —';
  ngOnInit() { this.load(); this.api.get('/treasury/accounts').subscribe({ next: (a) => this.accounts.set(a), error: () => undefined }); }
  load() { this.api.get(`/expenses/${this.id()}`).subscribe({ next: (r) => this.d.set(r), error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/expenses']); } }); }
  private act(path: string, body: object, ok: string) { this.api.post(`/expenses/${this.id()}/${path}`, body).subscribe({ next: (r) => { this.d.set(r); this.toast.success(ok); }, error: (e) => { this.toast.error(errorMessage(e)); this.load(); } }); }
  submit() { this.act('submit', {}, 'Dépense soumise pour validation'); }
  validate() { confirm(this.dialog, { title: 'Valider la dépense', message: 'Le montant sort du compte de trésorerie et l’écriture comptable est générée. La dépense ne sera plus modifiable.', confirmLabel: 'Valider' }).subscribe((ok) => ok && this.act('validate', {}, 'Dépense validée')); }
  reject() { prompt(this.dialog, { title: 'Rejeter la dépense', label: 'Motif du rejet', confirmLabel: 'Rejeter' }).subscribe((reason) => reason && this.act('reject', { reason }, 'Dépense rejetée')); }
  cancel() { prompt(this.dialog, { title: 'Annuler la dépense validée', label: 'Motif de l’annulation', confirmLabel: 'Annuler la dépense' }).subscribe((reason) => reason && this.act('cancel', { reason }, 'Dépense annulée (mouvement inverse créé)')); }
  remove() { confirm(this.dialog, { title: 'Supprimer', message: 'Supprimer ce brouillon ?', confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/expenses/${this.id()}`).subscribe({ next: () => { this.toast.success('Supprimée'); this.router.navigate(['/expenses']); }, error: (e) => this.toast.error(errorMessage(e)) })); }
  upload(file?: File) { if (!file) return; this.api.upload(`/expenses/${this.id()}/attachments`, file).subscribe({ next: (r) => { this.d.set(r); this.toast.success('Justificatif ajouté'); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  removeAtt(a: { id: string }) { this.api.delete<any>(`/expenses/${this.id()}/attachments/${a.id}`).subscribe({ next: (r) => { this.d.set(r); this.toast.success('Justificatif retiré'); }, error: (e) => this.toast.error(errorMessage(e)) }); }  
  download(a: { id: string; name: string }) { this.dl.save(`/expenses/${this.id()}/attachments/${a.id}`, {}, a.name).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
}

/** Catégories de dépenses (avec code comptable facultatif) et synthèse par catégorie / mois. */
@Component({
  selector: 'app-expense-categories',
  imports: [ReactiveFormsModule, RouterLink, RowActions, MatTableModule, MatButtonModule, Icon, MatFormFieldModule, MatInputModule, PageHeader, EmptyState, MoneyPipe],
  template: `<div class="page"><app-page-header title="Catégories et synthèse des dépenses" subtitle="Le code comptable de la catégorie est repris dans l’écriture de la dépense validée"><a mat-stroked-button routerLink="/expenses"><app-icon name="arrow_back" />Dépenses</a></app-page-header>
    @if (auth.has('expenses:create')) {<form [formGroup]="form" class="card" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;margin-bottom:16px">
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Nouvelle catégorie</mat-label><input matInput formControlName="name" (keydown.enter)="$event.preventDefault(); add()" /></mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Code comptable (facultatif)</mat-label><input matInput formControlName="accountCode" /></mat-form-field>
      <button mat-flat-button color="primary" type="button" style="height:56px" (click)="add()"><app-icon name="add" />Ajouter</button></form>}
    <div class="card">@if (!cats().length) {<app-empty-state icon="category" message="Aucune catégorie de dépenses." />} @else {<div class="table-wrap"><table mat-table [dataSource]="cats()">
      <ng-container matColumnDef="n"><th mat-header-cell *matHeaderCellDef>Catégorie</th><td mat-cell *matCellDef="let c">{{ c.name }}</td></ng-container>
      <ng-container matColumnDef="c"><th mat-header-cell *matHeaderCellDef>Code comptable</th><td mat-cell *matCellDef="let c">{{ c.accountCode || '—' }}</td></ng-container>
      <ng-container matColumnDef="s"><th mat-header-cell *matHeaderCellDef>Statut</th><td mat-cell *matCellDef="let c"><span class="chip" [class.ok]="c.isActive" [class.off]="!c.isActive">{{ c.isActive ? 'Active' : 'Inactive' }}</span></td></ng-container>
      <ng-container matColumnDef="x"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let c" class="r"><app-row-actions [actions]="acts(c)" /></td></ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let r; columns: cols"></tr></table></div>}</div>
    <h3 style="margin:20px 0 8px">Synthèse des dépenses validées</h3>
    <div class="card">@if (sum()) {<p>Total : <strong>{{ sum().totalMinor | money }}</strong> ({{ sum().count }} dépense(s))</p>
      @if (sum().byCategory.length) {<div class="table-wrap"><table class="lines" style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Catégorie</th><th class="r">Nombre</th><th class="r">Montant</th></tr></thead><tbody>@for (c of sum().byCategory; track c.categoryId) {<tr><td>{{ c.categoryName }}</td><td class="r">{{ c.count }}</td><td class="r">{{ c.totalMinor | money }}</td></tr>}</tbody></table></div>
      <div class="table-wrap" style="margin-top:12px"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Mois</th><th class="r">Nombre</th><th class="r">Montant</th></tr></thead><tbody>@for (m of sum().byMonth; track m.month) {<tr><td>{{ m.month }}</td><td class="r">{{ m.count }}</td><td class="r">{{ m.totalMinor | money }}</td></tr>}</tbody></table></div>} @else {<p class="muted">Aucune dépense validée.</p>}}</div></div>`,
  styles: css,
})
export class ExpenseCategories {
  private api = inject(Api); private toast = inject(ToastService); private dialog = inject(MatDialog); auth = inject(AuthService);
  cols = ['n', 'c', 's', 'x']; cats = signal<any[]>([]); sum = signal<any>(null); form = new FormBuilder().nonNullable.group({ name: ['', [Validators.required, Validators.minLength(2)]], accountCode: [''] });  
  ngOnInit() { this.load(); }
  load() { this.api.get('/expense-categories').subscribe((c) => this.cats.set(c)); this.api.get('/expenses/summary').subscribe((s) => this.sum.set(s)); }
  acts = (c: { isActive: boolean; id: string; name: string; accountCode: string | null }): RowAction[] => [{ label: c.isActive ? 'Désactiver' : 'Activer', icon: c.isActive ? 'block' : 'check_circle', run: () => this.toggle(c), hidden: !this.auth.has('expenses:update') },
    { label: 'Supprimer', icon: 'delete', danger: true, run: () => this.remove(c), hidden: !this.auth.has('expenses:delete') }];
  add() { if (this.form.invalid) { this.form.markAllAsTouched(); return; } const v = this.form.getRawValue(); this.api.post('/expense-categories', { name: v.name, ...(v.accountCode && { accountCode: v.accountCode }) }).subscribe({ next: () => { this.form.reset(); this.toast.success('Catégorie ajoutée'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) }); }
  toggle(c: { id: string; name: string; accountCode: string | null; isActive: boolean }) { this.api.put(`/expense-categories/${c.id}`, { name: c.name, ...(c.accountCode && { accountCode: c.accountCode }), isActive: !c.isActive }).subscribe({ next: () => this.load(), error: (e) => this.toast.error(errorMessage(e)) }); }
  remove(c: { id: string; name: string }) { confirm(this.dialog, { title: 'Supprimer la catégorie', message: `Supprimer « ${c.name} » ? Impossible si des dépenses l’utilisent.`, confirmLabel: 'Supprimer', danger: true }).subscribe((ok) => ok && this.api.delete(`/expense-categories/${c.id}`).subscribe({ next: () => { this.toast.success('Supprimée'); this.load(); }, error: (e) => this.toast.error(errorMessage(e)) })); }
}
