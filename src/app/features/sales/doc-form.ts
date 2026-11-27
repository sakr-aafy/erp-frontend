import { ChangeDetectorRef, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from '../../shared/components/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, of, switchMap } from 'rxjs';
import { errorMessage } from '../../core/services/api';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { AddressSelect } from '../../shared/components/address-select';
import { PageHeader } from '../../shared/components/page-header';
import { AddressSnapshot, Customer2 } from '../../shared/models/api.models';
import { Skeleton } from '../../shared/components/skeleton';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { FiscalService } from '../fiscal/fiscal.service';
import { ArticleSearch, ArticleSearchValue } from '../products/article-search';
import { ProductService } from '../products/product.service';
import { AuthService } from '../../core/authentication/auth.service';
import { UnitsService } from '../../core/services/units.service';
import { DecimalInput } from '../../shared/directives/decimal-input.directive';
import { discountError, discountValidator, quantityError, quantityValidator } from '../../shared/utils/quantity';
import { CustomerSearch, CustomerSearchValue } from '../customers/customer-search';
import { PaymentTermService } from '../payment-terms/payment-term.service';
import { openPaymentTerms } from '../payment-terms/payment-terms-dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { CalcPreview, DOC_CONFIG, DocConfig, DocKind, PAYMENT_METHOD_LABELS, SalesDoc, SourceLine, SourceLines } from './sales.models';
import { SerialPicker } from './cycle/delivery-dialogs';
import { SalesService } from './sales.service';
import { QtyPipe } from '../../shared/pipes/quantity.pipe';

/** Valeur du sélecteur ouvrant le texte libre (ne peut pas être confondue avec une condition saisie). */
const FREE = '__free__';
const PRESET_TERMS = ['Comptant', '30 jours', '60 jours'];
const iso = (d?: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

@Component({
  selector: 'app-doc-form',
  imports: [QtyPipe, AddressSelect, CustomerSearch, DecimalInput, MatCheckboxModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, Icon, MatAutocompleteModule, PageHeader, Skeleton, MoneyPipe, ArticleSearch, CdkDropList, CdkDrag, CdkDragHandle],
  template: `
    <div class="page">
      <app-page-header [title]="title()" [subtitle]="subtitle()" />
      @if (loading()) {<div class="card"><app-skeleton /></div>} @else {
      <form [formGroup]="form" (ngSubmit)="save()">
        @if (error()) {<div class="card err" role="alert">{{ error() }}</div>}
        <div class="card sec" formGroupName="header"><h3>Client et dates</h3>
          <div class="form-grid">
            @if (srcMode() || lockedCustomer()) {<mat-form-field appearance="outline"><mat-label>Client</mat-label><input matInput [value]="customerSel()?.name ?? ''" readonly /></mat-form-field>}
            @else {<app-customer-search label="Client" placeholder="Rechercher un client…" [pickOnly]="true" [required]="true" [filters]="{ status: 'active' }" [selection]="customerSel()" [error]="customerError()" (changed)="onCustomer($event)" />}
            @if (kind() !== 'delivery-notes') {<mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput type="date" formControlName="issueDate" /></mat-form-field>}
            @if (kind() === 'delivery-notes') {<mat-form-field appearance="outline"><mat-label>Date de livraison</mat-label><input matInput type="date" formControlName="deliveryDate" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Transporteur</mat-label><input matInput formControlName="carrier" /></mat-form-field>}
            @if (cfg().hasValidity) {<mat-form-field appearance="outline"><mat-label>Valable jusqu’au</mat-label><input matInput type="date" formControlName="validUntil" /></mat-form-field>}
            @if (kind() === 'invoices') {<mat-form-field appearance="outline"><mat-label>Mode de règlement</mat-label><mat-select formControlName="paymentMethod"><mat-option value="">—</mat-option>@for (m of methods; track m.key) {<mat-option [value]="m.key">{{ m.label }}</mat-option>}</mat-select></mat-form-field>}
          </div>
        </div>

        <div class="card sec"><h3>{{ kind() === 'delivery-notes' ? 'Livraison' : 'Livraison et conditions de paiement' }}</h3>
          @if (!customerId()) {<p class="muted">Sélectionnez un client pour choisir son adresse de livraison{{ kind() === 'delivery-notes' ? '' : ' et reprendre ses conditions de paiement' }}.</p>}
          @else {<div class="delivery">
            <app-address-select [addresses]="customerData()?.deliveryAddresses ?? []" [current]="currentAddress()" [(value)]="addressId" />
            @if (kind() !== 'delivery-notes') {<div>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full"><mat-label>Conditions de paiement</mat-label>
                <mat-select [value]="termsMode()" (selectionChange)="pickTerms($event.value)">
                  <mat-option value="">Non précisées</mat-option>@for (t of termsOptions(); track t) {<mat-option [value]="t">{{ t }}</mat-option>}<mat-option [value]="free">Conditions personnalisées</mat-option>
                </mat-select>@if (canManageTerms) {<button matSuffix mat-icon-button type="button" aria-label="Gérer les conditions de paiement" title="Gérer les conditions de paiement" (click)="manageTerms($event)"><app-icon name="settings" /></button>}<mat-hint>Reprises de la fiche client, adaptables pour ce document.</mat-hint></mat-form-field>
              @if (termsMode() === free) {<mat-form-field appearance="outline" class="full terms-text"><mat-label>Texte des conditions de paiement</mat-label>
                <textarea matInput rows="2" maxlength="500" [value]="termsText()" (input)="termsText.set($any($event.target).value)"></textarea></mat-form-field>}
            </div>}
          </div>}
          @if (hasDeliveryTime()) {<div formGroupName="header"><mat-form-field appearance="outline" class="full delay"><mat-label>Délai de livraison</mat-label>
            <textarea matInput rows="2" maxlength="500" formControlName="deliveryTime" placeholder="Ex. 4 à 6 semaines après confirmation"></textarea><mat-hint>Texte libre, imprimé tel quel sur le document.</mat-hint></mat-form-field></div>}
        </div>

        @if (srcMode(); as sm) {
          <div class="card sec"><h3>Lignes à livrer — {{ sm.sourceNumber }}</h3>
            @if (sm.warehouses.length) {<div formGroupName="header"><mat-form-field appearance="outline" class="wh"><mat-label>Magasin de sortie</mat-label><mat-select formControlName="warehouseId">@for (w of sm.warehouses; track w.id) {<mat-option [value]="w.id">{{ w.code }} — {{ w.name }}</mat-option>}</mat-select><mat-hint>Le stock ne sort qu’à la validation.</mat-hint></mat-form-field></div>}
            @else {<p class="warn" role="status"><app-icon name="warning" />Aucun magasin actif : la validation de la livraison sera impossible.</p>}
            @if (!sm.lines.length) {<p class="warn" role="status"><app-icon name="info" />Toutes les quantités de ce document sont déjà livrées.</p>}
            @else {
            <div class="table-wrap"><table class="lines src"><thead><tr><th>Livrer</th><th>Article</th><th class="r">Commandé</th><th class="r">Déjà livré</th><th class="r">Reste</th><th class="r">Stock</th><th class="r">À livrer</th><th>N° de série</th></tr></thead>
              <tbody>@for (l of sm.lines; track l.sourceLineId; let i = $index) {<tr [class.unpicked]="!srcPick.at(i).value">
                <td><mat-checkbox [formControl]="srcPick.at(i)" [aria-label]="'Livrer ' + l.designation" /></td>
                <td class="what">{{ l.designation }}<small class="muted">{{ l.reference }}@if (l.kind === 'service') { · service, sans stock}</small>@if (l.draftQty) {<small class="draft">{{ l.draftQty | qty }} {{ l.unit }} déjà en préparation</small>}</td>
                <td class="r">{{ l.quantity | qty }} {{ l.unit }}</td><td class="r">{{ l.deliveredQty | qty }}</td><td class="r">{{ l.remainingQty | qty }}</td>
                <td class="r">@if (l.stock) {{{ stockOf(l) | qty }}} @else {—}</td>
                <td class="r"><input appDecimal class="q" [formControl]="srcQty.at(i)" [readOnly]="!srcPick.at(i).value" [attr.aria-label]="'Quantité à livrer ' + l.designation" [class.bad]="srcQty.at(i).invalid || qtyOver(l, i)" />
                  @if (srcQty.at(i).invalid) {<small class="err-t" role="alert">{{ qtyError(srcQty.at(i)) }}</small>}
                  @else if (qtyOver(l, i)) {<small class="err-t" role="alert">Maximum {{ l.remainingQty | qty }}</small>}
                  @else if (short(l, i)) {<small class="stock-t" role="status">Stock insuffisant dans ce magasin</small>}</td>
                <td class="sn">@if (l.hasSerial) {<button mat-stroked-button type="button" [disabled]="!srcPick.at(i).value || !header.controls.warehouseId.value" (click)="pickSerials(l, i)">Choisir ({{ srcSerials.at(i).value.length }}/{{ srcQty.at(i).value || 0 }})</button>
                  @if (srcSerials.at(i).value.length) {<small>{{ srcSerials.at(i).value.join(', ') }}</small>}} @else {<span class="muted">—</span>}</td></tr>}</tbody></table></div>
            <p class="muted">Livraison partielle autorisée : le reste pourra être livré par d’autres bons.@if (sm.fullyDelivered) { {{ sm.fullyDelivered }} ligne(s) entièrement livrée(s) ne sont plus proposées.}</p>}
          </div>
        } @else if (locked(); as lk) {
          <div class="card sec"><h3>Lignes livrées</h3>
            <p class="muted">Quantités, prix et remises viennent des bons de livraison. Pour facturer d’autres quantités, supprimez ce brouillon.</p>
            <div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th>Bon de livraison</th><th class="r">Qté</th><th class="r">P.U. HT</th><th class="r">Rem. %</th><th class="r">Total HT</th></tr></thead>
              <tbody>@for (l of lk.lines; track l.id) {<tr><td>{{ l.designation }}@if (l.serials?.length) {<small class="muted">N° de série : {{ l.serials!.join(', ') }}</small>}</td><td>{{ l.delivery?.noteNumber }}</td><td class="r">{{ l.quantity | qty }} {{ l.unit }}</td><td class="r">{{ l.unitPriceMinor | money }}</td><td class="r">{{ l.discountPct ? (l.discountPct | qty) : '—' }}</td><td class="r">{{ l.netHtMinor | money }}</td></tr>}</tbody></table></div>
            <div class="locked-total"><span>Total TTC (recalculé à l’enregistrement selon la date)</span><strong>{{ lk.totals.totalTtcMinor | money }}</strong></div>
          </div>
          <div class="card sec"><h3>Échéancier de paiement</h3>
              @if (customTerms() && !schedule.length) {<p class="warn" role="status"><app-icon name="warning" />Conditions personnalisées : saisissez les échéances réelles — la validation les exige, aucune date n’est déduite du texte.</p>}<p class="muted">Sans échéancier : une échéance unique à la date de facture + délai de paiement du client. Total des pourcentages = 100.</p>
              <div formArrayName="schedule">@for (s of schedule.controls; track $index; let i = $index) {<div class="row" [formGroupName]="i">
                <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Échéance</mat-label><input matInput type="date" formControlName="dueDate" /></mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:140px"><mat-label>% du total</mat-label><input matInput type="number" min="0" max="100" step="0.01" formControlName="percent" /></mat-form-field>
                <button mat-icon-button type="button" (click)="schedule.removeAt(i)" aria-label="Retirer l’échéance"><app-icon name="delete" /></button></div>}</div>
              <button mat-stroked-button type="button" (click)="addInstallment()"><app-icon name="add" />Ajouter une échéance</button></div>
        } @else if (kind() === 'quotations') {
          <div class="card sec"><h3>Lignes</h3>
            <div class="table-wrap"><table class="lines quote"><thead><tr><th>Pos.</th><th>Référence</th><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. HT ({{ ref.symbol() }})</th><th class="r">Rem.%</th><th>TVA</th><th class="r">Total HT</th><th><span class="sr">Ordre et suppression</span></th></tr></thead>
              <tbody cdkDropList (cdkDropListDropped)="drop($event)">
                @if (!lines.length) {<tr><td colspan="9" class="muted">Aucune ligne : ajoutez un article du catalogue ou une ligne libre.</td></tr>}
                @for (g of lines.controls; track g; let i = $index; let first = $first; let last = $last) {
                <tr [formGroup]="g" cdkDrag cdkDragLockAxis="y">
                  <td class="pos"><span class="handle" cdkDragHandle title="Glisser pour réorganiser"><app-icon name="drag_indicator" /></span><strong>{{ (i + 1) * 10 }}</strong></td>
                  <td class="ref">{{ g.controls.reference.value || '—' }}</td>
                  <td><input class="w" formControlName="designation" placeholder="Désignation" aria-label="Désignation" /></td>
                  <td class="r"><input appDecimal class="q" formControlName="quantity" aria-label="Quantité" [class.bad]="g.controls.quantity.invalid" />@if (g.controls.quantity.invalid) {<small class="err-t" role="alert">{{ qtyError(g.controls.quantity) }}</small>} @else if (g.controls.unit.value) {<small class="muted">{{ g.controls.unit.value }}</small>}</td>
                  <td class="r"><input class="p" type="number" min="0" [step]="1 / 10 ** ref.decimals()" formControlName="unitPrice" aria-label="Prix unitaire" /></td>
                  <td class="r"><input appDecimal clearOnFocus class="d" formControlName="discountPct" aria-label="Remise %" [readOnly]="syncOn()" [class.locked]="syncOn()" [attr.title]="syncOn() ? 'Fixée par la remise globale' : null" [class.bad]="g.controls.discountPct.invalid" />@if (g.controls.discountPct.invalid) {<small class="err-t" role="alert">{{ discError(g.controls.discountPct) }}</small>}</td>
                  <td><select formControlName="vatCode" aria-label="Code TVA"><option value="">—</option>@for (v of ref.vatRates(); track v.code) {<option [value]="v.code">{{ v.code }} ({{ vatText(v) }})</option>}</select></td>
                  <td class="r total">{{ lineTotals().get(g) | money }}</td>
                  <td class="tools"><button mat-icon-button type="button" [disabled]="first" (click)="move(i, -1)" [attr.aria-label]="'Monter la ligne ' + (i + 1) * 10"><app-icon name="arrow_up" /></button>
                    <button mat-icon-button type="button" [disabled]="last" (click)="move(i, 1)" [attr.aria-label]="'Descendre la ligne ' + (i + 1) * 10"><app-icon name="arrow_down" /></button>
                    <button mat-icon-button type="button" (click)="lines.removeAt(i)" aria-label="Retirer la ligne"><app-icon name="delete" /></button></td>
                </tr>}</tbody></table></div>
            <div class="add">
              <app-article-search class="picker" label="Ajouter un article du catalogue" placeholder="Référence ou désignation" [resetOnPick]="true" [filters]="{ status: 'active' }" (changed)="pickArticle($event)" />
              <button mat-stroked-button type="button" (click)="addFree()"><app-icon name="add" />Ligne libre</button>
            </div>
            <p class="muted small">Positions attribuées automatiquement (10, 20, 30…). Le prix, la désignation et la TVA proposés viennent de la fiche article ; les modifier ici ne change pas le référentiel.</p>
            @if (!ref.vatRates().length) {<p class="err-t">Aucune règle de TVA validée : configurez-les dans <a routerLink="/fiscal">Fiscalité</a>.</p>}
          </div>
        } @else {
          <div class="card sec"><h3>Lignes</h3>
            <div class="table-wrap"><table class="lines"><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. HT ({{ ref.symbol() }})</th><th class="r">Rem. %</th><th>TVA</th><th class="r">Total HT</th><th></th></tr></thead>
              <tbody formArrayName="lines">
                @if (!lines.length) {<tr><td colspan="7" class="muted">Aucune ligne : ajoutez un article du catalogue ou une ligne libre.</td></tr>}@for (g of lines.controls; track $index; let i = $index) {
                <tr [formGroupName]="i">
                  <td><input class="w" formControlName="designation" placeholder="Désignation" aria-label="Désignation" />@if (g.controls.reference.value) {<small class="muted">{{ g.controls.reference.value }}</small>}</td>
                  <td class="r"><input appDecimal class="q" formControlName="quantity" aria-label="Quantité" [class.bad]="g.controls.quantity.invalid" />@if (g.controls.quantity.invalid) {<small class="err-t" role="alert">{{ qtyError(g.controls.quantity) }}</small>}</td>
                  <td class="r"><input class="p" type="number" min="0" [step]="1 / 10 ** ref.decimals()" formControlName="unitPrice" aria-label="Prix unitaire" /></td>
                  <td class="r"><input appDecimal class="d" formControlName="discountPct" aria-label="Remise %" [readOnly]="syncOn()" [class.locked]="syncOn()" [class.bad]="g.controls.discountPct.invalid" />@if (g.controls.discountPct.invalid) {<small class="err-t" role="alert">{{ discError(g.controls.discountPct) }}</small>}</td>
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
            <div class="card sec"><h3>Échéancier de paiement</h3>
              @if (customTerms() && !schedule.length) {<p class="warn" role="status"><app-icon name="warning" />Conditions personnalisées : saisissez les échéances réelles — la validation les exige, aucune date n’est déduite du texte.</p>}<p class="muted">Sans échéancier : une échéance unique à la date de facture + délai de paiement du client. Total des pourcentages = 100.</p>
              <div formArrayName="schedule">@for (s of schedule.controls; track $index; let i = $index) {<div class="row" [formGroupName]="i">
                <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Échéance</mat-label><input matInput type="date" formControlName="dueDate" /></mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:140px"><mat-label>% du total</mat-label><input matInput type="number" min="0" max="100" step="0.01" formControlName="percent" /></mat-form-field>
                <button mat-icon-button type="button" (click)="schedule.removeAt(i)" aria-label="Retirer l’échéance"><app-icon name="delete" /></button></div>}</div>
              <button mat-stroked-button type="button" (click)="addInstallment()"><app-icon name="add" />Ajouter une échéance</button></div>
          }
        }

        <div class="bottom">
          <div class="card sec" style="flex:1;min-width:280px" formGroupName="header"><h3>Remises, conditions et notes</h3>
            @if (!srcMode() && !locked() && kind() !== 'delivery-notes') {
              @if (legacyPct(); as old) {<div class="warn legacy" role="status"><app-icon name="info" /><div>Ce document porte une ancienne remise globale de {{ old }} % appliquée sur le total, en plus des remises de ligne. Elle est conservée telle quelle.
                <mat-checkbox [checked]="removeLegacy()" (change)="setRemoveLegacy($event.checked)">La retirer pour utiliser les nouvelles remises</mat-checkbox></div></div>}
              <div class="row discounts">
                <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Remise globale (%)</mat-label><input matInput appDecimal formControlName="syncDiscount" [readOnly]="legacyKept()" />
                  <mat-hint>Appliquée à chaque article</mat-hint>@if (header.controls.syncDiscount.invalid) {<mat-error>{{ discError(header.controls.syncDiscount) }}</mat-error>}</mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Remise supplémentaire ({{ ref.symbol() }})</mat-label><input matInput appDecimal formControlName="amountDiscount" [readOnly]="legacyKept()" />
                  <mat-hint>Montant déduit après les remises d’articles</mat-hint>@if (header.controls.amountDiscount.invalid) {<mat-error>Montant positif</mat-error>}</mat-form-field>
              </div>
              <p class="mode muted small" role="status">{{ syncOn() ? 'Remise globale de ' + frNumber(header.controls.syncDiscount.value) + ' % : les remises de toutes les lignes sont verrouillées sur ce taux.' : 'Remises libres : chaque article peut avoir son propre taux.' }}</p>}
            @if (kind() === 'invoices' && withholdingTypes().length) {<mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Retenue à la source — type d’opération</mat-label>
              <mat-select formControlName="withholdingOperationType"><mat-option value="">Aucune retenue</mat-option>@for (w of withholdingTypes(); track w.code) {<mat-option [value]="w.code">{{ w.code }} — {{ w.ratePct }} % sur {{ w.base === 'ttc' ? 'TTC' : 'HT' }}</mat-option>}</mat-select>
              <mat-hint>Appliquée seulement si les conditions de la règle sont remplies (client assujetti, seuil).</mat-hint></mat-form-field>}
            @if (cfg().hasValidity) {<mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Autres conditions</mat-label><textarea matInput rows="2" formControlName="terms"></textarea></mat-form-field>}
            <mat-form-field appearance="outline" style="width:100%;margin-top:8px"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
          </div>
          @if (!srcMode() && !locked()) {
            <div class="card sec totals" style="width:380px;max-width:100%"><h3>Totaux <small class="muted">(calculés par le serveur)</small></h3>
              @if (calcError()) {<p class="err-t">{{ calcError() }}</p>}
              @if (preview(); as p) {
                <div><span>Total brut</span><span>{{ p.totals.grossMinor | money }}</span></div>
                @if (p.totals.lineDiscountsMinor) {<div><span>Remises sur les lignes</span><span>- {{ p.totals.lineDiscountsMinor | money }}</span></div>}
                @if (p.totals.globalDiscountMinor) {<div><span>{{ legacyKept() ? 'Ancienne remise globale' : 'Remise supplémentaire' }}</span><span>- {{ p.totals.globalDiscountMinor | money }}</span></div>}
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
  styles: `.sec{margin-bottom:16px}.delivery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:16px;align-items:start}.full{width:100%}.terms-text{margin-top:12px}
    .warn{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:var(--r-md);background:var(--accent-50);border:1px solid var(--accent-300);color:var(--accent-ink)}h3{margin:0 0 12px;font-size:16px}.err{color:var(--danger);margin-bottom:16px}.err-t{color:var(--danger)}
    .lines{width:100%;border-collapse:collapse;min-width:720px}.lines th,.lines td{padding:6px 8px;border-bottom:1px solid var(--erp-border);text-align:left;vertical-align:middle}.lines th{color:var(--muted);font-weight:500;font-size:13px}.r{text-align:right!important}
    .wh{width:min(360px,100%);margin-bottom:12px}.src{min-width:900px}.src .what{min-width:180px}.lines.src small,.lines td small.muted{display:block;font-size:11px}.draft{color:var(--accent-ink)}tr.unpicked td{opacity:.55}.stock-t{display:block;font-size:11px;color:var(--accent-ink);white-space:normal}.sn small{display:block;max-width:220px;overflow-wrap:anywhere}.locked-total{display:flex;justify-content:flex-end;gap:16px;margin-top:12px;font-size:15px}.locked-total strong{color:var(--brand)}
    app-customer-search{margin-bottom:22px}.lines input,.lines select{font:inherit;border:1px solid var(--border-strong);border-radius:6px;padding:6px 8px;background:#fff}.w{width:100%;min-width:200px}.q{width:80px;text-align:right}.p{width:110px;text-align:right}.d{width:70px;text-align:right}
    .add{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px}.bottom{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
    .totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.totals .b{font-weight:600;border-top:1px solid var(--erp-border);margin-top:4px;padding-top:6px}.totals .s{font-size:13px;color:var(--muted)}
    .lines.quote{min-width:900px}.quote th,.quote td{padding:6px 5px}.quote th:last-child,.quote td:last-child{padding-right:9px}.quote .pos{white-space:nowrap;width:58px}.handle{display:inline-grid;place-items:center;width:22px;height:32px;margin-right:2px;color:var(--muted);cursor:grab;vertical-align:middle}.quote .ref{color:var(--brand);font-weight:600;max-width:104px;overflow-wrap:anywhere}.quote .total{white-space:nowrap;font-weight:600;font-variant-numeric:tabular-nums}.quote .tools{white-space:nowrap;width:1%}.quote .tools button{--mat-icon-button-state-layer-size:32px;padding:6px}.quote input,.quote select{box-sizing:border-box}.quote .w{min-width:150px}.quote .q{width:72px}.quote .p{width:108px}.quote .d{width:68px}.quote select{width:122px}.quote small{display:block;font-size:11px}.bad{border-color:var(--danger)!important}.lines input.locked{background:var(--surface-2);color:var(--muted)}.lines small.err-t{display:block;font-size:11px;white-space:normal}.discounts{align-items:flex-start}.discounts mat-form-field{flex:1 1 220px;max-width:300px}.legacy{margin-bottom:12px}.legacy mat-checkbox{display:block;margin-top:4px}.delay{margin-top:12px}.mode{margin:4px 0 8px}
    .picker{flex:1;min-width:260px}.small{font-size:12px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.cdk-drag-preview{display:table;background:var(--surface);box-shadow:var(--shadow-md)}.cdk-drag-placeholder{opacity:.35}`,
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

  customerId = signal(''); lockedCustomer = signal(false);
  customerSel = signal<{ id?: string; name: string } | null>(null); customerError = signal('');
  productCtrl = new FormControl('', { nonNullable: true }); productOptions = signal<{ id: string; reference: string; name: string; salePriceMinor: number; vatRateCode: string; unitCode: string | null; quantityDecimals?: number }[]>([]);
  withholdingTypes = signal<{ code: string; ratePct: number; base: string }[]>([]);

  lines = this.fb.array<ReturnType<DocForm['lineGroup']>>([]);
  schedule = this.fb.array<ReturnType<DocForm['installment']>>([]);
  srcQty = this.fb.array<FormControl<number>>([]); srcSerials = this.fb.array<FormControl<string[]>>([]); srcPick = this.fb.array<FormControl<boolean>>([]);
  /** Facture issue de bons de livraison : lignes en lecture seule. */
  locked = signal<SalesDoc | null>(null);
  header = this.fb.nonNullable.group({
    issueDate: [iso(new Date())], validUntil: [addDays(30)], deliveryDate: [iso(new Date())], carrier: [''], warehouseId: [''], paymentMethod: [''], withholdingOperationType: [''],
    /** Remise globale (%) recopiée sur les lignes ; remise supplémentaire en montant. */
    syncDiscount: [0 as number | null, discountValidator], amountDiscount: [0 as number | null, Validators.min(0)], notes: [''], terms: [''], deliveryTime: ['', Validators.maxLength(500)],
  });
  hasDeliveryTime = () => this.kind() === 'quotations' || this.kind() === 'proformas';
  /** Remise globale en % active : les remises de ligne sont fixées à ce taux. */
  syncValue = signal(0); syncOn = () => this.syncValue() > 0;
  legacyPct = signal(0); removeLegacy = signal(false); legacyKept = () => this.legacyPct() > 0 && !this.removeLegacy();
  private units = inject(UnitsService); private revision: number | undefined;
  /** Facture issue de BL : les quantités livrées antérieures aux règles d'unités restent valables. */
  private fromDeliveries = false;
  qtyError = quantityError; discError = discountError; frNumber = (v: number | null) => String(v ?? 0).replace('.', ',');
  setRemoveLegacy(v: boolean) { this.removeLegacy.set(v); this.recalc(); }
  private applySync(v: number | null) {
    const sync = Number.isFinite(v) && v! > 0 && v! <= 100 && this.header.controls.syncDiscount.valid ? v! : 0;
    this.syncValue.set(sync);
    // Retour à zéro : les derniers taux restent affichés et redeviennent modifiables
    if (sync) for (const g of this.lines.controls) if (g.controls.discountPct.value !== sync) g.controls.discountPct.setValue(sync, { emitEvent: false });
  }
  form = this.fb.group({ header: this.header, lines: this.lines, schedule: this.schedule, srcQty: this.srcQty, srcSerials: this.srcSerials, srcPick: this.srcPick });
  srcMode = signal<SourceLines | null>(null);
  srcRef: { type: string; id: string } | null = null;
  preview = signal<CalcPreview | null>(null); calcError = signal('');
  loading = signal(false); saving = signal(false); error = signal('');

  // Adresse de livraison et conditions de paiement du document
  readonly free = FREE;
  customerData = signal<Customer2 | null>(null);
  addressId = signal(''); currentAddress = signal<AddressSnapshot | null>(null);
  /** Sélection correspondant à la copie déjà portée par le document : inchangée, elle n'est pas renvoyée au serveur. */
  private keptAddress: string | undefined; private addressReady = false;
  termsMode = signal(''); termsText = signal(''); private termsReady = false; private termsCustom = false;
  private paymentTerms = inject(PaymentTermService); private auth = inject(AuthService); private dialog = inject(MatDialog);
  canManageTerms = this.auth.has('customers:create') || this.auth.has('customers:update');
  private managed = (label: string) => this.paymentTerms.terms().find((t) => t.label === label);
  termsOptions = computed(() => { const c = this.customerData(); const own = [c && !c.paymentTermsCustom ? c.paymentTerms : null, this.termsMode()];
    const active = this.paymentTerms.terms().filter((t) => t.isActive).map((t) => t.label);
    return [...new Set([...(active.length ? active : PRESET_TERMS), ...own.filter((t): t is string => !!t && t !== FREE)])]; });
  customTerms = () => (this.termsMode() === FREE || this.managed(this.termsMode())?.delayDays === null) && this.termsCustom;
  pickTerms(v: string) { this.termsMode.set(v); const t = this.managed(v); this.termsCustom = v === FREE || (!!t && t.delayDays === null); this.termsReady = true; }
  private setTerms(text: string | null | undefined, custom: boolean | undefined) {
    const t = text ?? ''; const isFree = !!t && !this.managed(t) && (!!custom || !/^(comptant|\d{1,3}\s*jours?)$/i.test(t));
    this.termsMode.set(isFree ? FREE : t); this.termsText.set(isFree ? t : ''); this.termsCustom = !!custom; this.termsReady = true;
  }
  private loadTerms() {
    this.paymentTerms.refresh().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => { // texte affiché en saisie libre avant le chargement de la liste
      if (this.termsMode() === FREE && this.managed(this.termsText())) { this.termsMode.set(this.termsText()); this.termsText.set(''); } }, error: () => undefined });
  }
  manageTerms(e: Event) { e.stopPropagation(); openPaymentTerms(this.dialog).pipe(takeUntilDestroyed(this.destroy)).subscribe(); }
  private keepAddress(snapshot: AddressSnapshot | null) {
    this.currentAddress.set(snapshot); this.addressId.set(snapshot?.addressId ?? ''); this.keptAddress = snapshot?.addressId ?? ''; this.addressReady = true;
  }
  /** Charge la fiche du client ; `defaults` indique ce qui doit être repris de la fiche (nouveau document ou client changé). */
  private loadCustomer(id: string, defaults: { address: boolean; terms: boolean }, then?: (c: Customer2) => void) {
    this.svc.customer(id).subscribe({ next: (c) => {
      if (this.customerId() !== id) return; // le client a été changé entre-temps
      this.customerData.set(c);
      if (defaults.address) { this.currentAddress.set(null); this.keptAddress = undefined; this.addressId.set(c.deliveryAddresses.find((a) => a.isDefault && !a.archived)?.id ?? ''); this.addressReady = true; }
      if (defaults.terms) this.setTerms(c.paymentTerms, c.paymentTermsCustom);
      then?.(c);
    }, error: (e) => { if (e.status !== 403) this.toast.error(errorMessage(e)); } }); // sans « clients : consulter », le serveur garde les valeurs du document
  }
  private resetCustomer() { this.customerData.set(null); this.currentAddress.set(null); this.addressId.set(''); this.keptAddress = undefined; this.addressReady = false; this.termsMode.set(''); this.termsText.set(''); this.termsReady = false; this.termsCustom = false; }

  subtitle = () => this.kind() === 'delivery-notes' ? 'Livraison totale ou partielle : le stock ne sort qu’à la validation.' : 'Les montants sont calculés par le serveur avec les règles fiscales validées.';
  private view = inject(ChangeDetectorRef);
  /** Numéro du devis en cours de modification, affiché dans le titre. */
  docNumber = signal('');
  title = () => {
    const { gender, singular } = this.cfg(); const f = gender === 'f';
    if (!this.id()) return `${f ? 'Nouvelle' : 'Nouveau'} ${singular}`;
    return [`Modifier ${f ? 'la' : 'le'} ${singular}`, this.docNumber()].filter(Boolean).join(' ');
  };
  stockOf = (l: SourceLine) => l.stock?.find((s) => s.warehouseId === this.header.controls.warehouseId.value)?.qty ?? 0;
  private wanted = (i: number) => Number(this.srcQty.at(i).value) || 0;
  qtyOver = (l: SourceLine, i: number) => this.srcPick.at(i).value && this.wanted(i) > l.remainingQty + 1e-9;
  short = (l: SourceLine, i: number) => !!l.stock && this.srcPick.at(i).value && !!this.header.controls.warehouseId.value && this.wanted(i) > this.stockOf(l) + 1e-9;
  pickSerials(l: SourceLine, i: number) {
    const warehouseId = this.header.controls.warehouseId.value; const w = this.srcMode()!.warehouses.find((x) => x.id === warehouseId);
    this.dialog.open(SerialPicker, { maxWidth: '95vw', data: { productId: l.productId, warehouseId, warehouseLabel: w?.code ?? '', designation: l.designation, quantity: this.wanted(i), selected: this.srcSerials.at(i).value, excludeId: this.id() } })
      .afterClosed().subscribe((r?: string[]) => { if (r) { this.srcSerials.at(i).setValue(r); this.view.markForCheck(); } }); // valeur posée hors événement du formulaire
  }
  vatText = (v: { regime: string; ratePct?: number }) => (v.regime === 'taxable' ? `${v.ratePct} %` : ({ zero: '0 %', exempt: 'exonéré', suspended: 'suspension' } as Record<string, string>)[v.regime]);

  lineGroup(l?: { id?: string; productId?: string | null; reference?: string | null; designation?: string; description?: string | null; unit?: string | null; quantity?: number; unitPriceMinor?: number; discountPct?: number; vatCode?: string; precision?: number | null }) {
    const g = this.fb.nonNullable.group({
      id: [l?.id ?? ''], productId: [l?.productId ?? ''], reference: [l?.reference ?? ''], designation: [l?.designation ?? '', Validators.required], description: [l?.description ?? ''], unit: [l?.unit ?? ''],
      /** Précision connue par la fiche article (sinon déduite de l'unité). */
      precision: [l?.precision ?? (null as number | null)],
      quantity: [(l?.quantity ?? 1) as number | null], unitPrice: [l?.unitPriceMinor != null ? this.ref.fromMinor(l.unitPriceMinor) : 0, [Validators.required, Validators.min(0)]],
      discountPct: [(this.syncOn() ? this.syncValue() : l?.discountPct ?? 0) as number | null, discountValidator], vatCode: [l?.vatCode ?? '', Validators.required],
    });
    const original = l?.id ? l.quantity : undefined;
    g.controls.quantity.addValidators(quantityValidator(() => g.controls.precision.value ?? this.units.decimalsOf(g.controls.unit.value), { carried: () => (this.fromDeliveries ? original : undefined) }));
    g.controls.quantity.updateValueAndValidity({ emitEvent: false });
    return g;
  }
  installment(i?: { dueDate?: string; percent?: number | null }) { return this.fb.nonNullable.group({ dueDate: [iso(i?.dueDate) || addDays(30), Validators.required], percent: [i?.percent ?? 100, [Validators.required, Validators.min(0.01), Validators.max(100)]] }); }
  addFree() { this.lines.push(this.lineGroup()); }
  /** Réorganisation (boutons ou glisser-déposer) : les lignes gardent leur identifiant, les positions suivent l'ordre. */
  move(i: number, delta: number) { const to = i + delta; if (to < 0 || to >= this.lines.length) return; const g = this.lines.at(i); this.lines.removeAt(i, { emitEvent: false }); this.lines.insert(to, g); this.lines.markAsDirty(); }
  drop(e: CdkDragDrop<unknown>) { this.move(e.previousIndex, e.currentIndex - e.previousIndex); }
  private products = inject(ProductService);
  /** Article choisi : référence, désignation, unité, prix de vente HT et TVA repris de sa fiche. */
  pickArticle(v: ArticleSearchValue) {
    if (!v.product) return;
    this.products.get(v.product.id).subscribe({ next: (p) => this.addProduct({ id: p.id, reference: p.reference, name: p.name, salePriceMinor: p.salePriceMinor, vatRateCode: p.vatRateCode, unitCode: p.unitCode, quantityDecimals: p.quantityDecimals }), error: (e) => this.toast.error(errorMessage(e)) });
  }
  addInstallment() { this.schedule.push(this.installment({ percent: Math.max(0, 100 - this.schedule.controls.reduce((s, g) => s + Number(g.controls.percent.value || 0), 0)) || 100 })); }
  addProduct(p: { id: string; reference: string; name: string; salePriceMinor: number; vatRateCode: string; unitCode: string | null; quantityDecimals?: number }) {
    // retire une ligne libre restée vide avant d'ajouter l'article
    for (let i = this.lines.length - 1; i >= 0; i--) { const g = this.lines.at(i).controls; if (!g.designation.value && !g.vatCode.value && !g.productId.value) this.lines.removeAt(i); }
    this.lines.push(this.lineGroup({ productId: p.id, reference: p.reference, designation: p.name, unit: p.unitCode, unitPriceMinor: p.salePriceMinor, vatCode: p.vatRateCode, precision: p.quantityDecimals ?? null }));
    this.productCtrl.setValue('');
  }
  onCustomer(v: CustomerSearchValue) {
    const id = v.customer?.id ?? '';
    if (id === this.customerId()) return;
    this.resetCustomer(); this.customerId.set(id); this.customerError.set('');
    if (v.customer) { this.customerSel.set({ id, name: v.customer.name }); this.loadCustomer(id, { address: true, terms: true }); } else this.customerSel.set(null);
    this.form.updateValueAndValidity();
  }

  ngOnInit() {
    this.ref.load$().subscribe();
    if (this.kind() !== 'delivery-notes') this.loadTerms();
    // La précision des quantités dépend des unités : revalidation à leur arrivée
    this.units.load(() => { for (const g of this.lines.controls) g.controls.quantity.updateValueAndValidity(); });
    this.header.controls.syncDiscount.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => this.applySync(v));
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
    this.customerId.set(c); this.loadCustomer(c, { address: true, terms: true }, (x) => this.customerSel.set({ id: x.id, name: x.name }));
  }

  private loadSource(type: string, sourceId: string) {
    this.loading.set(true);
    this.svc.sourceLines(type, sourceId).subscribe({
      next: (s) => { this.applySource(s, type, sourceId); this.loading.set(false); },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl('/delivery-notes'); },
    });
  }
  private applySource(s: SourceLines, type: string, id: string, current?: Record<string, number>, serials: Record<string, string[]> = {}) {
    // Nouveau BL : l'adresse du document source est reprise ; à défaut (document ancien), celle par défaut du client
    if (!current && s.deliveryAddress !== undefined) this.keepAddress(s.deliveryAddress);
    this.srcMode.set(s); this.srcRef = { type, id }; this.srcQty.clear(); this.srcSerials.clear(); this.srcPick.clear();
    s.lines.forEach((l) => { this.srcQty.push(new FormControl((current ? current[l.sourceLineId] ?? 0 : l.remainingQty) as number, { nonNullable: true, validators: quantityValidator(() => (l.hasSerial ? 0 : this.units.decimalsOf(l.unit)), { allowZero: true, optional: true, carried: () => (current ? current[l.sourceLineId] : l.remainingQty) }) })); this.srcSerials.push(new FormControl(serials[l.sourceLineId] ?? [], { nonNullable: true })); this.srcPick.push(new FormControl(current ? !!current[l.sourceLineId] : true, { nonNullable: true })); });
    if (!this.header.controls.warehouseId.value) this.header.controls.warehouseId.setValue(s.warehouses.find((w) => w.isDefault)?.id ?? s.warehouses[0]?.id ?? '');
    this.customerId.set(s.customerId); this.lines.clear();
    this.loadCustomer(s.customerId, { address: !current && s.deliveryAddress === undefined, terms: false }, (c) => this.customerSel.set({ id: s.customerId, name: c.name }));
  }

  private loadExisting(id: string) {
    this.loading.set(true);
    this.svc.get(this.kind(), id).subscribe({
      next: (d: SalesDoc) => {
        if (d.editable === false) { this.toast.error('Ce document n’est plus modifiable.'); this.router.navigate([this.cfg().route, id]); return; }
        this.customerSel.set({ id: d.customerId, name: d.customer.name }); this.customerId.set(d.customerId); this.lockedCustomer.set(false);
        if (this.kind() === 'quotations') this.docNumber.set(d.number ?? '');
        this.revision = d.revision; this.fromDeliveries = !!d.deliveryNoteIds?.length; this.legacyPct.set(d.globalDiscountPct > 0 ? d.globalDiscountPct : 0);
        // Document antérieur (adresse portée par l'ancien champ) : l'adresse par défaut du client est proposée
        const legacy = !d.deliveryAddress && !!d.customer.shippingAddress;
        if (!legacy) this.keepAddress(d.deliveryAddress ?? null);
        const hasTerms = d.paymentTerms !== null && d.paymentTerms !== undefined;
        if (hasTerms) this.setTerms(d.paymentTerms, d.paymentTermsCustom); else this.termsReady = true;
        // Un BL issu d'un document source est rechargé par applySource
        if (!(this.kind() === 'delivery-notes' && d.source)) this.loadCustomer(d.customerId, { address: legacy, terms: false });
        this.header.patchValue({ issueDate: iso(d.issueDate), validUntil: iso(d.validUntil), deliveryDate: iso(d.deliveryDate), carrier: d.carrier ?? '', paymentMethod: d.paymentMethod ?? '', withholdingOperationType: d.withholdingOperationType ?? '',
          syncDiscount: d.syncDiscountPct ?? 0, amountDiscount: d.globalDiscountPct > 0 ? 0 : this.ref.fromMinor(d.globalDiscountMinor), notes: d.notes ?? '', terms: d.terms ?? '', deliveryTime: d.deliveryTime ?? '' });
        (d.schedule ?? []).forEach((s) => this.schedule.push(this.installment({ dueDate: s.dueDate, percent: s.percent })));
        if (this.kind() === 'delivery-notes') this.header.controls.warehouseId.setValue(d.warehouseId ?? '');
        if (this.kind() === 'delivery-notes' && d.source) {
          const cur = Object.fromEntries(d.lines.map((l) => [l.sourceLineId!, l.quantity])); const serials = Object.fromEntries(d.lines.map((l) => [l.sourceLineId!, l.serials ?? []]));
          this.svc.sourceLines(d.source.type, d.source.id, id).subscribe({ next: (s) => { this.applySource(s, d.source!.type, d.source!.id, cur, serials); this.loading.set(false); }, error: (e) => { this.toast.error(errorMessage(e)); this.router.navigate([this.cfg().route, id]); } });
          return;
        }
        if (d.linesLocked) { this.locked.set(d); this.lockedCustomer.set(true); this.loading.set(false); return; }
        d.lines.forEach((l) => this.lines.push(this.lineGroup({ ...l, vatCode: l.vat.code })));
        this.loading.set(false); this.recalc();
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.router.navigateByUrl(this.cfg().route); },
    });
  }

  private discountParts() {
    const h = this.header.getRawValue(); if (this.legacyKept()) return {};
    return { syncDiscountPct: Number(h.syncDiscount) || 0, globalDiscountMinor: this.ref.toMinor(Number(h.amountDiscount) || 0) };
  }
  private lineBodies() {
    const keepIds = this.kind() === 'quotations' || this.kind() === 'proformas';
    return this.lines.getRawValue().map((l) => ({ ...(keepIds && l.id && { id: l.id }), ...(l.productId && { productId: l.productId }), designation: l.designation, ...(l.description && { description: l.description }), ...(l.unit && { unit: l.unit }),
      quantity: Number(l.quantity), unitPriceMinor: this.ref.toMinor(Number(l.unitPrice)), discountPct: Number(l.discountPct) || 0, vatCode: l.vatCode }));
  }
  /** Total HT renvoyé par le serveur, rattaché à la ligne elle-même : il la suit quand on la déplace. */
  lineTotals = signal(new Map<unknown, number | undefined>());
  private calcSeq = 0;
  private recalc() {
    if (this.srcMode() || this.locked()) return;
    const ok = this.customerId() && this.lines.length && this.lines.controls.every((g) => g.valid) && this.header.controls.syncDiscount.valid && this.header.controls.amountDiscount.valid;
    if (!ok) { this.calcSeq++; this.preview.set(null); this.lineTotals.set(new Map()); this.calcError.set(''); return; }
    const h = this.header.getRawValue(); const groups = [...this.lines.controls]; const seq = ++this.calcSeq;
    this.svc.calculate({ docType: this.cfg().calcType, customerId: this.customerId(), ...(h.issueDate && { issueDate: h.issueDate }), lines: this.lineBodies(), ...this.discountParts(), ...(this.legacyKept() && { legacyGlobalDiscountPct: this.legacyPct() }),
      ...(this.kind() === 'invoices' && h.withholdingOperationType && { withholdingOperationType: h.withholdingOperationType }) }).subscribe({
      next: (p) => { if (seq !== this.calcSeq) return; this.preview.set(p); this.lineTotals.set(new Map(groups.map((g, i) => [g, p.lines[i]?.netHtMinor]))); this.calcError.set(''); },
      error: (e) => { if (seq !== this.calcSeq) return; this.preview.set(null); this.lineTotals.set(new Map()); this.calcError.set(errorMessage(e)); },
    });
  }

  save() {
    this.error.set('');
    if (!this.customerId()) { this.customerError.set('Sélectionnez un client dans la liste'); this.error.set('Sélectionnez un client.'); return; }
    if (this.header.controls.syncDiscount.invalid || this.header.controls.amountDiscount.invalid) { this.header.markAllAsTouched(); this.error.set('Corrigez les remises : un seul chiffre après la virgule pour un pourcentage.'); return; }
    const h = this.header.getRawValue(); const k = this.kind(); let body: Record<string, unknown>;
    if (k !== 'delivery-notes' && this.termsMode() === FREE && !this.termsText().trim()) { this.error.set('Saisissez le texte des conditions de paiement personnalisées.'); return; }
    const address = this.addressReady && this.addressId() !== this.keptAddress ? { deliveryAddressId: this.addressId() || null } : {};
    const locked = this.locked();
    if (this.srcMode()) {
      const source = this.srcMode()!.lines; const picked = source.map((l, i) => ({ l, i })).filter((x) => this.srcPick.at(x.i).value);
      if (picked.some(({ i }) => this.srcQty.at(i).invalid)) { this.error.set('Corrigez les quantités à livrer.'); return; }
      if (!picked.length) { this.error.set('Sélectionnez au moins une ligne à livrer.'); return; }
      const bad = picked.find(({ l, i }) => !(this.wanted(i) > 0) || this.qtyOver(l, i));
      if (bad) { this.error.set(`« ${bad.l.designation} » : indiquez une quantité positive, au plus égale au reste à livrer, ou décochez la ligne.`); return; }
      const serial = picked.find(({ i }) => this.srcSerials.at(i).value.length > this.wanted(i));
      if (serial) { this.error.set(`« ${serial.l.designation} » : trop de numéros de série pour la quantité saisie.`); return; }
      const lines = picked.map(({ l, i }) => ({ sourceLineId: l.sourceLineId, quantity: this.wanted(i), ...(this.srcSerials.at(i).value.length && { serials: this.srcSerials.at(i).value }) }));
      body = { source: this.srcRef, lines, deliveryDate: h.deliveryDate, carrier: h.carrier || undefined, notes: h.notes || undefined, ...(h.warehouseId && { warehouseId: h.warehouseId }), ...address };
    } else if (locked) {
      // Les lignes sont renvoyées telles quelles : le serveur refuse toute différence
      body = { customerId: this.customerId(), lines: locked.lines.map((l) => ({ ...(l.productId && { productId: l.productId }), designation: l.designation, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, discountPct: l.discountPct ?? 0, vatCode: l.vat.code })), issueDate: h.issueDate, notes: h.notes || undefined, ...address };
      if (this.termsReady) { const free = this.termsMode() === FREE; Object.assign(body, { paymentTerms: (free ? this.termsText().trim() : this.termsMode()) || null, paymentTermsCustom: this.termsCustom && (free || !!this.managed(this.termsMode())) }); }
      if (h.paymentMethod) body['paymentMethod'] = h.paymentMethod;
      if (h.withholdingOperationType) body['withholdingOperationType'] = h.withholdingOperationType;
      body['schedule'] = this.schedule.getRawValue().map((s) => ({ dueDate: s.dueDate, percent: Number(s.percent) }));
    } else {
      if (!this.lines.length || this.lines.invalid) { this.lines.markAllAsTouched(); this.error.set('Corrigez les lignes : désignation, quantité au bon nombre de décimales, remise et TVA.'); return; }
      body = { customerId: this.customerId(), lines: this.lineBodies(), ...(k !== 'delivery-notes' && this.discountParts()), ...(this.removeLegacy() && { removeLegacyDiscount: true }), notes: h.notes || undefined, ...address };
      if (this.hasDeliveryTime()) body['deliveryTime'] = h.deliveryTime.trim();
      if (k === 'quotations' && this.id() && this.revision !== undefined) body['revision'] = this.revision;
      if (k !== 'delivery-notes' && this.termsReady) {
        const free = this.termsMode() === FREE;
        Object.assign(body, { paymentTerms: (free ? this.termsText().trim() : this.termsMode()) || null, paymentTermsCustom: this.termsCustom && (free || !!this.managed(this.termsMode())) });
      }
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
