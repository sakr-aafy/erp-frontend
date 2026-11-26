import { Component, input } from '@angular/core';
import { AddressSnapshot } from '../models/api.models';
import { Icon } from './icon';
import { PhoneLink } from './phone-link';

export const addressLine = (a: { postalCode?: string | null; city?: string | null; country?: string | null }) => [[a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ');

/** Corps d'une adresse (référentiel ou copie d'un document) : adresse, ville et pays, contact, carte, instructions. */
@Component({
  selector: 'app-address-body',
  imports: [Icon, PhoneLink],
  template: `
    <p class="line">{{ a().street }}</p>
    @if (place()) {<p class="line muted">{{ place() }}</p>}
    @if (a().contactName || a().contactPhone) {<p class="row"><app-icon name="person" /><span>{{ a().contactName }}</span><app-phone [info]="a().contactPhoneInfo" [value]="a().contactPhone" /></p>}
    @if (a().mapsUrl) {<p class="row"><app-icon name="place" /><a [href]="a().mapsUrl" target="_blank" rel="noopener noreferrer">Voir sur Google Maps <app-icon name="open_in_new" class="ext" /></a></p>}
    @if (a().instructions) {<p class="row note"><app-icon name="info" /><span>{{ a().instructions }}</span></p>}`,
  styles: `:host{display:block;min-width:0;overflow-wrap:anywhere}p{margin:0}.line+.line{margin-top:2px}.row{display:flex;gap:8px;align-items:flex-start;margin-top:8px;flex-wrap:wrap}
    .row>app-icon{color:var(--brand);margin-top:2px}.ext{--icon-size:.875rem}.note{color:var(--text-2);font-size:13px;flex-wrap:nowrap;white-space:pre-wrap}`,
})
export class AddressBody {
  a = input.required<Omit<AddressSnapshot, 'addressId'>>();
  place = () => addressLine(this.a());
}
