import type { PinSymbol } from './overlay-contract';

/** Every clay marker is drawn on this square canvas, so SVG and WebGL markers share one source. */
export const CLAY_PIN_VIEWBOX = 64;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_COLOR = '#8a7f78';

/** Shape outlines, drawn on the 64 x 64 canvas and thickened by a round-joined stroke to look soft. */
const OUTLINES: Record<PinSymbol, string> = {
  circle: '<circle cx="32" cy="30" r="17"/>',
  triangle: '<polygon points="32,13 50,46 14,46"/>',
  diamond: '<polygon points="32,11 51,30 32,49 13,30"/>',
  // A leaf growing from the lower left to the upper right.
  leaf: '<path d="M20 44C17 31 26 19 44 16C46 32 38 43 20 44Z"/>',
  // One pad and four toes; the strokes below are thin so the toes stay separate.
  // A rice bowl: a half disc with a flat rim.
  bowl: '<path d="M18 28H46C46 38 40 45 32 45C24 45 18 38 18 28Z"/>',
  paw: '<ellipse cx="32" cy="37" rx="9" ry="7"/><ellipse cx="19.5" cy="29" rx="3.2" ry="4" transform="rotate(-22 19.5 29)"/><ellipse cx="26.5" cy="20" rx="3.4" ry="4.4" transform="rotate(-8 26.5 20)"/><ellipse cx="37.5" cy="20" rx="3.4" ry="4.4" transform="rotate(8 37.5 20)"/><ellipse cx="44.5" cy="29" rx="3.2" ry="4" transform="rotate(22 44.5 29)"/>'
};

/** Stroke widths (rim, body) that thicken each outline; shapes made of small parts need thinner strokes. */
const STROKES: Record<PinSymbol, { rim: number; body: number }> = {
  circle: { rim: 9, body: 6 }, triangle: { rim: 9, body: 6 }, diamond: { rim: 9, body: 6 }, leaf: { rim: 8, body: 5 }, paw: { rim: 5, body: 3 }, bowl: { rim: 8, body: 5 }
};

/** Leaf and paw are drawn smaller than the plain shapes, so they are enlarged about the marker centre. */
const SCALES: Partial<Record<PinSymbol, number>> = { leaf: 1.2, paw: 1.25, bowl: 1.2 };

/** Light details drawn over the body, such as the midrib of a leaf. */
const DETAILS: Partial<Record<PinSymbol, string>> = {
  leaf: '<path d="M22.5 42C28 33 34 26 41 20" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2.2" stroke-linecap="round"/>',
  // Three wisps of steam rising over the bowl.
  bowl: '<path d="M26 24C24 21 28 19 26 16M32 24C30 21 34 19 32 16M38 24C36 21 40 19 38 16" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>'
};

/** Soft highlight blob sitting on the upper-left of the shape, where a clay surface catches light. */
const HIGHLIGHTS: Record<PinSymbol, { cx: number; cy: number; rx: number; ry: number; angle: number }> = {
  circle: { cx: 24, cy: 21, rx: 7, ry: 4.5, angle: -35 },
  triangle: { cx: 28, cy: 33, rx: 5.5, ry: 3.5, angle: -60 },
  diamond: { cx: 24.5, cy: 23, rx: 6, ry: 3.8, angle: -45 },
  leaf: { cx: 27, cy: 26, rx: 5.5, ry: 3.2, angle: -50 },
  paw: { cx: 28, cy: 35, rx: 4.5, ry: 2.4, angle: -20 },
  bowl: { cx: 26, cy: 33, rx: 5, ry: 2.6, angle: -30 }
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
  const stroke = STROKES[symbol];
  const detail = DETAILS[symbol] ?? '';
  const scale = SCALES[symbol] ?? 1;
  const scaleTransform = `translate(32 30) scale(${scale}) translate(-32 -30)`;
  const gradient = `clay-body-${id}`;
  return [
    `<defs><radialGradient id="${gradient}" cx="34%" cy="26%" r="82%">`,
    `<stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/>`,
    '</radialGradient></defs>',
    // Contact shadow, then the darker rim that gives the lump its thickness.
    '<ellipse cx="32" cy="53" rx="15" ry="4.2" fill="#2b1d1a" opacity="0.22"/>',
    `<g transform="${scaleTransform}">`,
    `<g fill="${dark}" stroke="${dark}" stroke-width="${stroke.rim}" stroke-linejoin="round" transform="translate(0 2.2)">${outline}</g>`,
    `<g fill="url(#${gradient})" stroke="url(#${gradient})" stroke-width="${stroke.body}" stroke-linejoin="round">${outline}</g>`,
    detail,
    `<ellipse cx="${shine.cx}" cy="${shine.cy}" rx="${shine.rx}" ry="${shine.ry}" fill="#ffffff" opacity="0.6" transform="rotate(${shine.angle} ${shine.cx} ${shine.cy})"/>`,
    `<ellipse cx="${shine.cx + shine.rx + 4}" cy="${shine.cy + shine.ry + 4}" rx="1.6" ry="1.6" fill="#ffffff" opacity="0.5"/>`,
    '</g>'
  ].join('');
}

/** A standalone SVG document, used to rasterise the marker into the WebGL pin atlas. */
export function clayPinDocument(symbol: PinSymbol, color: string, pixels: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${CLAY_PIN_VIEWBOX} ${CLAY_PIN_VIEWBOX}">${clayPinInner(symbol, color, 'atlas')}</svg>`;
}
