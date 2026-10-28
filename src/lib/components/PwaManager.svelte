<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, RefreshCw, Smartphone } from 'lucide-svelte';
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
  let workerReady = false;
  let available = false;
  let applying = false;
  let checking = false;
  let showGuide = false;
  let status = '';
  let supported = false;
  let updateTimeout: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    const mode = matchMedia('(display-mode: standalone)');
    const device = matchMedia('(max-width: 760px) and (pointer: coarse)');
    function detectMobile() { mobile = device.matches; }
    detectMobile();
    device.addEventListener('change', detectMobile);
    function detectInstalled() { installed = mode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone); }
    function installReady(event: Event) { event.preventDefault(); prompt = event as InstallPrompt; }
    function appInstalled() { installed = true; prompt = undefined; showGuide = false; status = m.pwa_installed(); }
    detectInstalled();
    mode.addEventListener('change', detectInstalled);
    window.addEventListener('beforeinstallprompt', installReady);
    window.addEventListener('appinstalled', appInstalled);
    supported = !dev && isSecureContext && 'serviceWorker' in navigator;
    if (supported) updates = watchUpdates({
      ready: () => workerReady = true,
      waiting: () => available = true,
      controllerChanged: previouslyControlled => {
        if (applying) { clearTimeout(updateTimeout); location.reload(); return; }
        // Another tab may accept an update. This tab still waits for its own consent.
        if (previouslyControlled) available = true;
      },
      checked: () => status = m.pwa_checked(),
      failed: (error, manual) => { console.warn('PWA update check failed', error); if (manual) status = m.pwa_update_error(); }
    });
    return () => {
      updates?.destroy(); clearTimeout(updateTimeout);
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
  async function check() {
    checking = true;
    try { await updates?.check(true); } finally { checking = false; }
  }
  function applyUpdate() {
    applying = true;
    if (!updates?.activate()) { location.reload(); return; }
    updateTimeout = setTimeout(() => { applying = false; status = m.pwa_update_error(); }, 10000);
  }
</script>

{#if mobile && !installed}
<section class="pwa-panel" aria-label={m.pwa_heading()}>
  <div class="pwa-intro">
    <span class="pwa-icon" aria-hidden="true"><Smartphone size={23} strokeWidth={2.2} /></span>
    <div class="pwa-copy"><strong>{m.pwa_heading()}</strong><p>{m.pwa_description()}</p></div>
  </div>
  <div class="pwa-actions">
    <button class="pwa-install" type="button" onclick={install} disabled={installed}>
      <Download size={17} strokeWidth={2.4} aria-hidden="true" />
      <span>{#if installed}{m.pwa_installed()}{:else}{m.pwa_install()}{/if}</span>
    </button>
    <button class="pwa-secondary" type="button" onclick={check} disabled={!workerReady || checking}>
      <RefreshCw size={16} strokeWidth={2.3} aria-hidden="true" />
      <span>{m.pwa_check_updates()}</span>
    </button>
  </div>
  {#if showGuide}<p class="pwa-message pwa-guide" role="status">{m.pwa_manual_install()}</p>{/if}
  {#if !supported}<p class="pwa-message">{m.pwa_unavailable()}</p>{/if}
  {#if status}<p class="pwa-message" role="status">{status}</p>{/if}
</section>
{/if}

{#if installed}
  <button class="pwa-check" type="button" onclick={check} disabled={!workerReady || checking}>{m.pwa_check_updates()}</button>
  {#if status}<p role="status">{status}</p>{/if}
{/if}

{#if available}
  <aside class="pwa-update" role="status" aria-live="polite">
    <strong>{m.pwa_update_ready()}</strong><p>{m.pwa_update_explanation()}</p>
    <div class="pwa-actions"><button type="button" onclick={applyUpdate} disabled={applying}>{m.pwa_update_reload()}</button><button type="button" onclick={() => available = false} disabled={applying}>{m.pwa_later()}</button></div>
  </aside>
{/if}

<style>
  .pwa-check { justify-self: start; }
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
  .pwa-update { position: fixed; z-index: 30; bottom: 16px; right: 16px; width: min(370px, calc(100vw - 32px)); padding: 22px; background: var(--surface); color: var(--text); border: 2px solid var(--accent); border-radius: 20px; box-shadow: 0 12px 32px #0003; }
  .pwa-update .pwa-actions { margin-top: 14px; }
  @media (max-width: 560px) {
    .pwa-panel { grid-template-columns: minmax(0, 1fr); gap: 16px; }
    .pwa-actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); justify-content: stretch; }
    .pwa-actions button { min-width: 0; padding-inline: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    button { transition: none; }
  }
</style>
