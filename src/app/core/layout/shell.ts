import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../authentication/auth.service';
import { Icon } from '../../shared/components/icon';
import { ReportsStore } from '../../features/reports/reports.store';
import { NAV, NavGroup, NavItem, SEGMENT_LABELS } from './nav.config';

const store = {
  get: <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible : sans conséquence */ } },
};
const ID = /^[a-f0-9]{24}$/i;

/** Coque applicative : sidebar rétractable (groupes déroulants, mode compact, drawer mobile) et en-tête avec fil d'Ariane. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, MatSidenavModule, MatButtonModule, MatMenuModule, MatTooltipModule, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  auth = inject(AuthService);
  private router = inject(Router); private reports = inject(ReportsStore);
  isMobile = toSignal(inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((r) => r.matches)), { initialValue: false });
  collapsed = signal(store.get('erp.nav.collapsed', false));
  mobileOpen = signal(false);
  private openGroups = signal<Record<string, boolean>>(store.get('erp.nav.open', {}));
  private url = toSignal(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects), startWith(this.router.url)), { initialValue: this.router.url });
  /** Compact = icônes seules (desktop uniquement). */
  compact = computed(() => this.collapsed() && !this.isMobile());

  /** Menu filtré selon les permissions (le serveur reste l'autorité). */
  groups = computed<NavGroup[]>(() => {
    const u = this.auth.user();
    return NAV.map((g) => ({ ...g, items: g.items.filter((i) => (i.platformAdmin ? !!u?.isPlatformAdmin : !i.permission || this.auth.has(i.permission))) })).filter((g) => g.items.length);
  });
  private parsed = computed(() => { const u = new URL(this.url(), 'http://x'); return { path: u.pathname.replace(/\/$/, '') || '/', type: u.searchParams.get('type') ?? '' }; });
  /** Entrée la plus spécifique correspondant à l'URL (évite que « Stock » soit actif sur « Mouvements »). */
  activeItem = computed<NavItem | null>(() => {
    const { path, type } = this.parsed(); let best: NavItem | null = null; let len = -1;
    for (const g of this.groups()) for (const i of g.items) {
      const hit = path === i.route || path.startsWith(i.route + '/');
      const q = (i.query?.['type'] ?? '') === type || (!i.query && !(i.route === '/invoices' && type === 'credit_note'));
      if (hit && q && i.route.length + (i.query ? 1 : 0) > len) { best = i; len = i.route.length + (i.query ? 1 : 0); }
    }
    return best;
  });
  activeGroup = computed(() => this.groups().find((g) => g.items.includes(this.activeItem()!)) ?? null);
  isOpen = (g: NavGroup) => this.openGroups()[g.title] ?? g === this.activeGroup();
  breadcrumb = computed<{ label: string; link?: string }[]>(() => {
    const { path } = this.parsed(); const it = this.activeItem(); const g = this.activeGroup(); const out: { label: string; link?: string }[] = [];
    if (path === '/change-password') return [{ label: 'Mon compte' }, { label: 'Mot de passe' }];
    if (!it) return [{ label: 'Accueil' }];
    if (g && !g.flat) out.push({ label: g.title });
    const rest = path.slice(it.route.length).split('/').filter(Boolean);
    out.push({ label: it.label, ...(rest.length ? { link: it.route } : {}) });
    let acc = it.route;
    rest.forEach((s, i) => { acc += '/' + s; const last = i === rest.length - 1; out.push({ label: ID.test(s) ? 'Détail' : SEGMENT_LABELS[s] ?? (it.route === '/reports' ? this.reports.find(s)?.title : undefined) ?? s, ...(last ? {} : { link: acc }) }); });
    return out;
  });
  pageLabel = computed(() => this.breadcrumb().at(-1)?.label ?? '');
  initials = computed(() => (this.auth.user()?.name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase());

  constructor() {
    effect(() => { store.set('erp.nav.collapsed', this.collapsed()); });
    effect(() => { this.url(); if (this.isMobile()) this.mobileOpen.set(false); });
  }
  toggleGroup(g: NavGroup) { this.openGroups.update((o) => { const n = { ...o, [g.title]: !this.isOpen(g) }; store.set('erp.nav.open', n); return n; }); }
  toggle() { this.isMobile() ? this.mobileOpen.update((v) => !v) : this.collapsed.update((v) => !v); }
  isActive = (i: NavItem) => this.activeItem() === i;
}
