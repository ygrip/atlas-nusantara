export type ThemeName = 'light' | 'dark';

/** Every colour the 3D atlas needs, as sRGB hex. Lighting multipliers apply to the sun colour. */
export interface MapTheme {
  /** Colour of empty space and its nebula tint. */
  space: string;
  nebula: string;
  starBrightness: number;
  /** Atmosphere glow at the limb and the haze colour of distant water. */
  halo: string;
  haze: string;
  skyZenith: string;
  skyHorizon: string;
  sun: string;
  sunIntensity: number;
  skyLight: string;
  groundLight: string;
  shallow: string;
  mid: string;
  deep: string;
  scatter: string;
  foam: string;
  sand: string;
  border: string;
  cityBorder: string;
  cloudLit: string;
  cloudShade: string;
  storm: string;
}

export const THEMES: Record<ThemeName, MapTheme> = {
  light: {
    space: '#060c20', nebula: '#1c2d6b', starBrightness: 0.9,
    halo: '#79c3ff', haze: '#a6cfe8', skyZenith: '#3f86d6', skyHorizon: '#c3e2f5',
    sun: '#fff0d2', sunIntensity: 1.25, skyLight: '#d3e6ff', groundLight: '#9a8a6e',
    shallow: '#4fd2c6', mid: '#1f8fba', deep: '#093866', scatter: '#35e3c2', foam: '#f6fbfc',
    sand: '#e9d7a9', border: '#fffaf0', cityBorder: '#4a3a2e',
    cloudLit: '#ffffff', cloudShade: '#a9b6c9', storm: '#4b515f'
  },
  dark: {
    space: '#02030a', nebula: '#16205a', starBrightness: 1.15,
    halo: '#3d68d0', haze: '#0e1b36', skyZenith: '#050b1c', skyHorizon: '#16294f',
    sun: '#a9bdff', sunIntensity: 0.45, skyLight: '#6179b4', groundLight: '#2b2b3b',
    shallow: '#1f8f8c', mid: '#103f68', deep: '#041429', scatter: '#1b9a90', foam: '#cde0ea',
    sand: '#8f7d62', border: '#f1e9df', cityBorder: '#1b1714',
    cloudLit: '#8e9ab8', cloudShade: '#3a435b', storm: '#1f232d'
  }
};
