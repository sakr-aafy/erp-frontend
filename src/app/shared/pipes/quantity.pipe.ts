import { Pipe, PipeTransform } from '@angular/core';
import { formatDecimal } from '../directives/decimal-input.directive';

/** {{ quantite | qty }} — quantité ou taux affiché avec la virgule décimale française, sans arrondi. */
@Pipe({ name: 'qty' })
export class QtyPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return formatDecimal(value); }
}
