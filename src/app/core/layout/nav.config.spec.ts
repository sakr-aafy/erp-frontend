import { describe, expect, it } from 'vitest';
import { NAV, SEGMENT_LABELS } from './nav.config';

const PERM = /^[a-zA-Z]+:(view|create|update|validate|delete)$/;
describe('configuration du menu', () => {
  const items = NAV.flatMap((g) => g.items);
  it('chaque entrée a une route absolue et une permission valide (ou est réservée à l’administrateur de plateforme)', () => {
    for (const i of items) { expect(i.route.startsWith('/'), i.label).toBe(true); expect(i.platformAdmin || i.route === '/dashboard' || PERM.test(i.permission ?? ''), i.label).toBe(true); }
  });
  it('aucun doublon (route + filtre) : « Factures de vente » et « Avoirs » partagent /invoices mais se distinguent par le filtre', () => {
    const keys = items.map((i) => i.route + JSON.stringify(i.query ?? {})); expect(new Set(keys).size).toBe(keys.length);
    expect(items.find((i) => i.label === 'Avoirs')?.query).toEqual({ type: 'credit_note' });
  });
  it('les modules du cahier des charges sont accessibles depuis le menu', () => {
    const routes = items.map((i) => i.route);
    for (const r of ['/customers', '/products', '/suppliers', '/quotations', '/proformas', '/invoices', '/delivery-notes', '/purchase-orders', '/stock', '/imports', '/costs', '/expenses', '/accounting', '/treasury', '/reports', '/users']) expect(routes, r).toContain(r);
  });
  it('un seul groupe « tableau de bord » à plat ; les autres groupes sont déroulants', () => {
    expect(NAV.filter((g) => g.flat)).toHaveLength(1); expect(NAV[0]!.items[0]!.route).toBe('/dashboard');
  });
  it('libellés de fil d’Ariane définis pour les sous-pages courantes', () => { for (const k of ['new', 'edit', 'movements', 'warehouses', 'reconciliation']) expect(SEGMENT_LABELS[k], k).toBeTruthy(); });
});
