import type { Coordinates } from '../atlas/region-coordinates.ts';
import type { MapPin, PointOverlay } from '../map/overlay-contract.ts';
import type { ForecastSnapshot } from '../map/weather.ts';
import { summariseWeather } from '../map/weather-summary.ts';
import type { ExportDataset, ExportValue } from './map-export.ts';

const COORDINATE_DIGITS = 5;

function roundDegrees(value: number): number {
  return Number(value.toFixed(COORDINATE_DIGITS));
}

export interface ExportRegion {
  code: string;
  name: string;
  level: 'province' | 'city-regency';
  parentCode?: string;
  parentName?: string;
}

export interface RegionDatasetInput {
  layer: string;
  title: string;
  scope: string;
  generatedAt: string;
  regions: ExportRegion[];
  coordinates: (code: string) => Coordinates | undefined;
  /** Present on the weather layer: adds the forecast columns. */
  forecast?: ForecastSnapshot;
  forecastTime?: string;
}

const REGION_COLUMNS = ['code', 'name', 'level', 'parent_code', 'parent_name', 'latitude', 'longitude'];
const WEATHER_COLUMNS = ['weather', 'temperature_c', 'humidity_pct', 'cloud_cover_pct', 'wind_speed_kmh', 'wind_from', 'forecast_time'];

function regionRow(region: ExportRegion, input: RegionDatasetInput): Record<string, ExportValue> {
  const coordinates = input.coordinates(region.code);
  const row: Record<string, ExportValue> = {
    code: region.code,
    name: region.name,
    level: region.level,
    parent_code: region.parentCode ?? null,
    parent_name: region.parentName ?? null,
    latitude: coordinates ? roundDegrees(coordinates.lat) : null,
    longitude: coordinates ? roundDegrees(coordinates.lon) : null
  };
  if (!input.forecast) return row;
  const summary = summariseWeather(input.forecast, region.code, input.forecastTime);
  row.weather = summary?.description ?? null;
  row.temperature_c = summary?.temperature ?? null;
  row.humidity_pct = summary?.humidity ?? null;
  row.cloud_cover_pct = summary?.clouds ?? null;
  row.wind_speed_kmh = summary?.speed ?? null;
  row.wind_from = summary?.from ?? null;
  row.forecast_time = input.forecastTime ?? null;
  return row;
}

/** Provinces or cities of the current map level, with coordinates and, on the weather layer, the forecast. */
export function regionDataset(input: RegionDatasetInput): ExportDataset {
  const ids = [...REGION_COLUMNS];
  if (input.forecast) ids.push(...WEATHER_COLUMNS);
  const dataset: ExportDataset = {
    layer: input.layer,
    title: input.title,
    scope: input.scope,
    generatedAt: input.generatedAt,
    columns: ids.map(id => ({ id })),
    rows: input.regions.map(region => regionRow(region, input))
  };
  if (input.forecast) {
    dataset.source = input.forecast.source;
    dataset.sourceUrl = input.forecast.sourceUrl;
    dataset.attribution = input.forecast.attribution;
    dataset.dataTime = input.forecastTime ?? input.forecast.fetchedAt;
  }
  return dataset;
}

function pinRow(pin: MapPin): Record<string, ExportValue> {
  return {
    id: pin.id,
    name: pin.label,
    latitude: roundDegrees(pin.lat),
    longitude: roundDegrees(pin.lon),
    category: pin.category ?? null,
    value: pin.value ?? null,
    description: pin.description ?? null,
    province_code: pin.provinceCode ?? null,
    source_url: pin.sourceUrl ?? null
  };
}

/** Every pin of a point layer (earthquakes, mountains, reports, destinations...) with the layer's source details. */
export function pinDataset(overlay: PointOverlay, title: string, scope: string, generatedAt: string): ExportDataset {
  const ids = ['id', 'name', 'latitude', 'longitude', 'category', 'value', 'description', 'province_code', 'source_url'];
  const dataset: ExportDataset = {
    layer: overlay.id,
    title,
    scope,
    generatedAt,
    source: overlay.source,
    dataTime: overlay.fetchedAt,
    columns: ids.map(id => ({ id })),
    rows: overlay.pins.map(pinRow)
  };
  if (overlay.sourceUrl) dataset.sourceUrl = overlay.sourceUrl;
  if (overlay.attribution) dataset.attribution = overlay.attribution;
  return dataset;
}
