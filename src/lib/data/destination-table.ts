export type DestinationSortKey = 'name' | 'kind' | 'district';
export type DestinationSortDirection = 'ascending' | 'descending';
export type DestinationImageFilter = 'all' | 'with-image' | 'without-image';

export interface DestinationTableRecord {
  id: string;
  name: string;
  kind: string;
  image?: unknown;
  images?: readonly unknown[];
  webImages?: readonly string[];
  sourceDistrict?: string;
  officialId?: string;
}

export interface DestinationPage<T> {
  items: T[];
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
}

export function filterDestinations<T extends DestinationTableRecord>(
  records: readonly T[],
  options: { query?: string; kind?: string; district?: string; image?: DestinationImageFilter }
): T[] {
  const query = normalize(options.query ?? '');
  return records.filter(record => {
    const district = normalize(record.sourceDistrict ?? '');
    const searchable = normalize([record.name, record.sourceDistrict ?? '', record.officialId ?? '', record.id].join(' '));
    if (query && !searchable.includes(query)) return false;
    if (options.kind && options.kind !== 'all' && record.kind !== options.kind) return false;
    if (options.district && district !== normalize(options.district)) return false;
    const hasImage = Boolean(record.image) || Boolean(record.images?.length) || Boolean(record.webImages?.length);
    if (options.image === 'with-image' && !hasImage) return false;
    if (options.image === 'without-image' && hasImage) return false;
    return true;
  });
}

export function sortDestinations<T extends DestinationTableRecord>(
  records: readonly T[], key: DestinationSortKey, direction: DestinationSortDirection, locale: string
): T[] {
  let multiplier = 1;
  if (direction === 'descending') multiplier = -1;
  return records.map((record, index) => ({ record, index })).sort((left, right) => {
    let comparison = 0;
    if (key === 'district') comparison = (left.record.sourceDistrict ?? '').localeCompare(right.record.sourceDistrict ?? '', locale, { sensitivity: 'base' });
    else comparison = String(left.record[key]).localeCompare(String(right.record[key]), locale, { sensitivity: 'base' });
    if (comparison !== 0) return comparison * multiplier;
    comparison = left.record.id.localeCompare(right.record.id, 'en', { numeric: true });
    if (comparison !== 0) return comparison;
    return left.index - right.index;
  }).map(item => item.record);
}

export function paginateDestinations<T>(records: readonly T[], requestedPage: number, pageSize: number): DestinationPage<T> {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) throw new RangeError('Page size must be a positive integer');
  const total = records.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  let desiredPage = 0;
  if (Number.isFinite(requestedPage)) desiredPage = Math.floor(requestedPage);
  const page = Math.min(pageCount - 1, Math.max(0, desiredPage));
  const offset = page * pageSize;
  let start = 0;
  if (total > 0) start = offset + 1;
  return { items: records.slice(offset, offset + pageSize), page, pageCount, start, end: Math.min(offset + pageSize, total), total };
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}
