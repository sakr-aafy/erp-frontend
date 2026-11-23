import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, UserProfile } from '../../shared/models/api.models';
import { ReferenceDataService } from '../services/reference-data.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private ref = inject(ReferenceDataService);
  private base = `${environment.apiUrl}/auth`;

  /** Access token en mémoire uniquement (jamais en localStorage) ; le refresh token est un cookie httpOnly. */
  private _token = signal<string | null>(null);
  readonly user = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => !!this.user());
  private permSet = computed(() => new Set(this.user()?.permissions ?? []));
  private refreshing$: Observable<AuthResponse | null> | null = null;

  get token() { return this._token(); }
  has(permission: string) { return this.permSet().has(permission); }
  hasAny(permissions: string[]) { return permissions.some((p) => this.has(p)); }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.base}/login`, { email, password }, { withCredentials: true }).pipe(tap((r) => this.setSession(r)), tap(() => this.ref.reload()));
  }

  /** Restaure la session au démarrage via le cookie de refresh. */
  restore(): Observable<boolean> {
    // Les données de référence (devise, TVA) sont chargées avant le premier rendu : les formulaires de montants en dépendent
    return this.refresh().pipe(switchMap((r) => (r ? this.ref.load$().pipe(map(() => true), catchError(() => of(true))) : of(false))));
  }

  /** Une seule requête de refresh à la fois (partagée entre appels concurrents). */
  refresh(): Observable<AuthResponse | null> {
    if (!this.refreshing$) {
      this.refreshing$ = this.http.post<AuthResponse>(`${this.base}/refresh`, {}, { withCredentials: true }).pipe(
        tap((r) => this.setSession(r)),
        catchError(() => { this.clear(); return of(null); }),
        finalize(() => (this.refreshing$ = null)),
        shareReplay(1),
      );
    }
    return this.refreshing$;
  }

  logout() {
    this.http.post(`${this.base}/logout`, {}, { withCredentials: true }).pipe(catchError(() => of(null))).subscribe(() => {
      this.clear();
      this.router.navigateByUrl('/login');
    });
  }

  /** Appelé par l'intercepteur quand la session est définitivement invalide. */
  expire() { this.clear(); this.router.navigateByUrl('/login'); }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<void>(`${this.base}/change-password`, { currentPassword, newPassword }).pipe(tap(() => this.clear()));
  }
  config() { return this.http.get<{ passwordResetEnabled: boolean }>(`${this.base}/config`); }
  forgot(email: string) { return this.http.post<{ message: string }>(`${this.base}/forgot-password`, { email }); }
  reset(token: string, newPassword: string) { return this.http.post<void>(`${this.base}/reset-password`, { token, newPassword }); }

  private setSession(r: AuthResponse) { this._token.set(r.accessToken); this.user.set(r.user); }
  private clear() { this._token.set(null); this.user.set(null); this.ref.clear(); }
}
