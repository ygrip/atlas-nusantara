import { fade } from 'svelte/transition';

/** An outgoing label must stop acting like a live polity before its fade finishes. */
export function fadeHistoryLabel(node: Element, options: { duration: number }) {
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('tabindex', '-1');
  node.setAttribute('inert', '');
  node.setAttribute('pointer-events', 'none');
  return fade(node, options);
}
