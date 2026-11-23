import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BarChart } from './bar-chart';
import { LineChart } from './line-chart';

const render = <T extends object>(cmp: new () => T, inputs: Record<string, unknown>) => { const f = TestBed.createComponent(cmp); for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v); f.detectChanges(); return f; };

describe('BarChart', () => {
  it('une barre par valeur non nulle, valeurs affichées, tableau de données alternatif', () => {
    const f = render(BarChart, { data: [{ label: 'janv.', value: 100 }, { label: 'févr.', value: 0 }, { label: 'mars', value: 50, kind: 'accent' }], format: (n: number) => `${n} DT`, short: (n: number) => `${n}` });
    const el = f.nativeElement as HTMLElement; expect(el.querySelectorAll('path.bar')).toHaveLength(3); expect(el.querySelectorAll('path.bar.accent')).toHaveLength(1);
    expect(el.querySelectorAll('.val')).toHaveLength(2); // pas de valeur sur une barre vide
    expect(el.querySelectorAll('details.data tr')).toHaveLength(3); expect(el.querySelector('svg')?.getAttribute('role')).toBe('img');
  });
  it('légende présente dès que deux catégories de couleur coexistent', () => {
    const f = render(BarChart, { data: [{ label: 'a', value: 1 }, { label: 'b', value: 2, kind: 'accent' }], legendLabels: { primary: 'Clôturés', accent: 'En cours' } });
    expect((f.nativeElement as HTMLElement).querySelector('.legend')?.textContent).toContain('En cours');
  });
  it('aucune donnée : pas d’erreur, échelle neutre', () => { const f = render(BarChart, { data: [] }); expect((f.nativeElement as HTMLElement).querySelectorAll('path.bar')).toHaveLength(0); });
});

describe('LineChart', () => {
  it('une courbe par série, légende si plusieurs séries, point survolé reflété dans l’infobulle', () => {
    const f = render(LineChart, { series: [{ label: 'Période', points: [{ label: 'j1', value: 10 }, { label: 'j2', value: 30 }], tone: 'primary' }, { label: 'Précédente', points: [{ label: 'j1', value: 5 }, { label: 'j2', value: 8 }], tone: 'muted' }], format: (n: number) => `${n} DT` });
    const el = f.nativeElement as HTMLElement; expect(el.querySelectorAll('path.line')).toHaveLength(2); expect(el.querySelector('path.line.muted')).toBeTruthy(); expect(el.querySelector('.legend')?.textContent).toContain('Précédente');
    f.componentInstance.hover.set(1); f.detectChanges(); expect(el.querySelector('.tip')?.textContent).toContain('30 DT');
  });
  it('valeurs négatives : l’axe inclut le zéro', () => {
    const f = render(LineChart, { series: [{ label: 'Flux', points: [{ label: 'a', value: -20 }, { label: 'b', value: 40 }] }] }); expect((f.nativeElement as HTMLElement).querySelectorAll('.ytick').length).toBe(3);
  });
});
