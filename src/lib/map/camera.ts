export const CAMERA_LIMITS = { minDistance: 12, maxDistance: 6500, far: 14000, fov: 32 } as const;

/** Fit a long archipelago even on a narrow phone viewport; the distance limit must not crop it. */
export function fitMapDistance(box: [number, number, number, number], aspect: number, padding = 1.15): number {
  const width = box[2] - box[0];
  const height = box[3] - box[1];
  const verticalAngle = CAMERA_LIMITS.fov * Math.PI / 180;
  const needed = Math.max(height, width / Math.max(0.3, aspect)) * 1.12 * padding;
  const distance = needed / (2 * Math.tan(verticalAngle / 2));
  return Math.min(CAMERA_LIMITS.maxDistance, Math.max(CAMERA_LIMITS.minDistance * 2, distance));
}
