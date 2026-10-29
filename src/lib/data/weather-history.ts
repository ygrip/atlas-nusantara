import { assetUrl } from '$lib/pwa/assets';
import { loadSavedSnapshot } from './saved-snapshot';
import { isWeatherHistory, type WeatherHistory } from './weather-history-contract';
import { isForecastSnapshot, type ForecastSnapshot } from '$lib/map/weather';
export * from './weather-history-contract';

let pendingHistory: Promise<WeatherHistory | undefined> | undefined;
let pendingForecast: Promise<ForecastSnapshot | undefined> | undefined;

/** Reads the dated history file once per page; a failed read is retried on the next call. */
export function loadWeatherHistory(): Promise<WeatherHistory | undefined> {
  if (!pendingHistory) {
    const request = loadSavedSnapshot(assetUrl('/data/weather/history.json'), isWeatherHistory);
    pendingHistory = request;
    request.then(value => { if (!value) pendingHistory = undefined; }, () => { pendingHistory = undefined; });
  }
  return pendingHistory;
}

/** The forecast the map already fetched, shared with the weather panel so it is not downloaded twice per view. */
export function loadCurrentForecast(): Promise<ForecastSnapshot | undefined> {
  if (!pendingForecast) {
    const request = loadSavedSnapshot(assetUrl('/data/weather/forecast.json'), isForecastSnapshot);
    pendingForecast = request;
    request.then(value => { if (!value) pendingForecast = undefined; }, () => { pendingForecast = undefined; });
  }
  return pendingForecast;
}
