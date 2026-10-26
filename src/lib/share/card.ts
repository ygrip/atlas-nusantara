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

function drawGeometry(context: CanvasRenderingContext2D, geometry: GeometryPackage | undefined, dark: boolean) {
  if (!geometry) return;
  const viewBox = geometry.viewBox.trim().split(/\s+/).map(Number);
  const [minX, minY, width, height] = viewBox;
  const left = 96;
  const top = 300;
  const canvasWidth = 888;
  const canvasHeight = 385;
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
  let colors = { page: '#f6f0e7', card: '#fffaf2', text: '#392f2b', muted: '#6c6057', accent: '#a74f29', border: '#d9cbb9' };
  if (dark) colors = { page: '#211f25', card: '#2e2a31', text: '#f3e9de', muted: '#c5b6aa', accent: '#f2b58c', border: '#574b50' };
  context.fillStyle = colors.page;
  context.fillRect(0, 0, 1080, 1080);
  context.fillStyle = colors.card;
  roundedRect(context, 42, 42, 996, 996, 36);
  context.fill();
  context.strokeStyle = colors.border;
  context.lineWidth = 2;
  context.stroke();
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
