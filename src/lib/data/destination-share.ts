import { m } from '$lib/i18n/messages';
import type { Landmark } from './destination-contract';
import type { ShareDestination } from '$lib/share/card';

function kindLabel(place: Landmark): string {
  if (place.kind === 'natural') return m.destination_natural();
  if (place.kind === 'built') return m.destination_built();
  return m.layer_destinations();
}

/** "Kabupaten Bondowoso, Jawa Timur": the district when the source names one, then the province. */
export function destinationLocation(place: Landmark, provinceName: string | undefined): string {
  const parts = [place.sourceDistrict?.trim(), provinceName?.trim()];
  return parts.filter((part): part is string => Boolean(part)).join(', ');
}

/** Licensed photos come first; an unverified web result is used only when no licensed photo exists, as in the table. */
function shareablePhoto(place: Landmark): { url: string; credit?: string } | undefined {
  const licensed = place.images?.[0] ?? place.image;
  if (licensed) return { url: licensed.url, credit: licensed.credit + ' · ' + licensed.license };
  const web = place.webImages?.[0];
  if (web) return { url: web };
  return undefined;
}

export function shareDestinationFor(place: Landmark, provinceName: string | undefined): ShareDestination {
  const photo = shareablePhoto(place);
  return {
    id: place.id,
    name: place.name,
    location: destinationLocation(place, provinceName),
    kindLabel: kindLabel(place),
    imageUrl: photo?.url,
    credit: photo?.credit
  };
}
