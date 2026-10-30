<script lang="ts">
  import { inlineTokens } from '$lib/content/schema.js';

  let { text }: { text: string } = $props();
  const tokens = $derived(inlineTokens(text));
</script>

{#each tokens as token, index (index)}{#if token.kind === 'code'}<code>{token.value}</code>{:else if token.kind === 'strong'}<strong>{token.value}</strong>{:else if token.kind === 'link' && token.external}<a href={token.href} target="_blank" rel="noopener">{token.value}</a>{:else if token.kind === 'link'}<a href={token.href}>{token.value}</a>{:else}{token.value}{/if}{/each}
