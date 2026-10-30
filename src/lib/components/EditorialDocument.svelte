<script lang="ts">
  import InlineText from './InlineText.svelte';
  let { text }: { text: string } = $props();
  // Editorial copy comes from the same Paraglide-checked dictionaries as the atlas UI.
  // Plain text nodes and the restricted InlineText parser keep translations escaped.
  const blocks = $derived(text.trim().split(/\n\s*\n/g).filter(Boolean));
</script>

{#each blocks as block, index (index)}
  {#if block.startsWith('## ')}
    <h2>{block.slice(3)}</h2>
  {:else if block.startsWith('### ')}
    <h3>{block.slice(4)}</h3>
  {:else}
    <p><InlineText text={block.replace(/\n/g, ' ')} /></p>
  {/if}
{/each}
