import { assetUrl } from '$lib/pwa/assets';
import { loadSavedSnapshot } from './saved-snapshot';
import { isWeatherHistory, type WeatherHistory } from './weather-history-contract';
import { loadForecast, type ForecastSnapshot } from '$lib/map/weather';
export * from './weather-history-contract';

let pendingHistory: Promise<WeatherHistory | undefined> | undefined;
/** Reads the dated history file once per page; a failed read is retried on the next call. */
export function loadWeatherHistory(): Promise<WeatherHistory | undefined> {
  if (!pendingHistory) {
    const request = loadSavedSnapshot(assetUrl('/data/weather/history.json'), isWeatherHistory);
    pendingHistory = request;
    request.then(value => { if (!value) pendingHistory = undefined; }, () => { pendingHistory = undefined; });
  }
  return pendingHistory;
}

/** The forecast the map already fetched, shared so it is downloaded once per view. */
export function loadCurrentForecast(): Promise<ForecastSnapshot | undefined> {
  return loadForecast(assetUrl('/data/weather/forecast.json'));
}
