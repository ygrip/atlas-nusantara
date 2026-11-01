/**
 * Enter and exit motion for the full-screen atlas: a container transform.
 *
 * The shell is already full size on the first frame, so the WebGL canvas never resizes while it animates.
 * Only `clip-path` grows from the map's old rectangle to the whole screen, and the top bar slides in.
 * Cheap, interruptible, and skipped for visitors who prefer reduced motion.
 */

/** A rectangle in viewport pixels. */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ENTER_MS = 380;
const EXIT_MS = 260;
/** Decelerate on the way in (fast start, soft landing); accelerate on the way out. */
const ENTER_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
const EXIT_EASING = 'cubic-bezier(0.3, 0, 0.8, 0.15)';
const CORNER_RADIUS_PX = 24;
/** Below this size the old rectangle is too small to grow from. */
const MIN_START_PX = 160;
/** The map settles from slightly smaller, which gives the reveal some depth. */
const MAP_START_SCALE = 0.97;

let running: Animation[] = [];

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Stops whatever is playing, so a new run starts from the final state instead of fighting it. */
export function cancelImmersiveMotion(): void {
  for (const animation of running) animation.cancel();
  running = [];
}

/** The part of the map's old rectangle that is on screen. Off-screen edges would make the reveal start from nothing. */
function onScreen(box: Box, screen: DOMRect): Box {
  const top = Math.max(box.top, screen.top);
  const left = Math.max(box.left, screen.left);
  const bottom = Math.min(box.top + box.height, screen.bottom);
  const right = Math.min(box.left + box.width, screen.right);
  const visible = { top, left, width: right - left, height: bottom - top };
  const tooSmall = visible.width < MIN_START_PX || visible.height < MIN_START_PX;
  if (!tooSmall) return visible;
  const marginX = screen.width * 0.14;
  const marginY = screen.height * 0.14;
  return { top: screen.top + marginY, left: screen.left + marginX, width: screen.width - 2 * marginX, height: screen.height - 2 * marginY };
}

function insetFor(shell: HTMLElement, requested: Box): string {
  const screen = shell.getBoundingClientRect();
  const box = onScreen(requested, screen);
  const top = box.top - screen.top;
  const left = box.left - screen.left;
  const right = screen.width - left - box.width;
  const bottom = screen.height - top - box.height;
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${CORNER_RADIUS_PX}px)`;
}

/** Resolves when the animations end, or are cancelled by a newer run. Never rejects. */
async function settle(animations: Animation[]): Promise<void> {
  running = animations;
  await Promise.allSettled(animations.map(animation => animation.finished));
}

function mapKeyframes(hidden: boolean): Keyframe[] {
  const small = { transform: `scale(${MAP_START_SCALE})` };
  const full = { transform: 'scale(1)' };
  if (hidden) return [full, small];
  return [small, full];
}

function barKeyframes(hidden: boolean): Keyframe[] {
  const away = { transform: 'translateY(-100%)', opacity: 0 };
  const home = { transform: 'translateY(0)', opacity: 1 };
  if (hidden) return [home, away];
  return [away, home];
}

/** Grows the shell from the map's old rectangle to the full screen. */
export function playEnter(shell: HTMLElement, bar: HTMLElement | null, map: HTMLElement | null, from: Box): Promise<void> {
  cancelImmersiveMotion();
  if (prefersReducedMotion()) return Promise.resolve();
  const reveal = shell.animate(
    { clipPath: [insetFor(shell, from), `inset(0px 0px 0px 0px round 0px)`] },
    { duration: ENTER_MS, easing: ENTER_EASING, fill: 'backwards' }
  );
  const animations = [reveal];
  if (map) animations.push(map.animate(mapKeyframes(false), { duration: ENTER_MS, easing: ENTER_EASING, fill: 'backwards' }));
  if (bar) animations.push(bar.animate(barKeyframes(false), { duration: ENTER_MS - 100, delay: 100, easing: ENTER_EASING, fill: 'backwards' }));
  return settle(animations);
}

/** Shrinks the shell back onto the map's place in the page. */
export function playExit(shell: HTMLElement, bar: HTMLElement | null, map: HTMLElement | null, to: Box): Promise<void> {
  cancelImmersiveMotion();
  if (prefersReducedMotion()) return Promise.resolve();
  const reveal = shell.animate(
    { clipPath: [`inset(0px 0px 0px 0px round 0px)`, insetFor(shell, to)] },
    { duration: EXIT_MS, easing: EXIT_EASING, fill: 'forwards' }
  );
  const animations = [reveal];
  if (map) animations.push(map.animate(mapKeyframes(true), { duration: EXIT_MS, easing: EXIT_EASING, fill: 'forwards' }));
  if (bar) animations.push(bar.animate(barKeyframes(true), { duration: EXIT_MS * 0.6, easing: EXIT_EASING, fill: 'forwards' }));
  return settle(animations);
}
