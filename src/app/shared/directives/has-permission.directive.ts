import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/authentication/auth.service';

/** *appHasPermission="'users:create'" — masque l'élément sans la permission (le backend reste l'autorité). */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private auth = inject(AuthService);
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);
  readonly appHasPermission = input.required<string | string[]>();
  private shown = false;
  constructor() {
    effect(() => {
      const need = ([] as string[]).concat(this.appHasPermission());
      const ok = need.every((p) => this.auth.has(p));
      if (ok && !this.shown) { this.vcr.createEmbeddedView(this.tpl); this.shown = true; }
      else if (!ok && this.shown) { this.vcr.clear(); this.shown = false; }
    });
  }
}
