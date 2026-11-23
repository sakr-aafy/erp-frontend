import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody } from '../../shared/models/api.models';

/** Extrait un message lisible d'une erreur HTTP de l'API. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | undefined;
    const e = body?.error;
    if (e?.details?.length) return `${e.message} : ${e.details.map((d) => d.message).join(' ; ')}`;
    if (e?.message) return e.message;
    if (err.status === 0) return 'Serveur injoignable';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Une erreur est survenue';
}
