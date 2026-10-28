import source from '../../../config/ads.json' with { type: 'json' };

const AD_CLIENT_PATTERN = /^ca-pub-\d{16}$/;
const AD_SLOT_PATTERN = /^\d{10}$/;
const FRAME_ORIGIN_PATTERN = /^https:\/\/(?:\*\.)?(?:[a-z0-9-]+\.)+[a-z0-9-]+(?::443)?$/i;

export interface AdsConfiguration {
  enabled: boolean;
  client: string;
  testMode: boolean;
  placements: { home: string };
  frameOrigins: string[];
}

export function validateAdsConfiguration(value: unknown): AdsConfiguration | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.enabled !== true || typeof candidate.testMode !== 'boolean') return undefined;
  if (typeof candidate.client !== 'string' || !AD_CLIENT_PATTERN.test(candidate.client)) return undefined;
  if (!candidate.placements || typeof candidate.placements !== 'object' || Array.isArray(candidate.placements)) return undefined;
  const placements = candidate.placements as Record<string, unknown>;
  if (typeof placements.home !== 'string' || !AD_SLOT_PATTERN.test(placements.home)) return undefined;

  if (!Array.isArray(candidate.frameOrigins) || candidate.frameOrigins.length === 0) return undefined;
  const frameOrigins: string[] = [];
  for (const origin of candidate.frameOrigins) {
    if (typeof origin !== 'string' || !FRAME_ORIGIN_PATTERN.test(origin)) return undefined;
    frameOrigins.push(origin);
  }
  return {
    enabled: true,
    client: candidate.client,
    testMode: candidate.testMode,
    placements: { home: placements.home },
    frameOrigins
  };
}

export const adsConfig = validateAdsConfiguration(source);
