import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Icon } from './icon';

export interface RowAction { label: string; icon: string; run?: () => void; link?: unknown[]; danger?: boolean; hidden?: boolean }

/** Actions d'une ligne de tableau regroupées dans un menu « ⋮ » (les actions masquées par les permissions ne sont pas rendues). */
@Component({
  selector: 'app-row-actions',
  imports: [MatButtonModule, MatMenuModule, RouterLink, Icon],
  template: `
    @if (visible().length) {
      <button mat-icon-button [matMenuTriggerFor]="m" aria-label="Actions" (click)="$event.stopPropagation()"><app-icon name="more_vert" /></button>
      <mat-menu #m="matMenu" xPosition="before">
        @for (a of visible(); track a.label) {
          @if (a.link) {<a mat-menu-item [routerLink]="a.link"><app-icon [name]="a.icon" />{{ a.label }}</a>}
          @else {<button mat-menu-item (click)="a.run?.()" [class.danger]="a.danger"><app-icon [name]="a.icon" />{{ a.label }}</button>}
        }
      </mat-menu>
    }`,
  styles: `.danger{color:var(--danger)}.danger app-icon{color:var(--danger)!important}`,
})
export class RowActions { actions = input.required<RowAction[]>(); visible = () => this.actions().filter((a) => !a.hidden); }
