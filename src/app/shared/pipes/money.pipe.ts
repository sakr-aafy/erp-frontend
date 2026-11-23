import { Pipe, PipeTransform, inject } from '@angular/core';
import { ReferenceDataService } from '../../core/services/reference-data.service';

/** {{ montantMinor | money }} — formate un entier (plus petite unité) selon la devise de base. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private ref = inject(ReferenceDataService);
  transform(minor: number | null | undefined): string { this.ref.data(); return this.ref.format(minor); }
}
