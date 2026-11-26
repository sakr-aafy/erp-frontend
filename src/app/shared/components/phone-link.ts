import { Component, computed, input } from '@angular/core';
import { PhoneInfo } from '../models/api.models';
import { Icon } from './icon';

/**
 * Numéro de téléphone cliquable (`tel:`) au format international lisible. Un numéro que le serveur n'a pas reconnu
 * est affiché tel que saisi, avec la mention « À vérifier ».
 */
@Component({
  selector: 'app-phone',
  imports: [Icon],
  template: `
    @if (view(); as p) {
      <a class="num" [href]="p.href" (click)="$event.stopPropagation()">{{ p.display }}</a>
      @if (!p.valid) {<span class="flag" title="Numéro non reconnu : corrigez-le (indicatif du pays, ex. +216)"><app-icon name="warning" />À vérifier</span>}
    }`,
  styles: `:host{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}.num{white-space:nowrap;font-variant-numeric:tabular-nums}
    .flag{display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;line-height:18px;background:var(--accent-100);color:var(--accent-ink)}.flag app-icon{--icon-size:.75rem;color:inherit!important;margin:0!important}`,
})
export class PhoneLink {
  info = input<PhoneInfo | null | undefined>(null);
  /** Repli lorsque le serveur n'a pas fourni la représentation d'affichage. */
  value = input<string | null | undefined>(null);
  view = computed<PhoneInfo | null>(() => this.info() ?? (this.value() ? { display: this.value()!, href: `tel:${this.value()!.replace(/[^\d+]/g, '')}`, valid: true } : null));
}
