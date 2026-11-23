import { Component, input } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Icon } from './icon';
import { MatInputModule } from '@angular/material/input';
import { Contact } from '../models/api.models';

export type ContactGroup = FormGroup<{ name: FormControl<string>; role: FormControl<string>; email: FormControl<string>; phone: FormControl<string>; isPrimary: FormControl<boolean> }>;
export const contactGroup = (fb: FormBuilder, c?: Contact): ContactGroup => fb.nonNullable.group({
  name: [c?.name ?? '', [Validators.required, Validators.maxLength(100)]], role: [c?.role ?? ''], email: [c?.email ?? '', Validators.email], phone: [c?.phone ?? ''], isPrimary: [c?.isPrimary ?? false],
});

/** Gestion de plusieurs contacts / interlocuteurs (client, fournisseur). */
@Component({
  selector: 'app-contacts-editor',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, Icon, MatCheckboxModule],
  template: `
    @for (c of array().controls; track $index) {
      <div class="row" [formGroup]="c">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Nom</mat-label><input matInput formControlName="name" />
          @if (c.controls.name.invalid) {<mat-error>Requis</mat-error>}</mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Fonction</mat-label><input matInput formControlName="role" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Téléphone</mat-label><input matInput formControlName="phone" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" />
          @if (c.controls.email.invalid) {<mat-error>E-mail invalide</mat-error>}</mat-form-field>
        <mat-checkbox formControlName="isPrimary" (change)="onPrimary($index, $event.checked)">Principal</mat-checkbox>
        <button mat-icon-button type="button" (click)="array().removeAt($index)" aria-label="Retirer le contact"><app-icon name="delete" /></button>
      </div>
    } @empty {<p class="muted">Aucun contact.</p>}
    <button mat-stroked-button type="button" (click)="add()"><app-icon name="person_add" />Ajouter un contact</button>`,
  styles: `.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.row mat-form-field{flex:1;min-width:150px}`,
})
export class ContactsEditor {
  array = input.required<FormArray<ContactGroup>>();
  fb = new FormBuilder();
  add() { this.array().push(contactGroup(this.fb)); }
  onPrimary(i: number, on: boolean) { if (on) this.array().controls.forEach((c, j) => j !== i && c.controls.isPrimary.setValue(false)); }
}
