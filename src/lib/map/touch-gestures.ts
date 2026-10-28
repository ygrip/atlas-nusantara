import { Spherical, TOUCH, Vector3, type PerspectiveCamera } from 'three';
import type { MapControls } from 'three/examples/jsm/controls/MapControls.js';

export interface TouchPoint { x: number; y: number }
export type TwoFingerIntent = 'pinch' | 'rotate' | 'tilt' | 'pan';

function distance(first: TouchPoint, second: TouchPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}
function angle(first: TouchPoint, second: TouchPoint): number {
  return Math.atan2(second.y - first.y, second.x - first.x);
}
function angleDelta(start: number, current: number): number {
  let difference = current - start;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}
function midpoint(points: [TouchPoint, TouchPoint]): TouchPoint {
  return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

/** Lock intent after a small movement threshold, rather than treating every pinch as an orbit. */
export function classifyTwoFingerIntent(start: [TouchPoint, TouchPoint], current: [TouchPoint, TouchPoint]): TwoFingerIntent | undefined {
  const separation = distance(start[0], start[1]);
  const distanceChange = Math.abs(distance(current[0], current[1]) - separation);
  const rotation = Math.abs(angleDelta(angle(start[0], start[1]), angle(current[0], current[1])));
  const before = midpoint(start);
  const after = midpoint(current);
  const movement = { x: after.x - before.x, y: after.y - before.y };
  if (distanceChange >= 7 && distanceChange > rotation * separation) return 'pinch';
  if (rotation >= 0.08) return 'rotate';
  if (Math.hypot(movement.x, movement.y) < 8) return undefined;
  if (Math.abs(movement.y) > Math.abs(movement.x) * 1.5) return 'tilt';
  return 'pan';
}

interface SavedControls {
  zoom: boolean; rotate: boolean; pan: boolean; damping: boolean;
  minAzimuth: number; maxAzimuth: number;
}
interface TouchGestureOptions {
  element: HTMLElement;
  camera: PerspectiveCamera;
  controls: MapControls;
  onInteraction: () => void;
  onGesture: () => void;
}

/** Native one-finger pan, with independent two-finger zoom, twist, tilt and pan intents. */
export class MapTouchGestures {
  private readonly options: TouchGestureOptions;
  private readonly points = new Map<number, TouchPoint>();
  private start: [TouchPoint, TouchPoint] | undefined;
  private intent: TwoFingerIntent | undefined;
  private saved: SavedControls | undefined;
  private startPose: Spherical | undefined;
  private lastCenter: TouchPoint | undefined;
  private frame = 0;
  private suspended = false;

  constructor(options: TouchGestureOptions) {
    this.options = options;
    // One-finger input stays native. Pair gestures are handled here, not twice by OrbitControls.
    options.controls.touches.ONE = TOUCH.PAN;
    options.controls.touches.TWO = TOUCH.DOLLY_ROTATE;
    options.element.addEventListener('pointerdown', this.down, true);
    options.element.addEventListener('pointermove', this.move, true);
    options.element.addEventListener('pointerup', this.end, true);
    options.element.addEventListener('pointercancel', this.end, true);
    options.element.addEventListener('lostpointercapture', this.end, true);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.restore();
    this.points.clear();
    const element = this.options.element;
    element.removeEventListener('pointerdown', this.down, true);
    element.removeEventListener('pointermove', this.move, true);
    element.removeEventListener('pointerup', this.end, true);
    element.removeEventListener('pointercancel', this.end, true);
    element.removeEventListener('lostpointercapture', this.end, true);
  }

  private readonly down = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !this.options.controls.enabled) return;
    this.options.onInteraction();
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.points.size > 2) {
      this.suspended = true;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      return;
    }
    if (this.suspended || this.points.size !== 2) return;
    const controls = this.options.controls;
    this.saved = {
      zoom: controls.enableZoom, rotate: controls.enableRotate, pan: controls.enablePan,
      damping: controls.enableDamping, minAzimuth: controls.minAzimuthAngle, maxAzimuth: controls.maxAzimuthAngle
    };
    controls.enableDamping = false;
    controls.update();
    const points = [...this.points.values()];
    this.start = [points[0], points[1]];
    this.lastCenter = midpoint(this.start);
    this.startPose = new Spherical().setFromVector3(this.options.camera.position.clone().sub(controls.target));
    this.intent = undefined;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    this.options.onGesture();
  };

  private readonly move = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !this.points.has(event.pointerId)) return;
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.suspended || this.points.size !== 2 || !this.start || !this.saved || !this.options.controls.enabled) return;
    // Pointer events arrive once per finger. Coalesce the pair before classifying a parallel drag.
    if (!this.frame) this.frame = requestAnimationFrame(this.step);
  };

  private readonly step = (): void => {
    this.frame = 0;
    if (this.suspended || this.points.size !== 2 || !this.start || !this.saved || !this.options.controls.enabled) return;
    const points = [...this.points.values()];
    const current: [TouchPoint, TouchPoint] = [points[0], points[1]];
    this.intent ??= classifyTwoFingerIntent(this.start, current);
    if (this.intent === 'pan' && this.saved.pan) this.pan(midpoint(current));
    else this.pose(current);
  };

  private pose(current: [TouchPoint, TouchPoint]): void {
    if (!this.start || !this.startPose || !this.saved) return;
    const { camera, controls, element } = this.options;
    const pose = this.startPose.clone();
    if (this.intent === 'pinch' && this.saved.zoom) {
      const separation = Math.max(1, distance(current[0], current[1]));
      const radius = pose.radius * distance(this.start[0], this.start[1]) / separation;
      pose.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, radius));
    } else if (this.intent === 'rotate' && this.saved.rotate) {
      pose.theta += angleDelta(angle(this.start[0], this.start[1]), angle(current[0], current[1]));
    } else if (this.intent === 'tilt' && this.saved.rotate) {
      const deltaY = midpoint(current).y - midpoint(this.start).y;
      pose.phi += deltaY * Math.PI / Math.max(1, element.clientHeight);
      pose.phi = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle + 0.001, pose.phi));
    } else return;
    camera.position.copy(controls.target).add(new Vector3().setFromSpherical(pose));
    controls.update();
  }

  private pan(center: TouchPoint): void {
    if (!this.lastCenter) return;
    const { camera, controls, element } = this.options;
    const unitsPerPixel = 2 * camera.position.distanceTo(controls.target) * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, element.clientHeight);
    const right = new Vector3().setFromMatrixColumn(camera.matrix, 0);
    const forward = new Vector3().crossVectors(camera.up, right);
    const movement = right.multiplyScalar(-(center.x - this.lastCenter.x) * unitsPerPixel)
      .add(forward.multiplyScalar((center.y - this.lastCenter.y) * unitsPerPixel));
    camera.position.add(movement);
    controls.target.add(movement);
    this.lastCenter = center;
    controls.update();
  }

  private readonly end = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !this.points.has(event.pointerId)) return;
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      if (event.type === 'pointerup') this.step();
      this.frame = 0;
    }
    this.points.delete(event.pointerId);
    if (this.suspended) {
      if (this.points.size === 0) this.restore();
      return;
    }
    if (this.points.size < 2) this.restore();
  };

  private restore(): void {
    const saved = this.saved;
    if (saved) {
      const controls = this.options.controls;
      controls.enableZoom = saved.zoom;
      controls.enableRotate = saved.rotate;
      controls.enablePan = saved.pan;
      controls.enableDamping = saved.damping;
      controls.minAzimuthAngle = saved.minAzimuth;
      controls.maxAzimuthAngle = saved.maxAzimuth;
    }
    this.start = undefined;
    this.startPose = undefined;
    this.lastCenter = undefined;
    this.intent = undefined;
    this.saved = undefined;
    this.suspended = false;
    this.frame = 0;
  }
}
