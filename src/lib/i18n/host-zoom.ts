/**
 * Keep browser magnification fixed on the page, but let the map handle its own pinch,
 * wheel and trackpad zoom. Elements marked data-map-zoom (the map) are exempt.
 */
const MAP_SELECTOR = '[data-map-zoom]';

function isOnMap(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(MAP_SELECTOR) !== null;
}

export function containPageZoom(document: Document): () => void {
  const preventWheelZoom = (event: WheelEvent) => {
    if (isOnMap(event.target)) return;
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  };
  const preventKeyZoom = (event: KeyboardEvent) => {
    const isZoomKey = ['+', '=', '-', '0'].includes(event.key);
    if ((event.ctrlKey || event.metaKey) && isZoomKey) event.preventDefault();
  };
  const preventPinchZoom = (event: TouchEvent) => {
    if (isOnMap(event.target)) return;
    if (event.touches.length > 1) event.preventDefault();
  };
  const preventGestureZoom = (event: Event) => {
    if (isOnMap(event.target)) return;
    event.preventDefault();
  };
  document.addEventListener('wheel', preventWheelZoom, { passive: false });
  document.addEventListener('keydown', preventKeyZoom);
  document.addEventListener('touchstart', preventPinchZoom, { passive: false });
  document.addEventListener('touchmove', preventPinchZoom, { passive: false });
  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  return () => {
    document.removeEventListener('wheel', preventWheelZoom);
    document.removeEventListener('keydown', preventKeyZoom);
    document.removeEventListener('touchstart', preventPinchZoom);
    document.removeEventListener('touchmove', preventPinchZoom);
    document.removeEventListener('gesturestart', preventGestureZoom);
    document.removeEventListener('gesturechange', preventGestureZoom);
  };
}
