<script lang="ts">
  import EditorialLayout from '$lib/components/EditorialLayout.svelte';
  import ContentBlocks from '$lib/components/ContentBlocks.svelte';
  import InlineText from '$lib/components/InlineText.svelte';
  import { jsonLd } from '$lib/content/editorial';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const guide = $derived(data.guide);
  const url = $derived('https://nusantara.readynaz.com/guides/' + guide.slug);
  const articleSchema = $derived({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    datePublished: guide.published,
    dateModified: guide.updated,
    inLanguage: 'en',
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: 'Yunaz Gilang Ramadhan', url: 'https://readynaz.com/about/' },
    publisher: { '@type': 'Organization', name: 'Atlas Nusantara' }
  });
</script>

<svelte:head>{@html '<script type="application/ld+json">' + jsonLd(articleSchema) + '</script>'}</svelte:head>

<EditorialLayout title={guide.title} description={guide.description} eyebrow="Guide" updated={guide.updated}>
  {#each guide.intro as paragraph, index (index)}<p><InlineText text={paragraph} /></p>{/each}
  {#each guide.sections as section, index (index)}
    <h2>{section.heading}</h2>
    <ContentBlocks blocks={section.blocks} />
  {/each}
  <p><a href="/" data-sveltekit-reload>Open the atlas</a> · <a href="/guides">All guides</a> · <a href="/about">About the atlas</a></p>
</EditorialLayout>
