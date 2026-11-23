import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { Skeleton } from '../../shared/components/skeleton';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { FiscalService } from '../fiscal/fiscal.service';
import { CalcPreview, DOC_CONFIG, DocConfig, DocKind, PAYMENT_METHOD_LABELS, SalesDoc, SourceLines } from './sales.models';
import { SalesService } from './sales.service';

const iso = (d?: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

@Component({
  selector: 'app-doc-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, Icon, MatAutocompleteModule, PageHeader, Skeleton, MoneyPipe],
  template: `
    <div class="page">
      <app-page-header [title]="(id() ? 'Modifier ' + (cfg().gender === 'f' ? 'la ' : 'le ') : cfg().gender === 'f' ? 'Nouvelle ' : 'Nouveau ') + cfg().singular" [subtitle]="subtitle()" />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card err" role="alert">{{ error() }}</div>}
        <div class="card sec" formGroupName="header"><h3>Client et dates</h3>
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>Client</mat-label>
              <input matInput [formControl]="customerCtrl" [matAutocomplete]="ca" [readonly]="!!srcMode() || lockedCustomer()" placeholder="Rechercher un client…" />
              <mat-autocomplete #ca="matAutocomplete" [displayWith]="customerName" (optionSelected)="pickCustomer($event.option.value)">@for (c of customerOptions(); track c.id) {<mat-option [value]="c">{{ c.name }} <small class="muted">{{ c.taxId }}</small></mat-option>}</mat-autocomplete>
              @if (customerCtrl.touched && !customerId()) {<mat-error>Sélectionnez un client dans la liste</mat-error>}</mat-form-field>
            @if (kind() !== 'delivery-notes') {<mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" formControlName="issueDate" /></mat-form-field>}
            @if (kind() === 'delivery-notes') {<mat-form-field appearance="outline"><mat-label>Date de livraison</mat-label><input matInput type="date" formControlName="deliveryDate" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Transporteur</mat-label><input matInput formControlName="carrier" /></mat-form-field>}
            @if (cfg().hasValidity) {<mat-form-field appearance="outline"><mat-label>Valable jusqu’au</mat-label><input matInput type="date" formControlName="validUntil" /></mat-form-field>}
            @if (kind() === 'invoices') {<mat-form-field appearance="outline"><mat-label>Mode de règlement</mat-label><mat-select formControlName="paymentMethod"><mat-option value="">—</mat-option>@for (m of methods; track m.key) {<mat-option [value]="m.key">{{ m.label }}</mat-option>}</mat-select></mat-form-field>}
          </div>
        </div>

        @if (srcMode(); as sm) {
          <div class="card sec"><h3>Lignes à livrer — {{ sm.sourceNumber }}</h3>
            <div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Commandé</th><th class="r">Déjà livré</th><th class="r">Reste</th><th class="r">À livrer</th><th>N° de série</th></tr></thead>
              <tbody>@for (l of sm.lines; track l.sourceLineId; let i = $index) {<tr><td>{{ l.designation }}</td><td class="r">{{ l.quantity }}</td><td class="r">{{ l.deliveredQty }}</td><td class="r">{{ l.remainingQty }}</td>
                <td class="r"><input class="q" type="number" min="0" [max]="l.remainingQty" step="0.001" [formControl]="srcQty.at(i)" [attr.aria-label]="'Quantité à livrer ' + l.designation" /></td>
                <td>@if (l.hasSerial) {<textarea rows="2" [formControl]="srcSerials.at(i)" placeholder="un numéro par ligne" [attr.aria-label]="'Numéros de série ' + l.designation"></textarea>}</td></tr>}</tbody></table></div>
            <p class="muted">Quantité partielle autorisée : le reste pourra être livré par un autre bon de livraison.</p>
          </div>
        } @else {
          <div class="card sec"><h3>Lignes</h3>
            <div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. HT ({{ ref.symbol() }})</th><th class="r">Rem. %</th><th>TVA</th><th class="r">Total HT</th><th></th></tr></thead>
              <tbody formArrayName="lines">
                @if (!lines.length) {<tr><td colspan="7" class="muted">Aucune ligne : ajoutez un article du catalogue ou une ligne libre.</td></tr>}@for (g of lines.controls; track $index; let i = $index) {
                <tr [formGroupName]="i">
                  <td><input class="w" formControlName="designation" placeholder="Désignation" aria-label="Désignation" />@if (g.controls.reference.value) {<small class="muted">{{ g.controls.reference.value }}</small>}</td>
                  <td class="r"><input class="q" type="number" min="0.001" step="0.001" formControlName="quantity" aria-label="Quantité" /></td>
                  <td class="r"><input class="p" type="number" min="0" [step]="1 / 10 ** ref.decimals()" formControlName="unitPrice" aria-label="Prix unitaire" /></td>
                  <td class="r"><input class="d" type="number" min="0" max="100" step="0.01" formControlName="discountPct" aria-label="Remise %" /></td>
                  <td><select formControlName="vatCode" aria-label="Code TVA"><option value="">—</option>@for (v of ref.vatRates(); track v.code) {<option [value]="v.code">{{ v.code }} ({{ vatText(v) }})</option>}</select></td>
                  <td class="r">{{ preview()?.lines?.[i]?.netHtMinor | money }}</td>
                  <td><button mat-icon-button type="button" (click)="lines.removeAt(i)" aria-label="Retirer la ligne"><app-icon name="delete" /></button></td>
                </tr>}</tbody></table></div>
            <div class="add">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" style="flex:1;min-width:260px"><mat-label>Ajouter un article du catalogue</mat-label><app-icon matPrefix name="search" />
                <input matInput [formControl]="productCtrl" [matAutocomplete]="pa" placeholder="Référence ou désignation" />
                <mat-autocomplete #pa="matAutocomplete" (optionSelected)="addProduct($event.option.value)">@for (p of productOptions(); track p.id) {<mat-option [value]="p">{{ p.reference }} — {{ p.name }} <small class="muted">{{ p.salePriceMinor | money }}</small></mat-option>}</mat-autocomplete></mat-form-field>
              <button mat-stroked-button type="button" (click)="addFree()"><app-icon name="add" />Ligne libre</button>
            </div>
            @if (!ref.vatRates().length) {<p class="err-t">Aucune règle de TVA validée : configurez-les dans <a routerLink="/fiscal">Fiscalité</a>.</p>}
          </div>
          @if (kind() === 'invoices') {
            <div class="card sec"><h3>Échéancier de paiement</h3><p class="muted">Sans échéancier : une échéance unique à la date de facture + délai de paiement du client. Total des pourcentages = 100.</p>
              <div formArrayName="schedule">@for (s of schedule.controls; track $index; let i = $index) {<div class="row" [formGroupName]="i">
                <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Échéance</mat-label><input matInput type="date" formControlName="dueDate" /></mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:140px"><mat-label>% du total</mat-label><input matInput type="number" min="0" max="100" step="0.01" formControlName="percent" /></mat-form-field>
                <button mat-icon-button type="button" (click)="schedule.removeAt(i)" aria-label="Retirer l’échéance"><app-icon name="delete" /></button></div>}</div>
              <button mat-stroked-button type="button" (click)="addInstallment()"><app-icon name="add" />Ajouter une échéance</button></div>
          }
        }

        <div class="bottom">
          <div class="card sec" style="flex:1;min-width:280px" formGroupName="header"><h3>Remises, conditions et notes</h3>
            @if (!srcMode() && kind() !== 'delivery-notes') {<div class="row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:150px"><mat-label>Remise globale</mat-label><mat-select formControlName="discountMode"><mat-option value="pct">En %</mat-option><mat-option value="amount">En montant</mat-option></mat-select></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:160px"><mat-label>{{ form.controls.header.controls.discountMode.value === 'pct' ? '%' : ref.symbol() }}</mat-label><input matInput type="number" min="0" step="0.01" formControlName="discount" /></mat-form-field></div>}
            @if (kind() === 'invoices' && withholdingTypes().length) {<mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Retenue à la source — type d’opération</mat-label>
              <mat-select formControlName="withholdingOperationType"><mat-option value="">Aucune retenue</mat-option>@for (w of withholdingTypes(); track w.code) {<mat-option [value]="w.code">{{ w.code }} — {{ w.ratePct }} % sur {{ w.base === 'ttc' ? 'TTC' : 'HT' }}</mat-option>}</mat-select>
              <mat-hint>Appliquée seulement si les conditions de la règle sont remplies (client assujetti, seuil).</mat-hint></mat-form-field>}
            @if (cfg().hasValidity) {<mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Conditions</mat-label><textarea matInput rows="2" formControlName="terms"></textarea></mat-form-field>}
            <mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
          </div>
          @if (!srcMode()) {
            <div class="card sec totals" style="width:380px;max-width:100%"><h3>Totaux <small class="muted">(calculés par le serveur)</small></h3>
              @if (calcError()) {<p class="err-t">{{ calcError() }}</p>}
              @if (preview(); as p) {
                <div><span>Total brut</span><span>{{ p.totals.grossMinor | money }}</span></div>
                @if (p.totals.lineDiscountsMinor + p.totals.globalDiscountMinor > 0) {<div><span>Remises</span><span>- {{ p.totals.lineDiscountsMinor + p.totals.globalDiscountMinor | money }}</span></div>}
                <div class="b"><span>Total HT</span><span>{{ p.totals.totalHtMinor | money }}</span></div>
                @for (g of p.totals.vatGroups; track g.vatCode) {<div class="s"><span>{{ g.regime === 'taxable' ? 'TVA ' + g.ratePct + ' %' : g.vatCode + ' (' + vatText(g) + ')' }} — base {{ g.baseMinor | money }}</span><span>{{ g.vatMinor | money }}</span></div>}
                <div><span>Total TVA</span><span>{{ p.totals.totalVatMinor | money }}</span></div>
                <div class="b"><span>Total TTC</span><span>{{ p.totals.totalTtcMinor | money }}</span></div>
                @if (p.stamp) {<div><span>Timbre fiscal ({{ p.stamp.code }})</span><span>{{ p.totals.stampMinor | money }}</span></div>}
                @if (p.withholding) {<div><span>Retenue à la source ({{ p.withholding.ratePct }} %)</span><span>- {{ p.totals.withholdingMinor | money }}</span></div>}
                @if (p.stamp || p.withholding) {<div class="b"><span>Net à payer</span><span>{{ p.totals.totalPayableMinor | money }}</span></div>}
              } @else {<p class="muted">Ajoutez un client et au moins une ligne complète pour voir les totaux.</p>}
            </div>}
        </div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button [routerLink]="id() ? [cfg().route, id()] : [cfg().route]">Annuler</a>
          <button mat-flat-button color="primary" [disabled]="saving()">{{ kind() === 'invoices' ? 'Enregistrer le brouillon' : 'Enregistrer' }}</button></div>
      </form>}
    </div>`,
  styles: `.sec{margin-bottom:16px}h3{margin:0 0 12px;font-size:16px}.err{color:var(--danger);margin-bottom:16px}.err-t{color:var(--danger)}
    .lines{width:100%;border-collapse:collapse;min-width:720px}.lines th,.lines td{padding:6px 8px;border-bottom:1px solid var(--erp-border);text-align:left;vertical-align:middle}.lines th{color:var(--muted);font-weight:500;font-size:13px}.r{text-align:right!important}
    .lines textarea{font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px 8px;width:100%;min-width:180px}
    .lines input,.lines select{font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px 8px;background:#fff}.w{width:100%;min-width:200px}.q{width:80px;text-align:right}.p{width:110px;text-align:right}.d{width:70px;text-align:right}
    .add{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px}.bottom{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
    .totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.totals .b{font-weight:600;border-top:1px solid var(--erp-border);margin-top:4px;padding-top:6px}.totals .s{font-size:13px;color:var(--muted)}`,
})
export class DocForm {
  kind = input.required<DocKind>();
  id = input<string>();
  /** Livraison : préremplissage depuis un document source (?sourceType=quotation&sourceId=…) ; facture : ?customerId= */
  sourceType = input<string>(); sourceId = input<string>(); customerIdParam = input<string | undefined>(undefined, { alias: 'customerId' });
  cfg = computed<DocConfig>(() => DOC_CONFIG[this.kind()]);
  private fb = inject(FormBuilder); private svc = inject(SalesService); private router = inject(Router); private toast = inject(ToastService); private destroy = inject(DestroyRef); private fiscal = inject(FiscalService);
  ref = inject(ReferenceDataService);
  methods = Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => ({ key, label }));

  customerCtrl = new FormControl<string | { id: string; name: string }>('', { nonNullable: true });
  customerId = signal(''); lockedCustomer = signal(false);
  customerOptions = signal<{ id: string; name: string; taxId: string | null; paymentDelayDays: number }[]>([]);
  productCtrl = new FormControl('', { nonNullable: true }); productOptions = signal<{ id: string; reference: string; name: string; salePriceMinor: number; vatRateCode: string; unitCode: string | null }[]>([]);
  withholdingTypes = signal<{ code: string; ratePct: number; base: string }[]>([]);

  lines = this.fb.array<ReturnType<DocForm['lineGroup']>>([]);
  schedule = this.fb.array<ReturnType<DocForm['installment']>>([]);
  srcQty = this.fb.array<FormControl<number>>([]); srcSerials = this.fb.array<FormControl<string>>([]);
  header = this.fb.nonNullable.group({
    issueDate: [iso(new Date())], validUntil: [addDays(30)], deliveryDate: [iso(new Date())], carrier: [''], paymentMethod: [''], withholdingOperationType: [''],
    discountMode: ['pct' as 'pct' | 'amount'], discount: [0], notes: [''], terms: [''],
  });
  form = this.fb.group({ header: this.header, lines: this.lines, schedule: this.schedule, srcQty: this.srcQty, srcSerials: this.srcSerials });
  srcMode = signal<SourceLines | null>(null);
  srcRef: { type: string; id: string } | null = null;
  preview = signal<CalcPreview | null>(null); calcError = signal('');
  loading = signal(false); saving = signal(false); error = signal('');

  subtitle = () => this.kind() === 'delivery-notes' ? 'Livraison totale ou partielle ; la validation décrémente le stock (module Stock, phase suivante).' : 'Les montants sont calculés par le serveur avec les règles fiscales validées.';
  customerName = (c: { name: string } | string | null) => (typeof c === 'string' ? c : c?.name ?? '');
  vatText = (v: { regime: string; ratePct?: number }) => (v.regime === 'taxable' ? `${v.ratePct} %` : ({ zero: '0 %', exempt: 'exonéré', suspended: 'suspension' } as Record<string, string>)[v.regime]);

  lineGroup(l?: { productId?: string | null; reference?: string | null; designation?: string; description?: string | null; unit?: string | null; quantity?: number; unitPriceMinor?: number; discountPct?: number; vatCode?: string }) {
    return this.fb.nonNullable.group({
      productId: [l?.productId ?? ''], reference: [l?.reference ?? ''], designation: [l?.designation ?? '', Validators.required], description: [l?.description ?? ''], unit: [l?.unit ?? ''],
      quantity: [l?.quantity ?? 1, [Validators.required, Validators.min(0.001)]], unitPrice: [l?.unitPriceMinor != null ? this.ref.fromMinor(l.unitPriceMinor) : 0, [Validators.required, Validators.min(0)]],
      discountPct: [l?.discountPct ?? 0, [Validators.min(0), Validators.max(100)]], vatCode: [l?.vatCode ?? '', Validators.required],
    });
  }
  installment(i?: { dueDate?: string; percent?: number | null }) { return this.fb.nonNullable.group({ dueDate: [iso(i?.dueDate) || addDays(30), Validators.required], percent: [i?.percent ?? 100, [Validators.required, Validators.min(0.01), Validators.max(100)]] }); }
  addFree() { this.lines.push(this.lineGroup()); }
  addInstallment() { this.schedule.push(this.installment({ percent: Math.max(0, 100 - this.schedule.controls.reduce((s, g) => s + Number(g.controls.percent.value || 0), 0)) || 100 })); }
  addProduct(p: { id: string; reference: string; name: string; salePriceMinor: number; vatRateCode: string; unitCode: string | null }) {
    // retire une ligne libre restée vide avant d'ajouter l'article
    for (let i = this.lines.length - 1; i >= 0; i--) { const g = this.lines.at(i).controls; if (!g.designation.value && !g.vatCode.value && !g.productId.value) this.lines.removeAt(i); }
    this.lines.push(this.lineGroup({ productId: p.id, reference: p.reference, designation: p.name, unit: p.unitCode, unitPriceMinor: p.salePriceMinor, vatCode: p.vatRateCode }));
    this.productCtrl.setValue('');
  }
  pickCustomer(c: { id: string; paymentDelayDays: number }) { this.customerId.set(c.id); this.form.updateValueAndValidity(); }

  ngOnInit() {
    this.ref.load$().subscribe();
    this.customerCtrl.valueChanges.pipe(debounceTime(250), distinctUntilChanged(), switchMap((v) => { if (typeof v !== 'string') return of(null); this.customerId.set(''); return v.length >= 1 ? this.svc.customers(v) : of(null); }), takeUntilDestroyed(this.destroy)).subscribe((r) => { if (r) this.customerOptions.set(r.items); });
    this.productCtrl.valueChanges.pipe(debounceTime(250), switchMap((v) => (v.length >= 1 ? this.svc.products(v) : of(null))), takeUntilDestroyed(this.destroy)).subscribe((r) => { if (r) this.productOptions.set(r.items); });
    this.form.valueChanges.pipe(debounceTime(400), takeUntilDestroyed(this.destroy)).subscribe(() => this.recalc());
    if (this.kind() === 'invoices') this.fiscal.withholdingTypes().subscribe((w) => this.withholdingTypes.set(w));
    const id = this.id();
    if (id) this.loadExisting(id);
    else if (this.kind() === 'delivery-notes' && this.sourceType() && this.sourceId()) this.loadSource(this.sourceType()!, this.sourceId()!);
    else this.preselectCustomer();
  }
  private preselectCustomer() {
    const c = this.customerIdParam(); if (!c) return;
    this.svc.customer(c).subscribe((x) => { this.customerCtrl.setValue(x, { emitEvent: false }); this.customerId.set(x.id); });
  }

  private loadSource(type: string, sourceId: string) {
    this.loading.set(true);
    this.svc.sourceLines(type, sourceId).subscribe({
      next: (s) => { this.applySource(s, type, sourceId); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/delivery-notes'); },
    });
  }
  private applySource(s: SourceLines, type: string, id: string, current?: Record<string, number>) {
    this.srcMode.set(s); this.srcRef = { type, id }; this.srcQty.clear(); this.srcSerials.clear();
    s.lines.forEach((l) => { this.srcQty.push(new FormControl(current ? current[l.sourceLineId] ?? 0 : l.remainingQty, { nonNullable: true })); this.srcSerials.push(new FormControl('', { nonNullable: true })); });
    this.customerId.set(s.customerId); this.lines.clear();
    this.svc.customer(s.customerId).subscribe((c) => this.customerCtrl.setValue({ id: s.customerId, name: c.name }, { emitEvent: false }));
  }

  private loadExisting(id: string) {
    this.loading.set(true);
    this.svc.get(this.kind(), id).subscribe({
      next: (d: SalesDoc) => {
        if (d.editable === false) { this.toast.error('Ce document n’est plus modifiable.'); this.router.navigate([this.cfg().route, id]); return; }
        this.customerCtrl.setValue({ id: d.customerId, name: d.customer.name }, { emitEvent: false }); this.customerId.set(d.customerId); this.lockedCustomer.set(false);
        this.header.patchValue({ issueDate: iso(d.issueDate), validUntil: iso(d.validUntil), deliveryDate: iso(d.deliveryDate), carrier: d.carrier ?? '', paymentMethod: d.paymentMethod ?? '', withholdingOperationType: d.withholdingOperationType ?? '',
          discountMode: d.globalDiscountMinor > 0 ? 'amount' : 'pct', discount: d.globalDiscountMinor > 0 ? this.ref.fromMinor(d.globalDiscountMinor) : d.globalDiscountPct, notes: d.notes ?? '', terms: d.terms ?? '' });
        (d.schedule ?? []).forEach((s) => this.schedule.push(this.installment({ dueDate: s.dueDate, percent: s.percent })));
        if (this.kind() === 'delivery-notes' && d.source) {
          const cur = Object.fromEntries(d.lines.map((l) => [l.sourceLineId!, l.quantity]));
          this.svc.sourceLines(d.source.type, d.source.id).subscribe((s) => { this.applySource(s, d.source!.type, d.source!.id, cur); this.loading.set(false); });
          return;
        }
        d.lines.forEach((l) => this.lines.push(this.lineGroup({ ...l, vatCode: l.vat.code })));
        this.loading.set(false); this.recalc();
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl(this.cfg().route); },
    });
  }

  private discountParts() {
    const h = this.header.getRawValue(); const v = Number(h.discount) || 0;
    return h.discountMode === 'pct' ? { globalDiscountPct: v, globalDiscountMinor: 0 } : { globalDiscountPct: 0, globalDiscountMinor: this.ref.toMinor(v) };
  }
  private lineBodies() {
    return this.lines.getRawValue().map((l) => ({ ...(l.productId && { productId: l.productId }), designation: l.designation, ...(l.description && { description: l.description }), ...(l.unit && { unit: l.unit }),
      quantity: Number(l.quantity), unitPriceMinor: this.ref.toMinor(Number(l.unitPrice)), discountPct: Number(l.discountPct) || 0, vatCode: l.vatCode }));
  }
  private recalc() {
    if (this.srcMode()) return;
    const ok = this.customerId() && this.lines.length && this.lines.controls.every((g) => g.valid);
    if (!ok) { this.preview.set(null); this.calcError.set(''); return; }
    const h = this.header.getRawValue();
    this.svc.calculate({ docType: this.cfg().calcType, customerId: this.customerId(), ...(h.issueDate && { issueDate: h.issueDate }), lines: this.lineBodies(), ...this.discountParts(),
      ...(this.kind() === 'invoices' && h.withholdingOperationType && { withholdingOperationType: h.withholdingOperationType }) }).subscribe({
      next: (p) => { this.preview.set(p); this.calcError.set(''); }, error: (e) => { this.preview.set(null); this.calcError.set(errorMessage(e)); },
    });
  }

  save() {
    this.error.set('');
    if (!this.customerId()) { this.customerCtrl.markAsTouched(); this.error.set('Sélectionnez un client.'); return; }
    const h = this.header.getRawValue(); const k = this.kind(); let body: Record<string, unknown>;
    if (this.srcMode()) {
      const lines = this.srcMode()!.lines.map((l, i) => { const sn = this.srcSerials.at(i).value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); return { sourceLineId: l.sourceLineId, quantity: Number(this.srcQty.at(i).value), ...(sn.length && { serials: sn }) }; }).filter((l) => l.quantity > 0);
      if (!lines.length) { this.error.set('Indiquez au moins une quantité à livrer.'); return; }
      body = { source: this.srcRef, lines, deliveryDate: h.deliveryDate, carrier: h.carrier || undefined, notes: h.notes || undefined };
    } else {
      if (!this.lines.length || this.lines.invalid) { this.lines.markAllAsTouched(); this.error.set('Corrigez les lignes (désignation, quantité, TVA obligatoires).'); return; }
      body = { customerId: this.customerId(), lines: this.lineBodies(), ...this.discountParts(), notes: h.notes || undefined };
      if (k === 'delivery-notes') Object.assign(body, { deliveryDate: h.deliveryDate, carrier: h.carrier || undefined });
      else body['issueDate'] = h.issueDate;
      if (this.cfg().hasValidity) Object.assign(body, { validUntil: h.validUntil, terms: h.terms || undefined });
      if (k === 'invoices') {
        if (h.paymentMethod) body['paymentMethod'] = h.paymentMethod;
        if (h.withholdingOperationType) body['withholdingOperationType'] = h.withholdingOperationType;
        if (this.schedule.length) body['schedule'] = this.schedule.getRawValue().map((s) => ({ dueDate: s.dueDate, percent: Number(s.percent) }));
      }
    }
    this.saving.set(true);
    const id = this.id();
    (id ? this.svc.update(k, id, body) : this.svc.create(k, body)).subscribe({
      next: (d) => { this.toast.success(id ? 'Document modifié' : 'Document créé'); this.router.navigate([this.cfg().route, d.id]); },
      error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
