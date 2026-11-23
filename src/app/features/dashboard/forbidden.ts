import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-forbidden', imports: [EmptyState, RouterLink, MatButtonModule],
  template: `<div class="page"><app-empty-state icon="lock" message="Vous n’avez pas la permission d’accéder à cette page." /><div style="text-align:center"><a mat-flat-button routerLink="/">Retour</a></div></div>`,
})
export class Forbidden {}
