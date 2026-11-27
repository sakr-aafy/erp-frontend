import { Directive, ElementRef, HostListener, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** « 1,5 », « 1.5 » ou « 1 234,5 » (saisie ou collage) → nombre ; vide → null ; texte non numérique → NaN (refusé par les validateurs). */
export function parseDecimal(text: string): number | null {
  const t = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (!t) return null;
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : Number.NaN;
}
export const formatDecimal = (v: unknown) => (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? '' : String(v).replace('.', ','));

/** Champ décimal à la française : accepte la virgule comme le point, sans jamais arrondir ce qui est saisi. */
@Directive({
  selector: 'input[appDecimal]',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DecimalInput), multi: true }],
  host: { type: 'text', inputmode: 'decimal', autocomplete: 'off' },
})
export class DecimalInput implements ControlValueAccessor {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private changed: (v: number | null) => void = () => undefined; private touched: () => void = () => undefined;
  writeValue(v: unknown) {
    const input = this.el.nativeElement;
    // La saisie en cours (« 1, ») n'est pas réécrite quand elle représente déjà la même valeur
    if (parseDecimal(input.value) !== v) input.value = formatDecimal(v);
  }
  registerOnChange(fn: (v: number | null) => void) { this.changed = fn; }
  registerOnTouched(fn: () => void) { this.touched = fn; }
  setDisabledState(disabled: boolean) { this.el.nativeElement.disabled = disabled; }
  @HostListener('input') onInput() { this.changed(parseDecimal(this.el.nativeElement.value)); }
  @HostListener('blur') onBlur() { this.touched(); }
}
