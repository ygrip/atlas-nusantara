<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Smartphone } from 'lucide-svelte';
  import { dev } from '$app/environment';
  import { m } from '$lib/i18n/messages';
  import { watchUpdates } from '$lib/pwa/updates';

  interface InstallPrompt extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
  let prompt: InstallPrompt | undefined;
  let updates: ReturnType<typeof watchUpdates> | undefined;
  let installed = false;
  let mobile = false;
  let showGuide = false;
  let status = '';
  let supported = false;

  onMount(() => {
    const mode = matchMedia('(display-mode: standalone)');
    const device = matchMedia('(max-width: 760px) and (pointer: coarse)');
    function detectMobile() { mobile = device.matches; }
    detectMobile();
    device.addEventListener('change', detectMobile);
    function detectInstalled() { installed = mode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone); }
    function installReady(event: Event) { event.preventDefault(); prompt = event as InstallPrompt; }
    function appInstalled() { installed = true; prompt = undefined; showGuide = false; status = ''; }
    detectInstalled();
    mode.addEventListener('change', detectInstalled);
    window.addEventListener('beforeinstallprompt', installReady);
    window.addEventListener('appinstalled', appInstalled);
    supported = !dev && isSecureContext && 'serviceWorker' in navigator;
    // Check in the background; the browser activates waiting updates after old app windows close.
    if (supported) updates = watchUpdates({
      failed: error => console.warn('PWA update check failed', error)
    });
    return () => {
      updates?.destroy();
      mode.removeEventListener('change', detectInstalled);
      device.removeEventListener('change', detectMobile);
      window.removeEventListener('beforeinstallprompt', installReady);
      window.removeEventListener('appinstalled', appInstalled);
    };
  });

  async function install() {
    if (!prompt) { showGuide = !showGuide; return; }
    const invitation = prompt;
    prompt = undefined;
    try {
      await invitation.prompt();
      const choice = await invitation.userChoice;
      if (choice.outcome === 'accepted') status = m.pwa_install_requested();
    } catch (error) { console.warn('Installation prompt unavailable', error); showGuide = true; }
  }
</script>

{#if mobile && !installed}
<section class="pwa-panel" aria-label={m.pwa_heading()}>
  <div class="pwa-intro">
    <span class="pwa-icon" aria-hidden="true"><Smartphone size={23} strokeWidth={2.2} /></span>
    <div class="pwa-copy"><strong>{m.pwa_heading()}</strong><p>{m.pwa_description()}</p></div>
  </div>
  <div class="pwa-actions">
    <button class="pwa-install" type="button" onclick={install}>
      <Download size={17} strokeWidth={2.4} aria-hidden="true" />
      <span>{m.pwa_install()}</span>
    </button>
  </div>
  {#if showGuide}<p class="pwa-message pwa-guide" role="status">{m.pwa_manual_install()}</p>{/if}
  {#if !supported}<p class="pwa-message">{m.pwa_unavailable()}</p>{/if}
  {#if status}<p class="pwa-message" role="status">{status}</p>{/if}
</section>
{/if}

<style>
  .pwa-panel {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 20px 24px;
    min-width: 0;
    padding: clamp(18px, 3vw, 28px);
    border: 1px solid color-mix(in srgb, var(--clay-highlight) 75%, var(--border));
    border-radius: var(--clay-radius, 28px);
    background: linear-gradient(145deg, color-mix(in srgb, var(--sky) 72%, var(--surface)), var(--surface) 70%);
    box-shadow: inset 1px 1px 0 var(--clay-highlight), inset 0 -2px 0 color-mix(in srgb, var(--shadow) 28%, transparent), 0 12px 28px color-mix(in srgb, var(--shadow) 52%, transparent);
  }
  .pwa-panel::before {
    position: absolute;
    z-index: -1;
    top: -70%;
    left: -8%;
    width: 65%;
    height: 150%;
    border-radius: 50%;
    background: radial-gradient(ellipse, color-mix(in srgb, var(--clay-highlight) 54%, transparent), transparent 70%);
    content: '';
    pointer-events: none;
  }
  .pwa-intro { display: flex; align-items: center; gap: 15px; min-width: 0; }
  .pwa-icon {
    display: grid;
    flex: 0 0 52px;
    width: 52px;
    height: 52px;
    place-items: center;
    color: var(--accent-strong);
    border: 1px solid color-mix(in srgb, var(--clay-highlight) 80%, var(--border));
    border-radius: 18px;
    background: linear-gradient(145deg, var(--surface), color-mix(in srgb, var(--sky) 68%, var(--panel)));
    box-shadow: inset 1px 1px 0 var(--clay-highlight), 0 5px 0 color-mix(in srgb, var(--shadow) 42%, transparent), 0 8px 14px color-mix(in srgb, var(--shadow) 32%, transparent);
  }
  .pwa-copy { min-width: 0; }
  .pwa-copy strong { color: var(--text); font-size: 1rem; font-weight: 850; letter-spacing: -.02em; }
  p { color: var(--muted); font-size: .8rem; line-height: 1.6; margin: 6px 0 0; }
  .pwa-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
  button {
    display: inline-flex;
    min-height: 48px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    border: 1px solid color-mix(in srgb, var(--clay-highlight) 72%, var(--border));
    border-radius: 16px;
    padding: 10px 17px;
    background: linear-gradient(145deg, var(--surface), color-mix(in srgb, var(--panel) 72%, var(--surface)));
    color: var(--text);
    font: inherit;
    font-size: .8rem;
    font-weight: 800;
    box-shadow: inset 1px 1px 0 var(--clay-highlight), 0 4px 0 color-mix(in srgb, var(--shadow) 58%, transparent), 0 7px 14px color-mix(in srgb, var(--shadow) 28%, transparent);
    cursor: pointer;
    transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
  }
  button:hover:not(:disabled) { filter: brightness(1.035); transform: translateY(-1px); }
  button:active:not(:disabled) { transform: translateY(3px); box-shadow: inset 0 2px 4px color-mix(in srgb, var(--shadow) 35%, transparent); }
  button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  button:disabled { opacity: .58; cursor: not-allowed; box-shadow: inset 1px 1px 0 var(--clay-highlight), 0 2px 0 color-mix(in srgb, var(--shadow) 32%, transparent); }
  .pwa-actions .pwa-install {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    background: linear-gradient(145deg, color-mix(in srgb, var(--accent-strong) 84%, white), var(--accent));
    color: var(--on-accent);
    box-shadow: inset 1px 1px 0 color-mix(in srgb, white 55%, transparent), 0 4px 0 color-mix(in srgb, var(--accent-strong) 70%, #251719), 0 8px 16px color-mix(in srgb, var(--accent) 24%, transparent);
  }
  .pwa-actions .pwa-install:active:not(:disabled) { box-shadow: inset 0 2px 5px color-mix(in srgb, #241116 32%, transparent); }
  .pwa-message { grid-column: 1 / -1; margin: -8px 0 0; }
  @media (max-width: 560px) {
    .pwa-panel { grid-template-columns: minmax(0, 1fr); gap: 16px; }
    .pwa-actions { justify-content: stretch; }
    .pwa-actions button { flex: 1; min-width: 0; padding-inline: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    button { transition: none; }
  }
</style>
