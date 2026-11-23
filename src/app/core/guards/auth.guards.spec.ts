import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../authentication/auth.service';
import { authGuard, permissionGuard } from './auth.guards';

const run = (guard: any, route: Partial<ActivatedRouteSnapshot>, url = '/x') =>
  TestBed.runInInjectionContext(() => guard(route as ActivatedRouteSnapshot, { url }));

describe('guards', () => {
  const setup = (user: unknown) => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: () => !!user, user: () => user, has: (p: string) => (user as any)?.permissions?.includes(p) } }] });
  };
  it('authGuard redirige vers /login si non connecté', () => {
    setup(null);
    expect((run(authGuard, {}) as UrlTree).toString()).toBe('/login');
  });
  it('authGuard force /change-password si mot de passe temporaire', () => {
    setup({ mustChangePassword: true, permissions: [] });
    expect((run(authGuard, {}, '/users') as UrlTree).toString()).toBe('/change-password');
    expect(run(authGuard, {}, '/change-password')).toBe(true);
  });
  it('permissionGuard autorise ou redirige vers /forbidden', () => {
    setup({ mustChangePassword: false, permissions: ['users:view'] });
    expect(run(permissionGuard, { data: { permission: 'users:view' } })).toBe(true);
    expect((run(permissionGuard, { data: { permission: 'roles:view' } }) as UrlTree).toString()).toBe('/forbidden');
    expect(TestBed.inject(Router)).toBeTruthy();
  });
});
