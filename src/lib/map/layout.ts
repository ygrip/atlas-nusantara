/**
 * World layout shared by the 3D atlas renderers. World X = plane x − 500, world Z = plane y − 250, Y is up.
 * The map sits on a flat sea plateau; beyond it the sea rolls over a rounded edge into outer space.
 */

/** Vertical extent of the cloud slab. Terrain tops out near 16 units, so clouds always float above it. */
export const CLOUD_BASE_HEIGHT = 26;
export const CLOUD_TOP_HEIGHT = 46;
export const CIRRUS_HEIGHT = 82;

/** Ellipse (semi-axes in world units) that encloses the whole map rectangle. The sea is flat inside it. */
export const PLATEAU = { radiusX: 730, radiusZ: 365 } as const;
/** Outer limb of the world: where the sea has rolled over and ends. */
export const LIMB = { radiusX: 1060, radiusZ: 580 } as const;
/** Vertical drop of the rolled-over edge, in world units. */
export const LIMB_DROP = 260;
/** Height of the atmosphere glow ring that veils the limb. */
export const HALO_HEIGHT = -45;

/** Metres of the modelled sea that the bathymetry texture encodes. */
export const MAX_DEPTH_METRES = 9000;

/** The sun is a light direction (pointing toward the sun): high in the north-west, the cartographic convention. */
export const SUN_DIRECTION: readonly [number, number, number] = [-0.55, 0.6, -0.58];
