import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { confirm } from '../components/confirm-dialog';

export interface HasUnsavedChanges { hasUnsavedChanges(): boolean }

/** Protège contre la perte des modifications non enregistrées : demande confirmation avant de quitter un formulaire modifié. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) return true;
  return confirm(inject(MatDialog), { title: 'Quitter sans enregistrer ?', message: 'Les modifications non enregistrées seront perdues.', confirmLabel: 'Quitter sans enregistrer', danger: true });
};
