import type { PinSymbol } from './overlay-contract';

/** Every clay marker is drawn on this square canvas, so SVG and WebGL markers share one source. */
export const CLAY_PIN_VIEWBOX = 64;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_COLOR = '#8a7f78';

/** Shape outlines, drawn on the 64 x 64 canvas and thickened by a round-joined stroke to look soft. */
const OUTLINES: Record<PinSymbol, string> = {
  circle: '<circle cx="32" cy="30" r="17"/>',
  triangle: '<polygon points="32,13 50,46 14,46"/>',
  diamond: '<polygon points="32,11 51,30 32,49 13,30"/>'
};

/** Soft highlight blob sitting on the upper-left of the shape, where a clay surface catches light. */
const HIGHLIGHTS: Record<PinSymbol, { cx: number; cy: number; rx: number; ry: number; angle: number }> = {
  circle: { cx: 24, cy: 21, rx: 7, ry: 4.5, angle: -35 },
  triangle: { cx: 28, cy: 33, rx: 5.5, ry: 3.5, angle: -60 },
  diamond: { cx: 24.5, cy: 23, rx: 6, ry: 3.8, angle: -45 }
};

export function safeClayColor(color: string): string {
  if (HEX_COLOR.test(color)) return color.toLowerCase();
  return FALLBACK_COLOR;
}

/** Blends a colour towards white (amount > 0) or black (amount < 0). */
export function shadeColor(color: string, amount: number): string {
  const hex = safeClayColor(color).slice(1);
  const target = amount < 0 ? 0 : 255;
  const weight = Math.abs(amount);
  let result = '#';
  for (let channel = 0; channel < 3; channel++) {
    const value = parseInt(hex.slice(channel * 2, channel * 2 + 2), 16);
    const mixed = Math.round(value + (target - value) * weight);
    result += mixed.toString(16).padStart(2, '0');
  }
  return result;
}

/** Stable key for a distinct marker look: one cached drawing per key. */
export function clayPinKey(symbol: PinSymbol, color: string): string {
  return symbol + ':' + safeClayColor(color);
}

/**
 * The clay marker as SVG elements (no wrapping <svg>). `id` must be unique in the document because
 * the gradient is referenced by id.
 */
export function clayPinInner(symbol: PinSymbol, color: string, id: string): string {
  const base = safeClayColor(color);
  const light = shadeColor(base, 0.55);
  const dark = shadeColor(base, -0.38);
  const outline = OUTLINES[symbol];
  const shine = HIGHLIGHTS[symbol];
  const gradient = `clay-body-${id}`;
  return [
    `<defs><radialGradient id="${gradient}" cx="34%" cy="26%" r="82%">`,
    `<stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/>`,
    '</radialGradient></defs>',
    // Contact shadow, then the darker rim that gives the lump its thickness.
    '<ellipse cx="32" cy="53" rx="15" ry="4.2" fill="#2b1d1a" opacity="0.22"/>',
    `<g fill="${dark}" stroke="${dark}" stroke-width="9" stroke-linejoin="round" transform="translate(0 2.2)">${outline}</g>`,
    `<g fill="url(#${gradient})" stroke="url(#${gradient})" stroke-width="6" stroke-linejoin="round">${outline}</g>`,
    `<ellipse cx="${shine.cx}" cy="${shine.cy}" rx="${shine.rx}" ry="${shine.ry}" fill="#ffffff" opacity="0.6" transform="rotate(${shine.angle} ${shine.cx} ${shine.cy})"/>`,
    `<ellipse cx="${shine.cx + shine.rx + 4}" cy="${shine.cy + shine.ry + 4}" rx="1.6" ry="1.6" fill="#ffffff" opacity="0.5"/>`
  ].join('');
}

/** A standalone SVG document, used to rasterise the marker into the WebGL pin atlas. */
export function clayPinDocument(symbol: PinSymbol, color: string, pixels: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${CLAY_PIN_VIEWBOX} ${CLAY_PIN_VIEWBOX}">${clayPinInner(symbol, color, 'atlas')}</svg>`;
}
