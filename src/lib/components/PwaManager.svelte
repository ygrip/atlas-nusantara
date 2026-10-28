<script lang="ts">
  import { onMount } from 'svelte';
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
  <div><strong>{m.pwa_heading()}</strong><p>{m.pwa_description()}</p></div>
  <div class="pwa-actions">
    <button type="button" onclick={install} disabled={installed}>{#if installed}{m.pwa_installed()}{:else}{m.pwa_install()}{/if}</button>
    <button type="button" onclick={check} disabled={!workerReady || checking}>{m.pwa_check_updates()}</button>
  </div>
  {#if showGuide}<p class="pwa-guide" role="status">{m.pwa_manual_install()}</p>{/if}
  {#if !supported}<p>{m.pwa_unavailable()}</p>{/if}
  {#if status}<p role="status">{status}</p>{/if}
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
  .pwa-panel { padding: clamp(18px, 3vw, 28px); background: linear-gradient(150deg, var(--sky), var(--surface)); display: flex; align-items: center; flex-wrap: wrap; gap: 16px; min-width: 0; }
  .pwa-panel > div:first-child { flex: 1; min-width: 200px; }
  p { color: var(--muted); font-size: .8rem; line-height: 1.6; margin: 8px 0 0; }
  .pwa-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 44px; border: 2px solid var(--border); border-radius: 14px; padding: 9px 16px; background: var(--surface); color: var(--text); font: inherit; font-size: .8rem; font-weight: 800; box-shadow: 0 4px 0 var(--shadow); }
  button:active:not(:disabled) { transform: translateY(3px); box-shadow: none; }
  button:disabled { opacity: .55; }
  .pwa-guide { width: 100%; }
  .pwa-update { position: fixed; z-index: 30; bottom: 16px; right: 16px; width: min(370px, calc(100vw - 32px)); padding: 22px; background: var(--surface); color: var(--text); border: 2px solid var(--accent); border-radius: 20px; box-shadow: 0 12px 32px #0003; }
  .pwa-update .pwa-actions { margin-top: 14px; }
</style>
