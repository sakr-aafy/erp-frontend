import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../authentication/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService); const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  // Mot de passe temporaire : changement obligatoire avant tout accès
  if (auth.user()!.mustChangePassword && state.url !== '/change-password') return router.createUrlTree(['/change-password']);
  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/']) : true;
};

/** route.data.permission : string ou liste (toutes requises). */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const need = ([] as string[]).concat(route.data['permission'] ?? []);
  if (need.every((p) => auth.has(p))) return true;
  if (route.data['platformAdmin'] && auth.user()?.isPlatformAdmin) return true;
  return inject(Router).createUrlTree(['/forbidden']);
};
