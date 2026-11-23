import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DownloadService {
  private http = inject(HttpClient);

  /** Télécharge un fichier protégé (Bearer) et le propose à l'enregistrement. */
  save(path: string, params: Record<string, string | number | boolean | undefined> = {}, fallbackName = 'export'): Observable<void> {
    return this.fetch(path, params).pipe(map(({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename ?? fallbackName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }));
  }
  /** Ouvre un PDF dans un nouvel onglet (impression). */
  openPdf(path: string): Observable<void> {
    return this.fetch(path, {}).pipe(map(({ blob }) => {
      const url = URL.createObjectURL(blob);
      if (!window.open(url, '_blank')) { const a = document.createElement('a'); a.href = url; a.download = 'document.pdf'; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }));
  }
  private fetch(path: string, params: Record<string, string | number | boolean | undefined>) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p = p.set(k, String(v));
    return this.http.get(`${environment.apiUrl}${path}`, { params: p, observe: 'response', responseType: 'blob' }).pipe(
      map((r) => ({ blob: r.body as Blob, filename: /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] })),
      // Les erreurs d'un téléchargement arrivent sous forme de Blob JSON : on en extrait le message de l'API
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
          return from(err.error.text()).pipe(switchMap((t) => {
            let msg = 'Téléchargement impossible';
            try { msg = JSON.parse(t)?.error?.message ?? msg; } catch { /* corps non JSON */ }
            return throwError(() => new Error(msg));
          }));
        }
        return throwError(() => err);
      }),
    );
  }
}
