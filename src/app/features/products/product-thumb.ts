import { Component, effect, inject, input, signal } from '@angular/core';
import { Icon } from '../../shared/components/icon';
import { ProductPhotos } from './product-actions.service';

/** Miniature (ou icône par défaut) d'un article. */
@Component({
  selector: 'app-product-thumb',
  imports: [Icon],
  template: `<span class="t" [style.width.px]="size()" [style.height.px]="size()">@if (src()) {<img [src]="src()" [alt]="alt()" loading="lazy" />} @else {<app-icon [name]="kind() === 'service' ? 'work' : 'inventory_2'" />}</span>`,
  styles: `.t{display:inline-grid;place-items:center;border-radius:var(--r-md);background:var(--brand-50);color:var(--brand);overflow:hidden;flex:none;border:1px solid var(--border)}img{width:100%;height:100%;object-fit:cover}`,
})
export class ProductThumb {
  productId = input.required<string>(); photoId = input<string | null>(null); alt = input(''); size = input(40); kind = input<'product' | 'service'>('product');
  private photos = inject(ProductPhotos); src = signal<string | null>(null);
  constructor() { effect(() => { const pid = this.photoId(); const id = this.productId(); this.src.set(null); if (pid) void this.photos.url(id, pid).then((u) => this.src.set(u)); }); }
}
