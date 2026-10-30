<script lang="ts">
  import type { ContentBlock } from '$lib/content/types';
  import InlineText from './InlineText.svelte';

  let { blocks }: { blocks: ContentBlock[] } = $props();
</script>

{#each blocks as block, index (index)}
  {#if block.type === 'p'}
    <p><InlineText text={block.text} /></p>
  {:else if block.type === 'note'}
    <p class="content-note"><InlineText text={block.text} /></p>
  {:else if block.type === 'list' && block.ordered}
    <ol>{#each block.items as item, itemIndex (itemIndex)}<li><InlineText text={item} /></li>{/each}</ol>
  {:else if block.type === 'list'}
    <ul>{#each block.items as item, itemIndex (itemIndex)}<li><InlineText text={item} /></li>{/each}</ul>
  {:else if block.type === 'code'}
    <pre class="content-code" data-language={block.language}><code>{block.code}</code></pre>
  {:else if block.type === 'table'}
    <!-- Scrollable region must be keyboard-focusable (WCAG 2.1.1). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="content-table" role="region" aria-label={block.head.join(', ')} tabindex="0">
      <table>
        <thead><tr>{#each block.head as cell, cellIndex (cellIndex)}<th scope="col"><InlineText text={cell} /></th>{/each}</tr></thead>
        <tbody>{#each block.rows as row, rowIndex (rowIndex)}<tr>{#each row as cell, cellIndex (cellIndex)}<td><InlineText text={cell} /></td>{/each}</tr>{/each}</tbody>
      </table>
    </div>
  {/if}
{/each}
