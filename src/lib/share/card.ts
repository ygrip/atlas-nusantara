import type { GeometryPackage } from '../geo/types.ts';

export const PUBLIC_ORIGIN = 'https://nusantara.readynaz.com';
export const SHARE_KINDS = ['warning', 'earthquake', 'incident', 'hazard'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export interface ShareRegion {
  code: string;
  name: string;
}

export interface ShareSummary {
  generatedAt: string;
  counts: Record<ShareKind, number>;
  sourceNames: string[];
}

export function isPublicRegionCode(code: string): boolean {
  return /^\d{2}(?:\.\d{2})?$/.test(code);
}

export function makeShareUrl(region?: ShareRegion): string {
  const url = new URL('/', PUBLIC_ORIGIN);
  if (region && isPublicRegionCode(region.code)) url.searchParams.set('region', region.code);
  return url.toString();
}

const DESTINATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export function isPublicDestinationId(id: string): boolean {
  return DESTINATION_ID_PATTERN.test(id);
}

/** A link that reopens the destination list of the province with the shared place found by its id. */
export function makeDestinationShareUrl(provinceCode: string, destinationId: string): string {
  const url = new URL('/', PUBLIC_ORIGIN);
  if (!isPublicRegionCode(provinceCode)) return url.toString();
  url.searchParams.set('region', provinceCode);
  if (!isPublicDestinationId(destinationId)) return url.toString();
  url.searchParams.set('layer', 'destinations');
  url.searchParams.set('destination', destinationId);
  return url.toString();
}

const SPECIES_ID_PATTERN = /^\d{1,12}$/;

/** A link that reopens the flora or fauna list of the province with the shared species open. */
export function makeSpeciesShareUrl(kind: 'flora' | 'fauna', provinceCode: string | undefined, speciesId: string): string {
  const url = new URL('/', PUBLIC_ORIGIN);
  if (provinceCode && isPublicRegionCode(provinceCode)) url.searchParams.set('region', provinceCode);
  url.searchParams.set('layer', kind);
  if (SPECIES_ID_PATTERN.test(speciesId)) url.searchParams.set('species', speciesId);
  return url.toString();
}

export function validShareSummary(summary: ShareSummary | undefined): summary is ShareSummary {
  if (!summary || !Number.isFinite(Date.parse(summary.generatedAt))) return false;
  for (const kind of SHARE_KINDS) {
    const count = summary.counts?.[kind];
    if (!Number.isSafeInteger(count) || count < 0) return false;
  }
  return Array.isArray(summary.sourceNames) && summary.sourceNames.length > 0 && summary.sourceNames.every(name => typeof name === 'string' && name.trim().length > 0);
}

export function summaryForShare(summary: ShareSummary | undefined, region?: ShareRegion): ShareSummary | undefined {
  if (region || !validShareSummary(summary)) return undefined;
  if (Object.values(summary.counts).every(count => count === 0)) return undefined;
  return summary;
}

export function validGeometryInput(geometry: GeometryPackage | undefined): GeometryPackage | undefined {
  if (!geometry || geometry.schemaVersion !== 1 || !Array.isArray(geometry.regions) || geometry.regions.length === 0) return undefined;
  if (!geometry.source?.trim() || !geometry.license?.trim() || !geometry.boundaryEdition?.trim() || !geometry.codeEdition?.trim()) return undefined;
  if (geometry.regions.length > 1000 || typeof geometry.viewBox !== 'string' || !/^\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*$/.test(geometry.viewBox)) return undefined;
  const viewBoxValues = geometry.viewBox.trim().split(/\s+/).map(Number);
  if (viewBoxValues.length !== 4 || viewBoxValues.some(value => !Number.isFinite(value)) || viewBoxValues[2] <= 0 || viewBoxValues[3] <= 0) return undefined;
  let totalPathLength = 0;
  for (const region of geometry.regions) {
    if (!region || !isPublicRegionCode(region.sourceCode) || !region.name?.trim() || typeof region.path !== 'string' || region.path.length === 0 || region.path.length > 200_000) return undefined;
    if (!/^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]+$/.test(region.path)) return undefined;
    totalPathLength += region.path.length;
    if (totalPathLength > 2_000_000) return undefined;
  }
  return geometry;
}

export function geometryForShare(geometry: GeometryPackage | undefined, region?: ShareRegion): GeometryPackage | undefined {
  const verified = validGeometryInput(geometry);
  if (!verified || !region) return verified;
  const regions = verified.regions.filter(item => item.sourceCode === region.code || item.sourceCode.startsWith(region.code + '.'));
  if (regions.length === 0) return undefined;
  if (regions.some(item => !Array.isArray(item.bbox) || item.bbox.length !== 4 || item.bbox.some(value => !Number.isFinite(value)))) return undefined;
  const left = Math.min(...regions.map(item => item.bbox[0]));
  const top = Math.min(...regions.map(item => item.bbox[1]));
  const right = Math.max(...regions.map(item => item.bbox[2]));
  const bottom = Math.max(...regions.map(item => item.bbox[3]));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return undefined;
  const padding = Math.max(width, height) * .08;
  return { ...verified, regions, viewBox: `${left - padding} ${top - padding} ${width + 2 * padding} ${height + 2 * padding}` };
}

export interface ShareCardContent {
  region?: ShareRegion;
  geometry?: GeometryPackage;
  summary?: ShareSummary;
  title: string;
  subtitle: string;
  caveat: string;
  labels: Record<ShareKind, string>;
  unavailable: string;
  visitLabel?: string;
}

/** One shared place: its name, where it is, and (when available) a photo that may be drawn on the card. */
export interface ShareDestination {
  id: string;
  name: string;
  /** Human readable place, for example "Kabupaten Bondowoso, Jawa Timur". */
  location: string;
  kindLabel: string;
  imageUrl?: string;
  /** Photo credit and license, drawn under the photo when the photo is licensed. */
  credit?: string;
}

export interface DestinationCardContent {
  destination: ShareDestination;
  /** Province outline, drawn instead of a photo when no photo can be loaded. */
  geometry?: GeometryPackage;
  provinceCode: string;
  caveat: string;
  noPhoto: string;
  visitLabel?: string;
}

interface ShareColors { page: string; card: string; text: string; muted: string; accent: string; border: string }

function shareColors(dark: boolean): ShareColors {
  if (dark) return { page: '#211f25', card: '#2e2a31', text: '#f3e9de', muted: '#c5b6aa', accent: '#f2b58c', border: '#574b50' };
  return { page: '#f6f0e7', card: '#fffaf2', text: '#392f2b', muted: '#6c6057', accent: '#a74f29', border: '#d9cbb9' };
}

function drawBrandHeader(context: CanvasRenderingContext2D, colors: ShareColors, logo: HTMLImageElement | undefined, visitLabel: string | undefined, includeVisitBadge = true) {
  if (logo) {
    context.save();
    context.shadowColor = 'rgba(24, 17, 13, .18)';
    context.shadowBlur = 8;
    context.shadowOffsetY = 3;
    context.drawImage(logo, 96, 62, 84, 84);
    context.restore();
  }
  context.fillStyle = colors.text;
  context.font = '800 30px "Nunito Variable", system-ui, sans-serif';
  context.fillText('Atlas Nusantara', 198, 102, 350);
  context.fillStyle = colors.muted;
  context.font = '700 23px "Nunito Variable", system-ui, sans-serif';
  context.textAlign = 'right';
  context.fillText('nusantara.readynaz.com', 984, 99, 330);
  context.textAlign = 'start';

  if (!includeVisitBadge) return;
  const text = visitLabel?.trim() || 'Explore the atlas';
  const left = 670;
  const top = 112;
  const width = 314;
  const height = 36;
  context.save();
  context.shadowColor = 'rgba(24, 17, 13, .14)';
  context.shadowBlur = 7;
  context.shadowOffsetY = 2;
  const gradient = context.createLinearGradient(left, top, left, top + height);
  gradient.addColorStop(0, blendHexColors(colors.card, colors.accent, .12));
  gradient.addColorStop(1, blendHexColors(colors.card, colors.accent, .24));
  context.fillStyle = gradient;
  roundedRect(context, left, top, width, height, 14);
  context.fill();
  context.restore();
  context.strokeStyle = colors.border;
  context.lineWidth = 1;
  roundedRect(context, left, top, width, height, 14);
  context.stroke();
  context.strokeStyle = 'rgba(255,255,255,.48)';
  context.beginPath();
  context.moveTo(left + 16, top + 2);
  context.lineTo(left + width - 16, top + 2);
  context.stroke();
  context.fillStyle = colors.text;
  context.font = '800 18px "Nunito Variable", system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(text, left + width / 2, top + 24, width - 24);
  context.textAlign = 'start';
}

function drawAtlasInvitation(context: CanvasRenderingContext2D, colors: ShareColors, label: string | undefined) {
  context.save();
  const surface = context.createLinearGradient(0, 754, 0, 838);
  surface.addColorStop(0, blendHexColors(colors.accent, '#ffffff', .15));
  surface.addColorStop(1, colors.accent);
  context.fillStyle = surface;
  context.shadowColor = 'rgba(24, 17, 13, .2)';
  context.shadowBlur = 16;
  context.shadowOffsetY = 7;
  roundedRect(context, 240, 754, 600, 84, 30);
  context.fill();
  context.shadowColor = 'transparent';
  context.fillStyle = colors.card;
  context.font = '900 34px "Nunito Variable", system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(label ?? 'Explore the atlas', 540, 808, 552);
  context.fillStyle = colors.text;
  context.font = '800 32px "Nunito Variable", system-ui, sans-serif';
  context.fillText(new URL(PUBLIC_ORIGIN).hostname, 540, 894, 888);
  context.restore();
}

function drawCardFrame(context: CanvasRenderingContext2D, colors: ShareColors) {
  const card = { left: 42, top: 42, width: 996, height: 996, radius: 52 };
  const pageGradient = context.createLinearGradient(0, 0, 1080, 1080);
  pageGradient.addColorStop(0, colors.page);
  pageGradient.addColorStop(1, blendHexColors(colors.page, colors.accent, .08));
  context.fillStyle = pageGradient;
  context.fillRect(0, 0, 1080, 1080);

  context.save();
  context.shadowColor = 'rgba(24, 17, 13, .22)';
  context.shadowBlur = 34;
  context.shadowOffsetY = 18;
  context.fillStyle = colors.border;
  roundedRect(context, card.left, card.top + 10, card.width, card.height, card.radius);
  context.fill();
  context.restore();

  const surface = context.createLinearGradient(0, card.top, 0, card.top + card.height);
  surface.addColorStop(0, blendHexColors(colors.card, '#ffffff', .2));
  surface.addColorStop(.18, colors.card);
  surface.addColorStop(1, blendHexColors(colors.card, colors.accent, .055));
  context.fillStyle = surface;
  roundedRect(context, card.left, card.top, card.width, card.height, card.radius);
  context.fill();
  context.strokeStyle = colors.border;
  context.lineWidth = 2;
  context.stroke();

  context.save();
  context.beginPath();
  context.roundRect(card.left + 3, card.top + 3, card.width - 6, card.height - 6, card.radius - 3);
  context.clip();
  const sheen = context.createLinearGradient(0, card.top, 0, card.top + 22);
  sheen.addColorStop(0, 'rgba(255,255,255,.42)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = sheen;
  context.fillRect(card.left + 4, card.top + 4, card.width - 8, 22);
  context.restore();
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  let words = text.split(/(\s+)/).filter(Boolean);
  if (typeof Intl.Segmenter === 'function') words = [...new Intl.Segmenter(document.documentElement.lang, { granularity: 'word' }).segment(text)].map(part => part.segment);
  const tokens: string[] = [];
  for (const word of words) {
    if (context.measureText(word).width <= maxWidth) { tokens.push(word); continue; }
    if (typeof Intl.Segmenter === 'function') tokens.push(...[...new Intl.Segmenter(document.documentElement.lang, { granularity: 'grapheme' }).segment(word)].map(part => part.segment));
    else tokens.push(...Array.from(word));
  }
  let line = '';
  let lineCount = 0;
  for (const word of tokens) {
    const candidate = line + word;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y + lineCount * lineHeight, maxWidth);
      lineCount += 1;
      line = word.trimStart();
      if (lineCount >= maxLines) return lineCount;
    } else {
      line = candidate;
    }
  }
  if (line && lineCount < maxLines) {
    context.fillText(line, x, y + lineCount * lineHeight, maxWidth);
    lineCount += 1;
  }
  return lineCount;
}

const DEFAULT_MAP_BOX = { left: 96, top: 320, width: 888, height: 365 };

function drawGeometry(context: CanvasRenderingContext2D, geometry: GeometryPackage | undefined, dark: boolean, box = DEFAULT_MAP_BOX) {
  if (!geometry) return;
  const viewBox = geometry.viewBox.trim().split(/\s+/).map(Number);
  const [minX, minY, width, height] = viewBox;
  const { left, top } = box;
  const canvasWidth = box.width;
  const canvasHeight = box.height;
  context.save();
  context.beginPath();
  context.roundRect(left, top, canvasWidth, canvasHeight, 30);
  context.clip();
  let mapBackground = '#e1e8d7';
  if (dark) mapBackground = '#293e34';
  context.fillStyle = mapBackground;
  context.fillRect(left, top, canvasWidth, canvasHeight);
  context.translate(left, top);
  const scale = Math.min(canvasWidth / width, canvasHeight / height);
  context.translate((canvasWidth - width * scale) / 2 - minX * scale, (canvasHeight - height * scale) / 2 - minY * scale);
  context.scale(scale, scale);
  context.lineWidth = 0.7 / scale;
  context.fillStyle = '#91b89b';
  let mapStroke = '#365945';
  if (dark) mapStroke = '#d6e6d8';
  context.strokeStyle = mapStroke;
  for (const region of geometry.regions) {
    const path = new Path2D(region.path);
    context.fill(path);
    context.stroke(path);
  }
  context.restore();
}

export async function renderShareCard(content: ShareCardContent): Promise<Blob> {
  const brandRequest = loadSharePhoto('/brand/logo-256.png');
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  await document.fonts.ready;
  const brand = await brandRequest;
  context.scale(ratio, ratio);
  const dark = document.documentElement.dataset.theme === 'dark';
  const colors = shareColors(dark);
  drawCardFrame(context, colors);
  const publicSummary = summaryForShare(content.summary, content.region);
  drawBrandHeader(context, colors, brand, content.visitLabel, Boolean(content.region || publicSummary));
  context.fillStyle = colors.text;
  context.font = '800 48px "Nunito Variable", system-ui, sans-serif';
  const titleLines = wrapText(context, content.title, 96, 190, 888, 57, 2);
  context.fillStyle = colors.muted;
  context.font = '600 27px "Nunito Variable", system-ui, sans-serif';
  let subtitleY = 260;
  if (titleLines > 1) subtitleY = 292;
  wrapText(context, content.subtitle, 96, subtitleY, 888, 35, 1);
  const geometry = geometryForShare(content.geometry, content.region);
  drawGeometry(context, geometry, dark);
  if (!geometry) {
    context.fillStyle = colors.muted;
    context.font = '700 28px "Nunito Variable", system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(content.unavailable, 540, 490, 760);
    context.textAlign = 'start';
  }
  if (!publicSummary && !content.region) drawAtlasInvitation(context, colors, content.visitLabel);
  if (publicSummary) {
    const generatedAt = new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(publicSummary.generatedAt));
    context.fillStyle = colors.text;
    context.font = '800 25px "Nunito Variable", system-ui, sans-serif';
    context.fillText(generatedAt, 96, 730);
    const columns = [96, 318, 540, 762];
    for (let index = 0; index < SHARE_KINDS.length; index += 1) {
      const kind = SHARE_KINDS[index];
      const x = columns[index];
      context.fillStyle = colors.accent;
      context.font = '800 34px "Nunito Variable", system-ui, sans-serif';
      context.fillText(String(publicSummary.counts[kind]), x, 795, 196);
      context.fillStyle = colors.muted;
      context.font = '600 19px "Nunito Variable", system-ui, sans-serif';
      wrapText(context, content.labels[kind], x, 826, 196, 24, 2);
    }
    const sources = publicSummary.sourceNames.filter(name => name.trim()).slice(0, 3).join(' · ');
    if (sources) {
      context.fillStyle = colors.muted;
      context.font = '600 18px "Nunito Variable", system-ui, sans-serif';
      wrapText(context, sources, 96, 890, 888, 24, 2);
    }
  }
  if (content.region && geometry) {
    context.fillStyle = colors.muted;
    context.font = '600 20px "Nunito Variable", system-ui, sans-serif';
    wrapText(context, geometry.codeEdition, 96, 730, 888, 25, 1);
    wrapText(context, geometry.boundaryEdition, 96, 770, 888, 25, 1);
    context.font = '600 18px "Nunito Variable", system-ui, sans-serif';
    const attribution = [geometry.attribution, geometry.license, geometry.source].filter(Boolean).join(' · ');
    wrapText(context, attribution, 96, 805, 888, 22, 6);
  }
  context.fillStyle = colors.muted;
  context.font = '600 20px "Nunito Variable", system-ui, sans-serif';
  wrapText(context, content.caveat, 96, 940, 888, 25, 3);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('PNG generation failed'));
    }, 'image/png');
  });
}

const PHOTO_TIMEOUT_MS = 8000;
const PHOTO_BOX = { left: 96, top: 156, width: 888, height: 520 };

/** Loads a photo for the canvas. Resolves to undefined when it is blocked, missing or slow, so the card still renders. */
export function loadSharePhoto(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise(resolve => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(undefined), PHOTO_TIMEOUT_MS);
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => { window.clearTimeout(timer); resolve(image); };
    image.onerror = () => { window.clearTimeout(timer); resolve(undefined); };
    image.src = url;
  });
}

/** Draws the photo scaled to cover the box, centred, like CSS object-fit: cover. */
function drawPhotoCover(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  const { left, top, width, height } = PHOTO_BOX;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.save();
  roundedRect(context, left, top, width, height, 30);
  context.clip();
  context.drawImage(image, left + (width - drawWidth) / 2, top + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function drawProvinceFallback(context: CanvasRenderingContext2D, content: DestinationCardContent, colors: ShareColors, dark: boolean) {
  const region = { code: content.provinceCode, name: '' };
  const geometry = geometryForShare(content.geometry, region);
  drawGeometry(context, geometry, dark, PHOTO_BOX);
  if (geometry) return;
  context.fillStyle = colors.border;
  roundedRect(context, PHOTO_BOX.left, PHOTO_BOX.top, PHOTO_BOX.width, PHOTO_BOX.height, 30);
  context.fill();
  context.fillStyle = colors.muted;
  context.font = '700 28px "Nunito Variable", system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(content.noPhoto, 540, 430, 760);
  context.textAlign = 'start';
}

/** A square card for one destination: its photo (or province outline), name, location and the photo credit. */
export async function renderDestinationShareCard(content: DestinationCardContent): Promise<Blob> {
  const brandRequest = loadSharePhoto('/brand/logo-256.png');
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  let photoRequest = Promise.resolve<HTMLImageElement | undefined>(undefined);
  if (content.destination.imageUrl) photoRequest = loadSharePhoto(content.destination.imageUrl);
  await document.fonts.ready;
  const [photo, brand] = await Promise.all([photoRequest, brandRequest]);
  context.scale(ratio, ratio);
  const dark = document.documentElement.dataset.theme === 'dark';
  const colors = shareColors(dark);
  drawCardFrame(context, colors);
  drawBrandHeader(context, colors, brand, content.visitLabel);
  context.fillStyle = colors.accent;
  context.font = '800 22px "Nunito Variable", system-ui, sans-serif';
  context.fillText(content.destination.kindLabel.toUpperCase(), 96, 147, 888);
  if (photo) drawPhotoCover(context, photo);
  else drawProvinceFallback(context, content, colors, dark);
  context.fillStyle = colors.text;
  context.font = '800 56px "Nunito Variable", system-ui, sans-serif';
  const nameLines = wrapText(context, content.destination.name, 96, 750, 888, 64, 2);
  const locationTop = 750 + nameLines * 64 + 4;
  context.fillStyle = colors.accent;
  context.font = '700 30px "Nunito Variable", system-ui, sans-serif';
  const locationLines = wrapText(context, content.destination.location, 96, locationTop, 888, 38, 2);
  const footerTop = Math.max(locationTop + locationLines * 38 + 18, 930);
  context.fillStyle = colors.muted;
  context.font = '600 18px "Nunito Variable", system-ui, sans-serif';
  if (photo && content.destination.credit) wrapText(context, content.destination.credit, 96, footerTop - 28, 888, 22, 1);
  let caveatLines = 3;
  if (footerTop > 950) caveatLines = 2;
  wrapText(context, content.caveat, 96, footerTop, 888, 24, caveatLines);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('PNG generation failed'));
    }, 'image/png');
  });
}

/** One shared species: names, IUCN status, a short description and, when openly licensed, a photo. */
export interface ShareSpecies {
  id: string;
  kind: 'flora' | 'fauna';
  name: string;
  scientificName: string;
  /** For example "Mammals · Aceh". */
  subtitle: string;
  kindLabel: string;
  statusCode: string;
  statusLabel: string;
  statusColor: string;
  statusTextColor: string;
  description: string;
  /** Openly licensed photo that the canvas may read; omitted for all-rights-reserved photos. */
  imageUrl?: string;
  credit?: string;
  /** Same-origin illustration drawn when there is no usable photo. */
  placeholderUrl: string;
  /** Colour behind the illustration, which is shown whole instead of cropped like a photo. */
  placeholderBackground: string;
}

export interface SpeciesCardContent {
  species: ShareSpecies;
  caveat: string;
  visitLabel?: string;
}

const SPECIES_PHOTO_BOX = { left: 96, top: 150, width: 888, height: 400 };

/** Draws a photo cropped to fill the box, or (with `background`) an illustration shown whole and centred on that colour. */
function drawSpeciesPhoto(context: CanvasRenderingContext2D, image: HTMLImageElement | undefined, colors: ShareColors, background?: string) {
  const { left, top, width, height } = SPECIES_PHOTO_BOX;
  roundedRect(context, left, top, width, height, 30);
  if (!image) {
    context.fillStyle = colors.border;
    context.fill();
    return;
  }
  let scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  if (background) {
    scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    context.fillStyle = background;
    context.fill();
  }
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.save();
  context.clip();
  context.drawImage(image, left + (width - drawWidth) / 2, top + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function drawChip(context: CanvasRenderingContext2D, text: string, color: string, textColor: string, x: number, y: number): number {
  context.font = '800 22px "Nunito Variable", system-ui, sans-serif';
  const width = Math.min(888, context.measureText(text).width + 36);
  context.fillStyle = color;
  roundedRect(context, x, y, width, 42, 21);
  context.fill();
  context.fillStyle = textColor;
  context.fillText(text, x + 18, y + 29, 852);
  return y + 42;
}

function drawStatusChip(context: CanvasRenderingContext2D, species: ShareSpecies, x: number, y: number): number {
  return drawChip(context, species.statusCode + ' · ' + species.statusLabel, species.statusColor, species.statusTextColor, x, y);
}

/** Mix a restrained group tint into the share card surface; canvas doesn't inherit CSS theme variables. */
function blendHexColors(base: string, accent: string, fraction: number): string {
  if (!/^#[\da-f]{6}$/i.test(base) || !/^#[\da-f]{6}$/i.test(accent)) return base;
  return '#' + [1, 3, 5].map(index => {
    const a = Number.parseInt(base.slice(index, index + 2), 16);
    const b = Number.parseInt(accent.slice(index, index + 2), 16);
    return Math.round(a + (b - a) * fraction).toString(16).padStart(2, '0');
  }).join('');
}

/** The cuisine share chip matches the on-page raised, tinted badge in either theme. */
function drawCuisineChip(context: CanvasRenderingContext2D, label: string, groupColor: string, colors: ShareColors, x: number, y: number): number {
  context.save();
  context.font = '800 22px "Nunito Variable", system-ui, sans-serif';
  const width = Math.min(888, context.measureText(label).width + 60);
  const height = 42;
  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, blendHexColors(colors.card, groupColor, .1));
  gradient.addColorStop(1, blendHexColors(colors.card, groupColor, .18));

  // The shallow bottom edge and a highlight give the badge the same clay relief as the UI.
  context.fillStyle = colors.border;
  roundedRect(context, x, y + 3, width, height, 15);
  context.fill();
  context.fillStyle = gradient;
  roundedRect(context, x, y, width, height, 15);
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = blendHexColors(colors.border, groupColor, .25);
  context.stroke();
  context.strokeStyle = blendHexColors(colors.card, '#ffffff', .35);
  context.beginPath();
  context.moveTo(x + 15, y + 2);
  context.lineTo(x + width - 15, y + 2);
  context.stroke();

  context.beginPath();
  context.arc(x + 21, y + height / 2, 5, 0, Math.PI * 2);
  context.fillStyle = groupColor;
  context.fill();
  context.fillStyle = colors.text;
  context.fillText(label, x + 37, y + 29, width - 50);
  context.restore();
  return y + height;
}

/** A square card for one species: photo (or illustration), name, Latin name, IUCN status, description and photo credit. */
export async function renderSpeciesShareCard(content: SpeciesCardContent): Promise<Blob> {
  const { species } = content;
  const brandRequest = loadSharePhoto('/brand/logo-256.png');
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  let photoRequest = Promise.resolve<HTMLImageElement | undefined>(undefined);
  if (species.imageUrl) photoRequest = loadSharePhoto(species.imageUrl);
  const placeholderRequest = loadSharePhoto(species.placeholderUrl);
  await document.fonts.ready;
  const [photo, brand] = await Promise.all([photoRequest, brandRequest]);
  const picture = photo ?? await placeholderRequest;
  context.scale(ratio, ratio);
  const colors = shareColors(document.documentElement.dataset.theme === 'dark');
  drawCardFrame(context, colors);
  drawBrandHeader(context, colors, brand, content.visitLabel);
  context.fillStyle = colors.accent;
  context.font = '800 22px "Nunito Variable", system-ui, sans-serif';
  context.fillText(species.kindLabel.toUpperCase(), 96, 145, 888);
  if (photo) drawSpeciesPhoto(context, photo, colors);
  else drawSpeciesPhoto(context, picture, colors, species.placeholderBackground);

  context.fillStyle = colors.text;
  context.font = '800 54px "Nunito Variable", system-ui, sans-serif';
  const nameLines = wrapText(context, species.name, 96, 622, 888, 60, 2);
  let cursor = 622 + (nameLines - 1) * 60 + 40;
  context.fillStyle = colors.accent;
  context.font = 'italic 700 30px "Nunito Variable", system-ui, sans-serif';
  context.fillText(species.scientificName, 96, cursor, 888);
  cursor += 34;
  context.fillStyle = colors.muted;
  context.font = '600 22px "Nunito Variable", system-ui, sans-serif';
  context.fillText(species.subtitle, 96, cursor, 888);
  cursor = drawStatusChip(context, species, 96, cursor + 18) + 40;

  context.fillStyle = colors.text;
  context.font = '600 25px "Nunito Variable", system-ui, sans-serif';
  const descriptionLines = 4 - (nameLines - 1);
  if (species.description) wrapText(context, species.description, 96, cursor, 888, 33, descriptionLines);

  context.fillStyle = colors.muted;
  context.font = '600 18px "Nunito Variable", system-ui, sans-serif';
  if (photo && species.credit) context.fillText(species.credit, 96, 958, 888);
  wrapText(context, content.caveat, 96, 988, 888, 23, 2);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('PNG generation failed'));
    }, 'image/png');
  });
}

const DISH_ID_PATTERN = /^[a-z0-9-]{1,120}$/;

/** A link that reopens the cuisine list of the province with the shared dish open. */
export function makeDishShareUrl(provinceCode: string | undefined, dishId: string): string {
  const url = new URL('/', PUBLIC_ORIGIN);
  if (provinceCode && isPublicRegionCode(provinceCode)) url.searchParams.set('region', provinceCode);
  url.searchParams.set('layer', 'cuisine');
  if (DISH_ID_PATTERN.test(dishId)) url.searchParams.set('dish', dishId);
  return url.toString();
}

/** One shared dish: name, group, a short description and, when openly licensed, a photo. */
export interface ShareDish {
  id: string;
  name: string;
  /** For example "Soups · Kalimantan Selatan". */
  subtitle: string;
  kindLabel: string;
  /** For example "3 recipes". */
  chipLabel: string;
  /** Category color accents the claymorphic chip, rather than sitting under its text. */
  chipColor: string;
  description: string;
  /** Openly licensed Commons photo that the canvas may read; omitted for Cookpad photos, which send no CORS header. */
  imageUrl?: string;
  credit?: string;
  /** Same-origin illustration drawn when there is no usable photo. */
  placeholderUrl: string;
  placeholderBackground: string;
}

export interface DishCardContent {
  dish: ShareDish;
  caveat: string;
  visitLabel?: string;
}

/** A square card for one dish: photo (or illustration), name, group, recipe count, description and photo credit. */
export async function renderDishShareCard(content: DishCardContent): Promise<Blob> {
  const { dish } = content;
  const brandRequest = loadSharePhoto('/brand/logo-256.png');
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  let photoRequest = Promise.resolve<HTMLImageElement | undefined>(undefined);
  if (dish.imageUrl) photoRequest = loadSharePhoto(dish.imageUrl);
  const placeholderRequest = loadSharePhoto(dish.placeholderUrl);
  await document.fonts.ready;
  const [photo, brand] = await Promise.all([photoRequest, brandRequest]);
  const picture = photo ?? await placeholderRequest;
  context.scale(ratio, ratio);
  const colors = shareColors(document.documentElement.dataset.theme === 'dark');
  drawCardFrame(context, colors);
  drawBrandHeader(context, colors, brand, content.visitLabel);
  context.fillStyle = colors.accent;
  context.font = '800 22px "Nunito Variable", system-ui, sans-serif';
  context.fillText(dish.kindLabel.toUpperCase(), 96, 145, 888);
  if (photo) drawSpeciesPhoto(context, photo, colors);
  else drawSpeciesPhoto(context, picture, colors, dish.placeholderBackground);

  context.fillStyle = colors.text;
  context.font = '800 54px "Nunito Variable", system-ui, sans-serif';
  const nameLines = wrapText(context, dish.name, 96, 622, 888, 60, 2);
  let cursor = 622 + (nameLines - 1) * 60 + 40;
  context.fillStyle = colors.muted;
  context.font = '600 24px "Nunito Variable", system-ui, sans-serif';
  context.fillText(dish.subtitle, 96, cursor, 888);
  cursor = drawCuisineChip(context, dish.chipLabel, dish.chipColor, colors, 96, cursor + 18) + 40;

  context.fillStyle = colors.text;
  context.font = '600 25px "Nunito Variable", system-ui, sans-serif';
  const descriptionLines = 4 - (nameLines - 1);
  if (dish.description) wrapText(context, dish.description, 96, cursor, 888, 33, descriptionLines);

  context.fillStyle = colors.muted;
  context.font = '600 18px "Nunito Variable", system-ui, sans-serif';
  if (photo && dish.credit) context.fillText(dish.credit, 96, 958, 888);
  wrapText(context, content.caveat, 96, 988, 888, 23, 2);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('PNG generation failed'));
    }, 'image/png');
  });
}
