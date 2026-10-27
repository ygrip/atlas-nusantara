export interface PlaceOption {
  code: string;
  name: string;
  level: 'province' | 'city';
  parentName?: string;
}

function fold(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** 0 = best. Name starts with the query, then a word starts with it, then it appears anywhere, then parent or code. */
function matchRank(option: PlaceOption, query: string): number | undefined {
  const name = fold(option.name);
  if (name.startsWith(query)) return 0;
  if (name.split(/[\s\-/]+/).some(word => word.startsWith(query))) return 1;
  if (name.includes(query)) return 2;
  if (option.code.startsWith(query)) return 3;
  if (option.parentName && fold(option.parentName).includes(query)) return 4;
  return undefined;
}

/** Provinces before cities within the same rank; an empty query lists everything in directory order. */
export function searchPlaces(options: PlaceOption[], rawQuery: string): PlaceOption[] {
  const query = fold(rawQuery);
  if (query.length === 0) return options;
  const ranked: { option: PlaceOption; rank: number }[] = [];
  for (const option of options) {
    const rank = matchRank(option, query);
    if (rank !== undefined) ranked.push({ option, rank });
  }
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.option.level !== b.option.level) return a.option.level === 'province' ? -1 : 1;
    return a.option.name.localeCompare(b.option.name);
  });
  return ranked.map(item => item.option);
}
