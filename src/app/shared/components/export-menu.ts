import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from './icon';
import { MatMenuModule } from '@angular/material/menu';
import { DownloadService } from '../../core/services/download.service';
import { errorMessage } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';

/** Bouton « Exporter » : Excel / CSV / PDF, avec les filtres courants. */
@Component({
  selector: 'app-export-menu',
  imports: [MatButtonModule, Icon, MatMenuModule],
  template: `
    <button mat-stroked-button [matMenuTriggerFor]="m" [disabled]="busy()"><app-icon name="download" />Exporter</button>
    <mat-menu #m="matMenu">
      <button mat-menu-item (click)="run('xlsx')"><app-icon name="table_view" />Excel (.xlsx)</button>
      <button mat-menu-item (click)="run('csv')"><app-icon name="description" />CSV</button>
      <button mat-menu-item (click)="run('pdf')"><app-icon name="picture_as_pdf" />PDF</button>
    </mat-menu>`,
})
export class ExportMenu {
  path = input.required<string>();
  params = input<Record<string, string | number | boolean | undefined>>({});
  private dl = inject(DownloadService); private toast = inject(ToastService);
  busy = signal(false);
  run(format: string) {
    this.busy.set(true);
    this.dl.save(`${this.path()}`, { ...this.params(), format }).subscribe({
      next: () => this.busy.set(false), error: (e) => { this.toast.error(errorMessage(e)); this.busy.set(false); },
    });
  }
}
