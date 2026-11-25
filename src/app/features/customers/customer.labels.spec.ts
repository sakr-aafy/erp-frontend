import { describe, expect, it } from 'vitest';
import { STATUS_CHIP, STATUS_LABEL, formatBytes, txStatus } from './customer.labels';

describe('libellés de la fiche client', () => {
  it('les quatre statuts ont un libellé et une couleur', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['active', 'archived', 'blocked', 'inactive']);
    expect(STATUS_LABEL['blocked']).toBe('Bloqué'); expect(STATUS_CHIP['blocked']).toBe('danger'); expect(STATUS_CHIP['active']).toBe('ok');
  });
  it('une facture validée affiche son état de paiement ; les autres documents leur statut', () => {
    expect(txStatus({ kind: 'invoice', status: 'validated', paymentStatus: 'partial' })).toEqual({ label: 'Partiellement payée', chip: 'warn' });
    expect(txStatus({ kind: 'invoice', status: 'validated', paymentStatus: 'paid' }).chip).toBe('ok');
    expect(txStatus({ kind: 'invoice', status: 'draft', paymentStatus: 'unpaid' }).label).toBe('Brouillon');
    expect(txStatus({ kind: 'quotation', status: 'accepted', paymentStatus: null })).toEqual({ label: 'Accepté', chip: 'ok' });
    expect(txStatus({ kind: 'quotation', status: 'refused', paymentStatus: null }).chip).toBe('danger');
  });
  it('taille de fichier lisible', () => { expect(formatBytes(512)).toBe('512 o'); expect(formatBytes(2048)).toBe('2.0 Ko'); expect(formatBytes(5 * 1048576)).toBe('5.0 Mo'); });
});
