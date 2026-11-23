import { Component, input } from '@angular/core';

/** État de chargement (skeleton) : lignes animées, neutres. */
@Component({
  selector: 'app-skeleton',
  template: `@for (r of rows(); track $index) {<div class="line" [style.width.%]="$index === 0 ? 100 : 92 - ($index % 3) * 12"></div>}`,
  styles: `.line{height:18px;margin:16px 0;border-radius:6px;background:linear-gradient(90deg,var(--border) 25%,var(--surface-2) 50%,var(--border) 75%);background-size:200% 100%;animation:s 1.3s infinite linear}
    @keyframes s{0%{background-position:200% 0}100%{background-position:-200% 0}}`,
})
export class Skeleton { count = input(5); rows = () => Array.from({ length: this.count() }); }
