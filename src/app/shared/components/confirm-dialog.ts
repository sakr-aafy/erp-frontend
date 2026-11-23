import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Observable, map } from 'rxjs';
import { Icon } from './icon';

export interface ConfirmData { title: string; message: string; confirmLabel?: string; danger?: boolean }

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, Icon],
  template: `
    <div class="head"><span class="ico" [class.danger]="data.danger"><app-icon [name]="data.danger ? 'warning' : 'info'" /></span><h2 mat-dialog-title>{{ data.title }}</h2></div>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Annuler</button>
      <button mat-flat-button [mat-dialog-close]="true" [color]="data.danger ? 'warn' : 'primary'">{{ data.confirmLabel ?? 'Confirmer' }}</button>
    </mat-dialog-actions>`,
  styles: `.head{display:flex;align-items:center;gap:12px;padding:20px 24px 0}.head h2{padding:0;margin:0}.ico{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--brand-50);color:var(--brand);flex:none}.ico.danger{background:var(--danger-50);color:var(--danger)}mat-dialog-content{padding-top:12px!important}`,
})
export class ConfirmDialog {
  data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

export function confirm(dialog: MatDialog, data: ConfirmData): Observable<boolean> {
  return dialog.open(ConfirmDialog, { data, width: '420px' }).afterClosed().pipe(map((r) => r === true));
}
