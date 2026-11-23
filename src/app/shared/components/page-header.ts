import { Component, input } from '@angular/core';

/** En-tête de page : titre, sous-titre et actions contextuelles (contenu projeté). */
@Component({
  selector: 'app-page-header',
  template: `
    <div class="head">
      <div class="titles"><h1>{{ title() }}</h1>@if (subtitle()) {<p class="muted">{{ subtitle() }}</p>}</div>
      <div class="actions"><ng-content /></div>
    </div>`,
  styles: `.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px 24px;flex-wrap:wrap;margin-bottom:24px}
    .titles{min-width:0;flex:1 1 360px}h1{margin:0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.02em}
    p{margin:4px 0 0;font-size:14px;max-width:720px}.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    @media (max-width:600px){h1{font-size:20px;line-height:28px}.actions{width:100%}.actions>*{flex:1 1 auto}}`,
})
export class PageHeader { title = input.required<string>(); subtitle = input<string>(); }
