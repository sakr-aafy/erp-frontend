import { Component, computed, input, signal } from '@angular/core';

export interface LineSeries { label: string; points: { label: string; value: number }[]; /** `muted` = gris neutre en pointillés (période de comparaison). */ tone?: 'primary' | 'accent' | 'muted' }

/**
 * Courbes sobres (SVG), 1 à 3 séries : bleu (principal), jaune (secondaire) ou gris pointillé (comparaison).
 * Légende toujours visible dès 2 séries, infobulle commune au survol, tableau de données alternatif (accessibilité).
 */
@Component({
  selector: 'app-line-chart',
  template: `
    <div class="wrap">
      @if (series().length > 1) {<div class="legend">@for (s of series(); track s.label) {<span><i [class]="tone(s, $index)"></i>{{ s.label }}</span>}</div>}
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()" (mouseleave)="hover.set(-1)">
        @for (t of ticks(); track t.y) {<line [attr.x1]="PL" [attr.x2]="W - 8" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" /><text [attr.x]="PL - 8" [attr.y]="t.y + 4" class="ytick" text-anchor="end">{{ t.label }}</text>}
        @for (l of xLabels(); track l.i) {<text [attr.x]="l.x" [attr.y]="H - 8" text-anchor="middle" class="xlab">{{ l.text }}</text>}
        @for (p of paths(); track p.label) {<path [attr.d]="p.d" [class]="'line ' + p.tone" fill="none" />}
        @if (hover() >= 0) {<line [attr.x1]="xAt(hover())" [attr.x2]="xAt(hover())" [attr.y1]="PT" [attr.y2]="H - PB" class="cursor" />
          @for (p of paths(); track p.label) {@if (p.pts[hover()]; as pt) {<circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4" [class]="'dot ' + p.tone" />}}}
        @for (x of xs(); track $index) {<rect [attr.x]="x - step() / 2" [attr.y]="PT" [attr.width]="step()" [attr.height]="H - PT - PB" fill="transparent" (mouseenter)="hover.set($index)" />}
      </svg>
      @if (hover() >= 0) {<div class="tip" [style.left.%]="xAt(hover()) / W * 100"><strong>{{ labels()[hover()] }}</strong>@for (s of series(); track s.label) {<span><i [class]="tone(s, $index)"></i>{{ s.label }} : {{ format()(s.points[hover()]?.value ?? 0) }}</span>}</div>}
    </div>
    <details class="data"><summary>Voir les données</summary>
      <table><thead><tr><th></th>@for (s of series(); track s.label) {<th>{{ s.label }}</th>}</tr></thead><tbody>
        @for (l of labels(); track $index) {<tr><th scope="row">{{ l }}</th>@for (s of series(); track s.label) {<td>{{ format()(s.points[$index]?.value ?? 0) }}</td>}</tr>}</tbody></table></details>`,
  styles: `.wrap{position:relative}svg{width:100%;height:auto;display:block;overflow:visible}.grid{stroke:var(--border)}.ytick,.xlab{fill:var(--muted);font-size:11px;font-family:var(--font)}
    .line{stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}.line.primary{stroke:var(--brand)}.line.accent{stroke:var(--accent)}.line.muted{stroke:var(--placeholder);stroke-dasharray:5 4;stroke-width:1.8}
    .cursor{stroke:var(--border-strong);stroke-dasharray:3 3}.dot{stroke:#fff;stroke-width:2}.dot.primary{fill:var(--brand)}.dot.accent{fill:var(--accent)}.dot.muted{fill:var(--placeholder)}
    .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text-2);margin-bottom:8px}i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
    i.primary{background:var(--brand)}i.accent{background:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-hover)}i.muted{background:var(--placeholder)}
    .tip{position:absolute;top:8px;transform:translateX(-50%);background:var(--text);color:#fff;border-radius:6px;padding:6px 10px;font-size:12px;display:flex;flex-direction:column;gap:2px;pointer-events:none;white-space:nowrap;box-shadow:var(--shadow-md);z-index:2}.tip strong{font-weight:500;opacity:.8}
    details.data{margin-top:8px;font-size:12px;color:var(--muted)}summary{cursor:pointer}details table{margin-top:6px;border-collapse:collapse}details th{text-align:left;padding:2px 16px 2px 0;font-weight:400}details thead th{font-weight:500}details td{text-align:right;padding-right:16px;font-variant-numeric:tabular-nums;color:var(--text)}`,
})
export class LineChart {
  series = input.required<LineSeries[]>();
  format = input<(n: number) => string>((n) => String(n));
  short = input<(n: number) => string>((n) => String(n));
  ariaLabel = input('Courbe');
  readonly W = 600; readonly H = 230; readonly PL = 46; readonly PT = 16; readonly PB = 28;
  hover = signal(-1);
  tone = (s: LineSeries, i: number) => s.tone ?? (i === 0 ? 'primary' : 'accent');
  labels = computed(() => this.series()[0]?.points.map((p) => p.label) ?? []);
  private n = computed(() => Math.max(this.labels().length, 1));
  step = computed(() => (this.W - this.PL - 8) / this.n());
  xAt = (i: number) => this.PL + this.step() * (i + 0.5);
  xs = computed(() => this.labels().map((_, i) => this.xAt(i)));
  private max = computed(() => { const m = Math.max(0, ...this.series().flatMap((s) => s.points.map((p) => p.value))); if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; });
  private min = computed(() => Math.min(0, ...this.series().flatMap((s) => s.points.map((p) => p.value))));
  private y = (v: number) => { const lo = this.min(); const hi = this.max(); return this.H - this.PB - ((v - lo) / (hi - lo || 1)) * (this.H - this.PB - this.PT); };
  ticks = computed(() => [0, 1, 2].map((i) => { const v = this.min() + (this.max() - this.min()) * i / 2; return { y: this.y(v), label: this.short()(v) }; }));
  xLabels = computed(() => { const every = Math.max(1, Math.ceil(this.labels().length / 8)); return this.labels().map((text, i) => ({ i, text, x: this.xAt(i) })).filter((l) => l.i % every === 0); });
  paths = computed(() => this.series().map((s, k) => { const pts = s.points.map((p, i) => ({ x: this.xAt(i), y: this.y(p.value) })); return { label: s.label, tone: this.tone(s, k), pts, d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') }; }));
}
