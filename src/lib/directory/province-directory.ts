import { loadRegions, type Region } from '$lib/atlas/regions';
import { ADMIN_DATA_PATH, isMunicipality } from '$lib/atlas/edition';
import { ISLAND_GROUPS, islandGroupOf, type IslandGroup } from '$lib/atlas/islands';

/** One province with its kabupaten (regencies) and kota (municipalities), shared by the table and the charts. */
export interface ProvinceRow {
  code: string;
  name: string;
  group: IslandGroup;
  regencies: Region[];
  municipalities: Region[];
  total: number;
}

export interface GroupTotals {
  group: IslandGroup;
  provinces: number;
  regencies: number;
  municipalities: number;
  total: number;
}

export function buildRows(provinces: Region[], cities: Region[]): ProvinceRow[] {
  return provinces.map(province => {
    const children = cities.filter(region => region.parentCode === province.code);
    const municipalities = children.filter(region => isMunicipality(region.name));
    const regencies = children.filter(region => !isMunicipality(region.name));
    return {
      code: province.code,
      name: province.name,
      group: islandGroupOf(province.code),
      regencies,
      municipalities,
      total: children.length
    };
  });
}

export function totalsByGroup(rows: ProvinceRow[]): GroupTotals[] {
  return ISLAND_GROUPS.map(group => {
    const members = rows.filter(row => row.group === group);
    const regencies = members.reduce((sum, row) => sum + row.regencies.length, 0);
    const municipalities = members.reduce((sum, row) => sum + row.municipalities.length, 0);
    return { group, provinces: members.length, regencies, municipalities, total: regencies + municipalities };
  });
}

let pending: Promise<ProvinceRow[]> | undefined;

async function fetchRows(): Promise<ProvinceRow[]> {
  const [provinces, cities] = await Promise.all([
    loadRegions(ADMIN_DATA_PATH + '/provinces.json'),
    loadRegions(ADMIN_DATA_PATH + '/cities.json')
  ]);
  return buildRows(provinces.regions, cities.regions);
}

/** Loads the directory once per page view; a failed load is retried on the next call. */
export function loadProvinceDirectory(): Promise<ProvinceRow[]> {
  if (pending) return pending;
  const request = fetchRows();
  pending = request;
  request.catch(() => {
    if (pending === request) pending = undefined;
  });
  return request;
}
