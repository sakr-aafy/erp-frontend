import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

export interface DuplicateGroup { kind: 'email' | 'phone'; value: string; occurrences: { customerId: string; code: string | null; name: string; source: 'customer' | 'contact'; contactName: string | null; raw: string }[] }

/** Doublons antérieurs à la règle d'unicité : rien n'est fusionné automatiquement, chaque fiche se corrige à la main. */
@Component({
  selector: 'app-duplicates-dialog',
  imports: [MatDialogModule, MatButtonModule, RouterLink],
  template: `
    <h2 mat-dialog-title>Coordonnées en double</h2>
    <mat-dialog-content>
      <p class="muted">Ces coordonnées sont partagées par plusieurs fiches ou contacts. Ouvrez une fiche pour la corriger : aucune donnée n’est modifiée automatiquement.</p>
      @for (g of groups; track g.kind + g.value) {
        <section><h3>{{ g.kind === 'email' ? 'E-mail' : 'Téléphone' }} {{ g.value }}</h3>
          <ul>@for (o of g.occurrences; track $index) {<li><a [routerLink]="['/customers', o.customerId]" (click)="ref.close()">{{ o.code ?? '' }} {{ o.name }}</a>
            <span class="muted">{{ o.source === 'contact' ? 'contact ' + o.contactName : 'société' }} : {{ o.raw }}</span></li>}</ul></section>}
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Fermer</button></mat-dialog-actions>`,
  styles: `section{border-top:1px solid var(--border);padding:10px 0}h3{margin:0 0 6px;font-size:14px}ul{margin:0;padding:0;list-style:none}li{display:flex;flex-wrap:wrap;gap:8px;padding:3px 0}a{color:var(--brand);font-weight:600;text-decoration:none}`,
})
export class DuplicatesDialog { groups = inject<DuplicateGroup[]>(MAT_DIALOG_DATA); ref = inject(MatDialogRef<DuplicatesDialog>); }
