/**
 * Deep-water wave spectrum for the sea shader. Wavelengths are in map units, not metres: the map is a
 * presentation scale, so the swell is tuned to read at that scale. Headings are offsets from the wind direction.
 * Steepness is k·A for each train; the sum stays below 1 so the surface never folds through itself.
 */
export interface WaveTrain {
  heading: number;
  wavelength: number;
  steepness: number;
}

export const WAVE_TRAINS: readonly WaveTrain[] = [
  { heading: 0, wavelength: 140, steepness: 0.06 },
  { heading: 0.4, wavelength: 87, steepness: 0.065 },
  { heading: -0.3, wavelength: 54, steepness: 0.08 },
  { heading: 0.66, wavelength: 33.5, steepness: 0.09 },
  { heading: -0.54, wavelength: 20.8, steepness: 0.09 },
  { heading: 0.21, wavelength: 12.9, steepness: 0.085 },
  { heading: -0.86, wavelength: 8, steepness: 0.07 },
  { heading: 1.12, wavelength: 5, steepness: 0.06 }
];

const GRAVITY = 9.8;
/** Slows the real dispersion relation so the swell moves calmly at map scale. */
const SPEED_SCALE = 0.4;
const TWO_PI = Math.PI * 2;

export const MAX_STEEPNESS_SUM = 0.95;

function angularFrequency(train: WaveTrain): number {
  const wavenumber = TWO_PI / train.wavelength;
  return Math.sqrt(GRAVITY * wavenumber) * SPEED_SCALE;
}

/** Phase of each train at `elapsed` seconds, wrapped to [0, 2π) in double precision before it reaches float32 shaders. */
export function wavePhasesAt(elapsed: number, target: Float32Array): Float32Array {
  WAVE_TRAINS.forEach((train, index) => {
    const phase = (angularFrequency(train) * elapsed) % TWO_PI;
    target[index] = phase;
  });
  return target;
}

function glslFloat(value: number): string {
  return value.toFixed(4);
}

/** GLSL declarations generated from the same table so shader and CPU can never disagree. */
export function waveGlsl(): string {
  const steepnessSum = WAVE_TRAINS.reduce((sum, train) => sum + train.steepness, 0);
  if (steepnessSum >= MAX_STEEPNESS_SUM) throw Error('Wave steepness must sum below ' + MAX_STEEPNESS_SUM);
  const amplitudeSum = WAVE_TRAINS.reduce((sum, train) => sum + (train.steepness * train.wavelength) / TWO_PI, 0);
  const entries = WAVE_TRAINS.map(train => `vec3(${glslFloat(train.heading)}, ${glslFloat(train.wavelength)}, ${glslFloat(train.steepness)})`);
  const count = WAVE_TRAINS.length;
  return `
    const int WAVE_COUNT = ${count};
    const float AMPLITUDE_SUM = ${glslFloat(amplitudeSum)};
    const vec3 WAVES[${count}] = vec3[${count}](${entries.join(', ')});
    uniform float wavePhase[${count}];
  `;
}

export function waveCount(): number {
  return WAVE_TRAINS.length;
}
