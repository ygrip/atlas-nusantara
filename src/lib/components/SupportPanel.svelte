<script lang="ts">
  import { m, type MessageKey } from '$lib/i18n/messages';
  import { ExternalLink } from 'lucide-svelte';

  const options: { id: string; name: string; href: string; tone: string; note: MessageKey }[] = [
    { id: 'trakteer', name: 'Trakteer', href: 'https://trakteer.id/yunaz_gilang', tone: 'peach', note: 'support_trakteer_note' },
    { id: 'kofi', name: 'Ko-fi', href: 'https://ko-fi.com/ygrip', tone: 'mint', note: 'support_kofi_note' },
    { id: 'patreon', name: 'Patreon', href: 'https://www.patreon.com/c/ygrip', tone: 'lilac', note: 'support_patreon_note' }
  ];
</script>

<section id="support" class="support-panel clay-card" aria-labelledby="support-heading">
  <div class="support-copy">
    <span class="eyebrow">{m.support_eyebrow()}</span>
    <h2 id="support-heading">{m.support_heading()}</h2>
    <p>{m.support_description()}</p>
    <a class="support-maker" href="https://readynaz.com" target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" />{m.support_maker()}</a>
  </div>
  <ul class="support-options" aria-label={m.support_action()}>
    {#each options as option (option.id)}
      <li><a class={'support-option tone-' + option.tone} href={option.href} target="_blank" rel="noopener noreferrer">
        <span class="support-icon"><img src={'/brand/support-' + option.id + '.svg'} alt="" width="28" height="28" /></span>
        <span class="support-text"><strong>{option.name}</strong><small>{m[option.note]()}</small></span>
        <ExternalLink size={16} aria-hidden="true" />
      </a></li>
    {/each}
  </ul>
</section>
