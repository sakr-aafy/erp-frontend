import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../authentication/auth.service';

const isAuthEndpoint = (url: string) => /\/auth\/(login|refresh|logout|forgot-password|reset-password|config)/.test(url);
// Le logout envoie l'access token (révocation immédiate côté serveur) mais ne déclenche jamais de refresh
const sendsToken = (url: string) => !/\/auth\/(login|refresh|forgot-password|reset-password|config)/.test(url);

/** Ajoute le Bearer ; sur 401, tente un refresh unique puis rejoue la requête, sinon déconnecte. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const withToken = (r: HttpRequest<unknown>) => (auth.token ? r.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } }) : r);
  return next(sendsToken(req.url) ? withToken(req) : req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !isAuthEndpoint(req.url)) {
        return auth.refresh().pipe(
          switchMap((r) => {
            if (!r) { auth.expire(); return throwError(() => err); }
            return next(withToken(req));
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
