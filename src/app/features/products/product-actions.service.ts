import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/authentication/auth.service';
import { errorMessage } from '../../core/services/api';
import { DownloadService } from '../../core/services/download.service';
import { ToastService } from '../../core/services/toast.service';
import { confirm } from '../../shared/components/confirm-dialog';
import { prompt } from '../../shared/components/prompt-dialog';
import { ProductDto } from '../../shared/models/api.models';
import { STATUS_HELP, STATUS_LABEL } from './product.labels';
import { ProductService } from './product.service';

export interface StatusAction { target: string; label: string; icon: string; danger?: boolean }

/** Actions sur un article partagées par la liste et la fiche : statuts, impression, duplication, suppression (le serveur reste l'autorité). */
@Injectable({ providedIn: 'root' })
export class ProductActions {
  private svc = inject(ProductService); private dialog = inject(MatDialog); private toast = inject(ToastService); private dl = inject(DownloadService); private auth = inject(AuthService); private router = inject(Router);

  statusActions(p: Pick<ProductDto, 'status'>): StatusAction[] {
    if (!this.auth.has('products:update')) return [];
    switch (p.status) {
      case 'active': return [{ target: 'inactive', label: 'Désactiver', icon: 'cancel' }, { target: 'blocked', label: 'Bloquer', icon: 'block', danger: true }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      case 'inactive': return [{ target: 'active', label: 'Activer', icon: 'check_circle' }, { target: 'blocked', label: 'Bloquer', icon: 'block', danger: true }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      case 'blocked': return [{ target: 'active', label: 'Débloquer', icon: 'check_circle' }, { target: 'inactive', label: 'Désactiver', icon: 'cancel' }, { target: 'archived', label: 'Archiver', icon: 'archive' }];
      default: return [{ target: 'active', label: 'Réactiver', icon: 'unarchive' }];
    }
  }
  /** Confirme (motif demandé pour un blocage) puis applique le statut. */
  changeStatus(p: ProductDto, a: StatusAction): Observable<ProductDto | null> {
    const ask: Observable<string | null | false> = a.target === 'blocked'
      ? prompt(this.dialog, { title: `Bloquer « ${p.name} »`, label: 'Motif du blocage (défaut, litige, rappel fabricant…)', confirmLabel: 'Bloquer' }).pipe(map((r) => (r ? r : false)))
      : confirm(this.dialog, { title: `${a.label} l’article`, message: `« ${p.name} » passera au statut ${STATUS_LABEL[a.target]!.toLowerCase()}. ${STATUS_HELP[a.target]}`, confirmLabel: a.label, danger: a.danger }).pipe(map((ok) => (ok ? null : false)));
    return ask.pipe(switchMap((r) => (r === false ? of(null) : this.svc.setStatus(p.id, a.target, r ?? undefined).pipe(map((u) => { this.toast.success(`Statut : ${STATUS_LABEL[a.target]}`); return u; })))));
  }
  print(p: Pick<ProductDto, 'id'>) { this.dl.openPdf(`/products/${p.id}/pdf`).subscribe({ error: (e) => this.toast.error(errorMessage(e)) }); }
  duplicate(p: ProductDto) {
    prompt(this.dialog, { title: `Dupliquer « ${p.name} »`, label: 'Nouveau code article (unique)', confirmLabel: 'Dupliquer' }).subscribe((ref) => {
      if (ref) this.svc.duplicate(p.id, ref).subscribe({ next: (n) => { this.toast.success('Article dupliqué'); this.router.navigate(['/products', n.id, 'edit']); }, error: (e) => this.toast.error(errorMessage(e)) });
    });
  }
  remove(p: ProductDto): Observable<boolean> {
    return confirm(this.dialog, { title: 'Supprimer l’article', message: `Supprimer définitivement « ${p.name} » ? Impossible si l’article a déjà servi ou s’il reste du stock (archivez-le alors).`, confirmLabel: 'Supprimer', danger: true })
      .pipe(switchMap((ok) => (ok ? this.svc.remove(p.id).pipe(map(() => { this.toast.success('Article supprimé'); return true; })) : of(false))));
  }
}

/** Photo principale d'un article : chargée avec la session de l'utilisateur (jamais d'URL publique), mise en cache par version de photo. */
@Injectable({ providedIn: 'root' })
export class ProductPhotos {
  private http = inject(HttpClient); private cache = new Map<string, Promise<string | null>>();
  url(productId: string, photoId: string): Promise<string | null> {
    const key = `${productId}:${photoId}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, new Promise((resolve) => this.http.get(`${environment.apiUrl}/products/${productId}/photo`, { responseType: 'blob' }).subscribe({ next: (b) => resolve(URL.createObjectURL(b)), error: () => resolve(null) })));
      if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value!);
    }
    return this.cache.get(key)!;
  }
  forget(productId: string) { for (const k of [...this.cache.keys()]) if (k.startsWith(`${productId}:`)) this.cache.delete(k); }
}
