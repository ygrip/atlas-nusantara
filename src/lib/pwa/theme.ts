export async function changeTheme(control: HTMLElement, update: () => void): Promise<void> {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  const rectangle = control.getBoundingClientRect();
  const centerX = rectangle.left + rectangle.width / 2;
  const centerY = rectangle.top + rectangle.height / 2;
  const endRadius = Math.hypot(Math.max(centerX, innerWidth - centerX), Math.max(centerY, innerHeight - centerY));
  const transition = document.startViewTransition(update);
  try {
    await transition.ready;
    await document.documentElement.animate({ clipPath: [`circle(0 at ${centerX}px ${centerY}px)`, `circle(${endRadius}px at ${centerX}px ${centerY}px)`] }, { pseudoElement: '::view-transition-new(root)', duration: 450, easing: 'ease-out' }).finished;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('Theme reveal unavailable', error);
  }
  await transition.updateCallbackDone;
}
