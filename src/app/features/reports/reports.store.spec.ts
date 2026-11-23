import { describe, expect, it } from 'vitest';
import { PERIOD_PRESETS, presetRange } from './reports.store';

const NOW = new Date(2026, 10, 22); // 22 novembre 2026 (heure locale)

describe('presetRange — périodes prédéfinies', () => {
  it('mois courant et mois précédent', () => {
    expect(presetRange('month', NOW)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(presetRange('lastMonth', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });
  it('mois précédent en janvier : décembre de l’année précédente', () => {
    expect(presetRange('lastMonth', new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('30 derniers jours, trimestre, année', () => {
    expect(presetRange('last30', NOW)).toEqual({ from: '2026-10-24', to: '2026-11-22' });
    expect(presetRange('quarter', NOW)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(presetRange('quarter', new Date(2026, 1, 10))).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    expect(presetRange('year', NOW)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetRange('lastYear', NOW)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
  it('février d’une année bissextile : dernier jour correct', () => {
    expect(presetRange('month', new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
  it('« toute la période » et « personnalisée » : aucune borne imposée', () => {
    expect(presetRange('all', NOW)).toEqual({ from: '', to: '' }); expect(presetRange('custom', NOW)).toEqual({ from: '', to: '' });
  });
  it('toutes les valeurs proposées à l’utilisateur sont gérées', () => {
    for (const p of PERIOD_PRESETS) { const r = presetRange(p.value, NOW); expect(r.from <= r.to || r.to === '', p.value).toBe(true); }
  });
});
