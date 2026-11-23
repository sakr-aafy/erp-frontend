import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';

export interface PromptData { title: string; label: string; value?: string; confirmLabel?: string }

@Component({
  selector: 'app-prompt-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="group" (ngSubmit)="ok()"><mat-dialog-content><mat-form-field appearance="outline" style="width:100%;min-width:min(340px,70vw)"><mat-label>{{ data.label }}</mat-label>
      <input matInput formControlName="value" autofocus />@if (group.controls.value.invalid && group.controls.value.touched) {<mat-error>Valeur requise</mat-error>}</mat-form-field></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Annuler</button><button mat-flat-button color="primary">{{ data.confirmLabel ?? 'Valider' }}</button></mat-dialog-actions></form>`,
})
export class PromptDialog {
  data = inject<PromptData>(MAT_DIALOG_DATA); private ref = inject(MatDialogRef<PromptDialog>);
  group = new FormBuilder().nonNullable.group({ value: [this.data.value ?? '', [Validators.required, Validators.maxLength(200)]] });
  ok() { this.group.markAllAsTouched(); if (this.group.valid) this.ref.close(this.group.controls.value.value.trim()); }
}
export const prompt = (d: MatDialog, data: PromptData): Observable<string | undefined> => d.open(PromptDialog, { data }).afterClosed();
