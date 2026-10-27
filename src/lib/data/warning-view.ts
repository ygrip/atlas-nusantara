import type { HazardWarning } from './hazards.ts';

/** CAP severity, ordered from most to least urgent. Anything unknown reads as minor. */
export type SeverityLevel = 'extreme' | 'severe' | 'moderate' | 'minor';

export const SEVERITY_LEVELS: SeverityLevel[] = ['extreme', 'severe', 'moderate', 'minor'];

export function severityLevel(severity: string | null): SeverityLevel {
  const normalised = severity?.toLowerCase();
  if (normalised === 'extreme' || normalised === 'severe' || normalised === 'moderate') return normalised;
  return 'minor';
}

function severityRank(warning: HazardWarning): number {
  return SEVERITY_LEVELS.indexOf(severityLevel(warning.severity));
}

/** Most severe first; within a severity, the one that ends soonest comes first. */
export function sortWarnings(warnings: HazardWarning[]): HazardWarning[] {
  return [...warnings].sort((a, b) => {
    const bySeverity = severityRank(a) - severityRank(b);
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(a.expires) - Date.parse(b.expires);
  });
}

export function countBySeverity(warnings: HazardWarning[]): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = { extreme: 0, severe: 0, moderate: 0, minor: 0 };
  for (const warning of warnings) counts[severityLevel(warning.severity)]++;
  return counts;
}

/** BMKG lists areas as "A, B, C"; each becomes its own chip. */
export function splitAreas(areaDescriptions: string): string[] {
  const seen = new Set<string>();
  const areas: string[] = [];
  for (const piece of areaDescriptions.split(/[,;]/)) {
    const area = piece.trim();
    if (area.length === 0 || seen.has(area)) continue;
    seen.add(area);
    areas.push(area);
  }
  return areas;
}

export interface TimeLeft {
  /** Whole units for Intl.RelativeTimeFormat. */
  value: number;
  unit: 'minute' | 'hour' | 'day';
}

/** Time until the warning ends, rounded to the nearest sensible unit; undefined once it has ended. */
export function timeLeft(expires: string, now: number): TimeLeft | undefined {
  const remainingMs = Date.parse(expires) - now;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return undefined;
  const minutes = Math.max(1, Math.round(remainingMs / 60_000));
  if (minutes < 90) return { value: minutes, unit: 'minute' };
  const hours = Math.round(minutes / 60);
  if (hours < 48) return { value: hours, unit: 'hour' };
  return { value: Math.round(hours / 24), unit: 'day' };
}
