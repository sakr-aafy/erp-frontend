import { DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounce, map, of, switchMap, tap, timer } from 'rxjs';

export interface LookupPage<T> { items: T[]; total: number }

/**
 * Liste déroulante alimentée par le serveur : première page à l'ouverture (sans saisie), recherche avec délai (debounce),
 * requêtes devenues inutiles annulées (switchMap), pages suivantes au défilement. Jamais toute la collection en mémoire.
 */
export function pagedLookup<T>(fetch: (q: string, page: number) => Observable<LookupPage<T>>, destroy: DestroyRef, delay = 250) {
  const items = signal<T[]>([]); const total = signal(0); const loading = signal(false); const error = signal(false); const done = signal(false);
  let q = ''; let page = 1;
  const requests = new Subject<{ q: string; page: number; immediate: boolean }>();
  requests.pipe(
    debounce((r) => timer(r.immediate ? 0 : delay)),
    tap(() => { loading.set(true); error.set(false); }),
    switchMap((r) => fetch(r.q, r.page).pipe(map((res) => ({ r, res })), catchError(() => of({ r, res: null })))),
    takeUntilDestroyed(destroy),
  ).subscribe(({ r, res }) => {
    loading.set(false); done.set(true);
    if (!res) { error.set(true); return; }
    page = r.page; total.set(res.total); items.set(r.page === 1 ? res.items : [...items(), ...res.items]);
  });
  const run = (next: string, immediate: boolean) => { q = next.trim(); done.set(false); if (immediate) { items.set([]); total.set(0); } requests.next({ q, page: 1, immediate }); };
  return {
    items: items.asReadonly(), total: total.asReadonly(), loading: loading.asReadonly(), error: error.asReadonly(),
    /** Aucune réponse correspondant à la demande en cours. */
    empty: () => done() && !loading() && !error() && !items().length,
    open: (next = '') => run(next, true),
    type: (next: string) => run(next, false),
    more: () => { if (!loading() && items().length < total()) { loading.set(true); requests.next({ q, page: page + 1, immediate: true }); } },
    retry: () => requests.next({ q, page: 1, immediate: true }),
  };
}

/** Charge la page suivante quand le panneau de suggestions approche de la fin (souris ou clavier). */
export function watchPanelScroll(panel: HTMLElement | undefined, more: () => void) {
  if (!panel) return;
  panel.onscroll = () => { if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 48) more(); };
}
