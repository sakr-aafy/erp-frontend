import { Component, inject } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Observable } from 'rxjs';
import { Icon } from '../../shared/components/icon';
import { CategoryTree } from './category-tree';

/** Gestion rapide des catégories depuis le formulaire d'article (les unités de mesure sont fixes). */
@Component({
  selector: 'app-catalog-dialog',
  imports: [MatDialogModule, MatButtonModule, Icon, CategoryTree],
  template: `
    <header class="head">
      <span class="badge"><app-icon name="category" /></span>
      <div><h2 mat-dialog-title>Catégories</h2><p class="desc">Organisez votre catalogue en catégories et sous-catégories.</p></div>
    </header>
    <mat-dialog-content><app-category-tree (viewed)="close()" /></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-stroked-button mat-dialog-close>Fermer</button></mat-dialog-actions>`,
  styles: `
    :host{display:block;box-sizing:border-box;max-width:100%}*{box-sizing:border-box}
    .head{display:flex;align-items:center;gap:14px;padding:20px 24px 8px}
    .badge{display:grid;place-items:center;width:44px;height:44px;border-radius:var(--r-lg);background:var(--brand-50);color:var(--brand);flex:none}
    h2{margin:0!important;padding:0!important;font-size:18px;font-weight:600;color:var(--text)}
    .desc{margin:2px 0 0;font-size:13px;color:var(--muted)}.head>div{min-width:0;flex:1}
    mat-dialog-content{padding:12px 24px 4px!important;overflow-x:hidden}
    @media (max-width:560px){.head{padding:16px 16px 4px;gap:10px}.badge{width:38px;height:38px}mat-dialog-content{padding:10px 16px 4px!important}mat-dialog-actions{padding:10px 16px 16px!important}}
    mat-dialog-actions{padding:12px 24px 20px!important}`,
})
export class CatalogDialog {
  private ref = inject(MatDialogRef<CatalogDialog>);
  close() { this.ref.close(); }
}
export const openCatalog = (d: MatDialog): Observable<unknown> => d.open(CatalogDialog, { width: '760px', maxWidth: '94vw', autoFocus: 'dialog' }).afterClosed();
