export interface NiceScale {
  /** Top of the axis; the axis always starts at zero. */
  max: number;
  ticks: number[];
}

const STEP_FACTORS = [1, 2, 2.5, 5, 10];

/** Round tick spacing (1, 2, 2.5, 5 times a power of ten) so axis labels read cleanly. */
export function niceScale(largest: number, wantedTicks: number): NiceScale {
  if (!Number.isFinite(largest) || largest <= 0) return { max: 1, ticks: [0, 1] };
  const rawStep = largest / wantedTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const factor = STEP_FACTORS.find(candidate => candidate * magnitude >= rawStep) ?? 10;
  const step = factor * magnitude;
  const max = Math.ceil(largest / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return { max, ticks };
}
