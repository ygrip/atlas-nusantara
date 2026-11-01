/** Helpers for the full-screen atlas. The layout itself lives in `immersive.css`. */

/** At this width the details panel is a side drawer; below it, a bottom sheet. */
export const DRAWER_DESKTOP_QUERY = '(min-width: 900px)';

const DOCUMENT_CLASS = 'atlas-immersive';
const INERT_TARGETS = '.shell > :not(main), main > :not(#atlas)';

/** True when a native modal (layer picker, export, marker details) is open, so Esc should close that first. */
export function isModalDialogOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

/** True when Esc belongs to the focused control (clearing a search box, closing a select). */
export function escapeBelongsToTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, select');
}

/**
 * Locks page scroll and hides the rest of the page from keyboard and screen readers while the atlas is full screen.
 * `inert` doubles as the focus trap: Tab cannot leave the atlas for content hidden behind it.
 */
export function setPageImmersive(on: boolean): void {
  document.documentElement.classList.toggle(DOCUMENT_CLASS, on);
  for (const element of document.querySelectorAll(INERT_TARGETS)) {
    element.toggleAttribute('inert', on);
  }
}
