/** Page-level choreography only. The map owns its own camera and consumes wheel events inside its plane. */
export function startAtlasStory(root: HTMLElement): () => void {
  let disposed = false;
  let cleanup = () => {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return cleanup;

  async function initialize() {
    const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
      import('gsap'), import('gsap/ScrollTrigger'), import('lenis')
    ]);
    if (disposed) return;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      autoRaf: true, anchors: false, duration: 0.8,
      prevent: node => Boolean(node.closest('.atlas-map, dialog, .table-scroll, .region-list, .quick-menu, .language-dialog'))
    });
    lenis.on('scroll', ScrollTrigger.update);
    const context = gsap.context(() => {
      gsap.fromTo('.hero-copy > *', { y: 12, opacity: 0.8 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: 'power2.out', clearProps: 'transform,opacity' });
      for (const heading of root.querySelectorAll('main > section h2')) {
        gsap.fromTo(heading, { y: 8, opacity: 0.8 }, {
          y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', clearProps: 'transform,opacity',
          scrollTrigger: { trigger: heading, start: 'top 92%', once: true }
        });
      }
    }, root);
    cleanup = () => { context.revert(); lenis.destroy(); };
    if (disposed) cleanup();
  }
  void initialize().catch(error => console.warn('Page motion unavailable; native navigation remains enabled', error));
  return () => { disposed = true; cleanup(); };
}
