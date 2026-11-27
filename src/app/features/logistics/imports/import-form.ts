import { Component, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../../core/services/api.service';
import { errorMessage } from '../../../core/services/api';
import { ReferenceDataService } from '../../../core/services/reference-data.service';
import { SupplierDto } from '../../../shared/models/api.models';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeader } from '../../../shared/components/page-header';
import { Skeleton } from '../../../shared/components/skeleton';
import { LineGroup, LinesEditor, PartyPicker, lineGroup } from '../lines-editor';

@Component({
  selector: 'app-import-form',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, PageHeader, Skeleton, LinesEditor, PartyPicker],
  template: `
    <div class="page"><app-page-header [title]="id() ? 'Modifier le dossier d’importation' : 'Nouveau dossier d’importation'" subtitle="Commande internationale : prix en devise étrangère, converti au taux du jour (ou taux saisi). Les frais annexes s’ajoutent ensuite sur la fiche du dossier." />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card" style="color:var(--danger);margin-bottom:16px" role="alert">{{ error() }}</div>}
        <div class="card" style="margin-bottom:16px"><div class="form-grid">
          <app-party-picker label="Fournisseur étranger" endpoint="/suppliers" [extra]="{ foreign: true }" [initial]="supplierInit()" (picked)="supplierId.set($event)" />
          <mat-form-field appearance="outline"><mat-label>Devise</mat-label><mat-select formControlName="currency" (selectionChange)="onCurrency()">@for (c of currencies(); track c.code) {<mat-option [value]="c.code">{{ c.code }} {{ c.name }}</mat-option>}</mat-select>@if (!currencies().length) {<mat-hint>Configurez les devises dans Paramètres</mat-hint>}</mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Taux de change (vide = taux du jour)</mat-label><input matInput type="number" min="0" step="0.000001" formControlName="rate" /><mat-hint>1 {{ form.controls.currency.value || 'devise' }} = … {{ ref.data()?.baseCurrency }}</mat-hint></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Date de commande</mat-label><input matInput type="date" formControlName="orderDate" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Référence (commande fournisseur, proforma…)</mat-label><input matInput formControlName="reference" /></mat-form-field></div>
          @if (preset(); as s) {
            @if (!s.isForeign) {<p role="alert" style="color:var(--danger);margin:0">Fournisseur local : créez une <a [routerLink]="['/purchase-orders', 'new']" [queryParams]="{ supplierId: s.id }">commande d’achat</a>.</p>}
            @else if (s.status !== 'active') {<p role="alert" style="color:var(--danger);margin:0">Fournisseur {{ s.statusLabel.toLowerCase() }} : aucun nouveau dossier n’est possible.</p>}
            @else if (s.paymentTerms || s.leadTimeDays !== null) {<p class="muted" style="margin:0;font-size:13px">@if (s.paymentTerms) {Conditions de paiement habituelles : {{ s.paymentTerms }}. }@if (s.leadTimeDays !== null) {Délai de livraison habituel : {{ s.leadTimeDays }} jour(s).}</p>}
          }</div>
        <div class="card" style="margin-bottom:16px"><h3 style="margin:0 0 12px;font-size:16px">Articles importés</h3><app-lines-editor [array]="lines" [opts]="{ price: true, priceDecimals: decimals(), priceLabel: 'Prix unitaire (' + (form.controls.currency.value || 'devise') + ')' }" /></div>
        <div class="card" style="margin-bottom:16px"><mat-form-field appearance="outline" style="width:100%"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field></div>
        <div class="toolbar-row"><span class="spacer"></span><a mat-button [routerLink]="id() ? ['/imports', id()] : ['/imports']">Annuler</a><button mat-flat-button color="primary" [disabled]="saving()">Enregistrer</button></div>
      </form>}</div>`,
})
export class ImportForm {
  id = input<string>(); private api = inject(Api); private fb = inject(FormBuilder); private router = inject(Router); private toast = inject(ToastService); ref = inject(ReferenceDataService);
  supplierId = signal(''); supplierInit = signal<{ id: string; name: string } | null>(null); lines: FormArray<LineGroup> = this.fb.array<LineGroup>([]);
  form = this.fb.nonNullable.group({ currency: ['', Validators.required], rate: [null as number | null], orderDate: [new Date().toISOString().slice(0, 10)], reference: [''], notes: [''], lines: this.lines });
  loading = signal(false); saving = signal(false); error = signal(''); currencies = () => (this.ref.data()?.currencies ?? []).filter((c) => c.code !== this.ref.data()?.baseCurrency);
  decimals = () => this.ref.decimalsOf(this.form.controls.currency.value || this.ref.data()?.baseCurrency || '');
  onCurrency() { /* la précision change : les prix saisis restent en unités principales */ }
  private route = inject(ActivatedRoute); preset = signal<SupplierDto | null>(null);
  /** Depuis la fiche fournisseur : fournisseur présélectionné avec sa devise habituelle. */
  private preselect(supplierId: string) {
    this.api.get<SupplierDto>(`/suppliers/${supplierId}`).subscribe({ next: (s) => {
      this.preset.set(s); if (!s.isForeign || s.status !== 'active') return;
      this.supplierId.set(s.id); this.supplierInit.set({ id: s.id, name: s.name }); if (s.currency) this.form.controls.currency.setValue(s.currency);
    }, error: (e) => this.toast.error(errorMessage(e)) });
  }
  ngOnInit() {
    this.ref.load$().subscribe(() => { const c = this.currencies(); if (!this.form.controls.currency.value && c.length === 1) this.form.controls.currency.setValue(c[0]!.code); });
    const id = this.id();
    const preselected = this.route.snapshot.queryParamMap.get('supplierId'); if (!id && preselected) this.preselect(preselected);
    if (!id) return; this.loading.set(true);
    this.api.get(`/imports/${id}`).subscribe({ next: (f) => { if (!f.editableLines) { this.toast.error('Lignes non modifiables à ce stade'); this.router.navigate(['/imports', id]); return; }
      this.supplierId.set(f.supplierId); this.supplierInit.set({ id: f.supplierId, name: f.supplier?.name }); this.form.patchValue({ currency: f.currency, rate: f.exchangeRate, orderDate: f.orderDate?.slice(0, 10), reference: f.reference ?? '', notes: f.notes ?? '' });
      f.lines.forEach((l: any) => this.lines.push(lineGroup(this.fb, { productId: l.productId, reference: l.reference ?? '', designation: l.designation ?? '', quantity: l.quantity, unitPrice: this.ref.fromMinor(l.unitPriceMinor, this.ref.decimalsOf(f.currency)) }))); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate(['/imports']); } });  
  }
  save() {
    this.error.set(''); if (!this.supplierId()) { this.error.set('Sélectionnez un fournisseur étranger.'); return; } if (this.form.controls.currency.invalid || !this.lines.length || this.lines.invalid) { this.error.set('Devise et au moins une ligne valide requises.'); return; }
    if (this.lines.getRawValue().some((l) => !l.productId)) { this.error.set('Chaque ligne doit être un article du catalogue.'); return; }
    const v = this.form.getRawValue(); const d = this.decimals(); this.saving.set(true);
    const body = { supplierId: this.supplierId(), currency: v.currency, ...(v.rate && { exchangeRate: Number(v.rate) }), orderDate: v.orderDate || undefined, reference: v.reference || undefined, notes: v.notes || undefined,
      lines: this.lines.getRawValue().map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPriceMinor: this.ref.toMinor(Number(l.unitPrice), d) })) };
    const id = this.id(); (id ? this.api.put(`/imports/${id}`, body) : this.api.post('/imports', body)).subscribe({ next: (f) => { this.toast.success('Dossier enregistré'); this.router.navigate(['/imports', f.id]); }, error: (e) => { this.error.set(errorMessage(e)); this.saving.set(false); } });
  }
}
