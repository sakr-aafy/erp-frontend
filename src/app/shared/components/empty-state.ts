import { Component, input } from '@angular/core';
import { Icon } from './icon';

/** État vide : pictogramme, message et action éventuelle (contenu projeté). */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `<div class="empty"><span class="ico"><app-icon [name]="icon()" /></span><p>{{ message() }}</p><ng-content /></div>`,
  styles: `.empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:48px 16px;color:var(--muted)}
    .ico{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--brand-50);color:var(--brand);margin-bottom:14px;--icon-size:1.6rem;box-shadow:0 0 0 6px var(--surface-2)}
    p{margin:0 0 8px;max-width:420px}`,
})
export class EmptyState { icon = input('inbox'); message = input('Aucune donnée'); }
