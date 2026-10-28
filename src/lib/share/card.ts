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
}

interface ShareColors { page: string; card: string; text: string; muted: string; accent: string; border: string }

function shareColors(dark: boolean): ShareColors {
  if (dark) return { page: '#211f25', card: '#2e2a31', text: '#f3e9de', muted: '#c5b6aa', accent: '#f2b58c', border: '#574b50' };
  return { page: '#f6f0e7', card: '#fffaf2', text: '#392f2b', muted: '#6c6057', accent: '#a74f29', border: '#d9cbb9' };
}

function drawCardFrame(context: CanvasRenderingContext2D, colors: ShareColors) {
  context.fillStyle = colors.page;
  context.fillRect(0, 0, 1080, 1080);
  context.fillStyle = colors.card;
  roundedRect(context, 42, 42, 996, 996, 36);
  context.fill();
  context.strokeStyle = colors.border;
  context.lineWidth = 2;
  context.stroke();
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

const DEFAULT_MAP_BOX = { left: 96, top: 300, width: 888, height: 385 };

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
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  await document.fonts.ready;
  context.scale(ratio, ratio);
  const dark = document.documentElement.dataset.theme === 'dark';
  const colors = shareColors(dark);
  drawCardFrame(context, colors);
  context.fillStyle = colors.accent;
  context.font = '800 24px "Nunito Variable", system-ui, sans-serif';
  context.fillText('NUSANTARA', 96, 126);
  context.fillStyle = colors.text;
  context.font = '800 48px "Nunito Variable", system-ui, sans-serif';
  wrapText(context, content.title, 96, 190, 888, 57, 2);
  context.fillStyle = colors.muted;
  context.font = '600 27px "Nunito Variable", system-ui, sans-serif';
  let subtitle = content.subtitle;
  if (content.region?.name) subtitle = content.region.name;
  wrapText(context, subtitle, 96, 260, 888, 35, 1);
  const geometry = geometryForShare(content.geometry, content.region);
  drawGeometry(context, geometry, dark);
  if (!geometry) {
    context.fillStyle = colors.muted;
    context.font = '700 28px "Nunito Variable", system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(content.unavailable, 540, 490, 760);
    context.textAlign = 'start';
  }
  const publicSummary = summaryForShare(content.summary, content.region);
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
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  const photoRequest = content.destination.imageUrl ? loadSharePhoto(content.destination.imageUrl) : Promise.resolve(undefined);
  await document.fonts.ready;
  const photo = await photoRequest;
  context.scale(ratio, ratio);
  const dark = document.documentElement.dataset.theme === 'dark';
  const colors = shareColors(dark);
  drawCardFrame(context, colors);
  context.fillStyle = colors.accent;
  context.font = '800 24px "Nunito Variable", system-ui, sans-serif';
  context.fillText('NUSANTARA · ' + content.destination.kindLabel.toUpperCase(), 96, 126, 888);
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

/** A square card for one species: photo (or illustration), name, Latin name, IUCN status, description and photo credit. */
export async function renderSpeciesShareCard(content: SpeciesCardContent): Promise<Blob> {
  const { species } = content;
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  const photoRequest = species.imageUrl ? loadSharePhoto(species.imageUrl) : Promise.resolve(undefined);
  const placeholderRequest = loadSharePhoto(species.placeholderUrl);
  await document.fonts.ready;
  const photo = await photoRequest;
  const picture = photo ?? await placeholderRequest;
  context.scale(ratio, ratio);
  const colors = shareColors(document.documentElement.dataset.theme === 'dark');
  drawCardFrame(context, colors);
  context.fillStyle = colors.accent;
  context.font = '800 24px "Nunito Variable", system-ui, sans-serif';
  context.fillText('NUSANTARA · ' + species.kindLabel.toUpperCase(), 96, 126, 888);
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
  chipColor: string;
  chipTextColor: string;
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
}

/** A square card for one dish: photo (or illustration), name, group, recipe count, description and photo credit. */
export async function renderDishShareCard(content: DishCardContent): Promise<Blob> {
  const { dish } = content;
  const canvas = document.createElement('canvas');
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = 1080 * ratio;
  canvas.height = 1080 * ratio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  const photoRequest = dish.imageUrl ? loadSharePhoto(dish.imageUrl) : Promise.resolve(undefined);
  const placeholderRequest = loadSharePhoto(dish.placeholderUrl);
  await document.fonts.ready;
  const photo = await photoRequest;
  const picture = photo ?? await placeholderRequest;
  context.scale(ratio, ratio);
  const colors = shareColors(document.documentElement.dataset.theme === 'dark');
  drawCardFrame(context, colors);
  context.fillStyle = colors.accent;
  context.font = '800 24px "Nunito Variable", system-ui, sans-serif';
  context.fillText('NUSANTARA · ' + dish.kindLabel.toUpperCase(), 96, 126, 888);
  if (photo) drawSpeciesPhoto(context, photo, colors);
  else drawSpeciesPhoto(context, picture, colors, dish.placeholderBackground);

  context.fillStyle = colors.text;
  context.font = '800 54px "Nunito Variable", system-ui, sans-serif';
  const nameLines = wrapText(context, dish.name, 96, 622, 888, 60, 2);
  let cursor = 622 + (nameLines - 1) * 60 + 40;
  context.fillStyle = colors.muted;
  context.font = '600 24px "Nunito Variable", system-ui, sans-serif';
  context.fillText(dish.subtitle, 96, cursor, 888);
  cursor = drawChip(context, dish.chipLabel, dish.chipColor, dish.chipTextColor, 96, cursor + 18) + 40;

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
