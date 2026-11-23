import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV } from '../../core/layout/nav.config';
import { hasIcon } from './icon';

const root = join(process.cwd(), 'src', 'app');
const sources = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? sources(p) : /\.(ts|html)$/.test(f) && !/\.spec\.ts$/.test(f) ? [p] : []; });

describe('jeu d’icônes', () => {
  it('chaque icône du menu existe (aucune icône de repli dans la navigation)', () => {
    for (const g of NAV) { expect(hasIcon(g.icon), `groupe ${g.title}`).toBe(true); for (const i of g.items) expect(hasIcon(i.icon), `${g.title} › ${i.label} (${i.icon})`).toBe(true); }
  });
  it('chaque icône référencée dans le code (balises, configurations de listes, actions) est définie', () => {
    const missing = new Set<string>(); const files = sources(root); expect(files.length).toBeGreaterThan(60); // le balayage couvre bien le code
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/<app-icon[^>]*\sname="([a-z_0-9]+)"/g)) if (!hasIcon(m[1]!)) missing.add(`${m[1]} (${f.replace(root, '')})`);
      for (const m of text.matchAll(/\b(?:icon|emptyIcon)\s*[=:]\s*["']([a-z_0-9]+)["']/g)) if (!hasIcon(m[1]!)) missing.add(`${m[1]} (${f.replace(root, '')})`);
    }
    expect([...missing]).toEqual([]);
  });
});
