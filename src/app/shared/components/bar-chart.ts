import { Component, computed, input, signal } from '@angular/core';

export interface BarDatum { label: string; value: number; /** `accent` = jaune (catégorie mise en avant, toujours libellée). */ kind?: 'primary' | 'accent' }

/**
 * Histogramme sobre (SVG) aux deux couleurs de marque. Règles de lisibilité : barres fines ancrées sur la ligne de base (coins arrondis en tête),
 * grille discrète, valeurs affichées sur chaque barre (le jaune seul ne suffit pas : contraste 1,7:1), légende explicite, infobulle au survol et
 * tableau de données alternatif (accessibilité).
 */
@Component({
  selector: 'app-bar-chart',
  template: `
    <div class="wrap">
      @if (legend().length > 1) {<div class="legend">@for (l of legend(); track l.kind) {<span><i [class]="l.kind"></i>{{ l.label }}</span>}</div>}
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()" preserveAspectRatio="xMidYMid meet" (mouseleave)="hover.set(-1)">
        @for (t of ticks(); track t.y) {<line [attr.x1]="PL" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" /><text [attr.x]="PL - 8" [attr.y]="t.y + 4" class="ytick" text-anchor="end">{{ t.label }}</text>}
        @for (b of bars(); track $index) {
          <g (mouseenter)="hover.set($index)" (focus)="hover.set($index)" tabindex="0" [attr.aria-label]="b.label + ' : ' + format()(b.value)">
            <rect [attr.x]="b.x - 6" [attr.y]="PT" [attr.width]="b.w + 12" [attr.height]="H - PT - PB" fill="transparent" />
            <path [attr.d]="b.path" [class]="'bar ' + b.kind" [class.dim]="hover() >= 0 && hover() !== $index" />
            @if (b.h > 0 && data().length <= 14) {<text [attr.x]="b.x + b.w / 2" [attr.y]="b.y - 6" text-anchor="middle" class="val">{{ b.short }}</text>}
            @if ($index % labelEvery() === 0) {<text [attr.x]="b.x + b.w / 2" [attr.y]="H - 8" text-anchor="middle" class="xlab">{{ clip(b.label) }}</text>}
          </g>
        }
      </svg>
      @if (hover() >= 0 && bars()[hover()]; as b) {<div class="tip" [style.left.%]="(b.x + b.w / 2) / W * 100"><strong>{{ b.label }}</strong><span>{{ format()(b.value) }}</span></div>}
    </div>
    <details class="data"><summary>Voir les données</summary>
      <table><tbody>@for (d of data(); track $index) {<tr><th scope="row">{{ d.label }}</th><td>{{ format()(d.value) }}</td></tr>}</tbody></table></details>`,
  styles: `.wrap{position:relative}svg{width:100%;height:auto;display:block;overflow:visible}
    .grid{stroke:var(--border);stroke-width:1}.ytick,.xlab{fill:var(--muted);font-size:11px;font-family:var(--font)}.val{fill:var(--text-2);font-size:11px;font-weight:600;font-family:var(--font)}
    .bar{transition:opacity .15s,transform .15s}.bar.primary{fill:var(--brand)}.bar.accent{fill:var(--accent);stroke:var(--accent-hover);stroke-width:1}.bar.dim{opacity:.45}
    g:focus{outline:none}g:focus-visible .bar{stroke:var(--text);stroke-width:2}
    .legend{display:flex;gap:16px;font-size:12px;color:var(--text-2);margin-bottom:8px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
    .legend i.primary{background:var(--brand)}.legend i.accent{background:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-hover)}
    .tip{position:absolute;top:24px;transform:translateX(-50%);background:var(--text);color:#fff;border-radius:6px;padding:6px 10px;font-size:12px;display:flex;flex-direction:column;pointer-events:none;white-space:nowrap;box-shadow:var(--shadow-md)}
    .tip strong{font-weight:500;opacity:.8}details.data{margin-top:8px;font-size:12px;color:var(--muted)}summary{cursor:pointer}details table{margin-top:6px;border-collapse:collapse}
    details th{text-align:left;padding:2px 16px 2px 0;font-weight:400}details td{text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}`,
})
export class BarChart {
  data = input.required<BarDatum[]>();
  format = input<(n: number) => string>((n) => String(n));
  short = input<(n: number) => string>((n) => String(n));
  ariaLabel = input('Histogramme');
  legendLabels = input<{ primary: string; accent?: string }>({ primary: '' });
  readonly W = 600; readonly H = 230; readonly PL = 44; readonly PT = 22; readonly PB = 28;
  hover = signal(-1);
  labelEvery = computed(() => Math.max(1, Math.ceil(this.data().length / 10)));
  clip = (t: string) => (t.length > 14 ? t.slice(0, 13) + '…' : t);
  private max = computed(() => { const m = Math.max(0, ...this.data().map((d) => d.value)); if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; });
  ticks = computed(() => [0, 1, 2].map((i) => { const v = this.max() * i / 2; return { y: this.H - this.PB - (this.H - this.PB - this.PT) * i / 2, label: this.short()(v) }; }));
  legend = computed(() => { const k = new Set(this.data().map((d) => d.kind ?? 'primary')); const l = this.legendLabels(); return [...(k.has('primary') ? [{ kind: 'primary', label: l.primary }] : []), ...(k.has('accent') ? [{ kind: 'accent', label: l.accent ?? '' }] : [])]; });
  bars = computed(() => {
    const d = this.data(); const n = Math.max(d.length, 1); const slot = (this.W - this.PL) / n; const w = Math.min(44, slot * .56); const base = this.H - this.PB; const ch = base - this.PT;
    return d.map((x, i) => {
      const h = Math.max(0, x.value / this.max() * ch); const bx = this.PL + slot * i + (slot - w) / 2; const y = base - h; const r = Math.min(4, h, w / 2);
      const path = h <= 0 ? '' : `M${bx},${base} V${y + r} Q${bx},${y} ${bx + r},${y} H${bx + w - r} Q${bx + w},${y} ${bx + w},${y + r} V${base} Z`;
      return { ...x, kind: x.kind ?? 'primary', x: bx, w, h, y, path, short: this.short()(x.value) };
    });
  });
}
