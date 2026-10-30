<script lang="ts">
  import EditorialLayout from '$lib/components/EditorialLayout.svelte';
  import ContentBlocks from '$lib/components/ContentBlocks.svelte';
  import InlineText from '$lib/components/InlineText.svelte';
  import { jsonLd, plainText } from '$lib/content/editorial';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const about = $derived(data.about);
  const faqSchema = $derived({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: about.faq.map(entry => ({ '@type': 'Question', name: plainText(entry.question), acceptedAnswer: { '@type': 'Answer', text: plainText(entry.answer) } }))
  });
</script>

<svelte:head>{@html '<script type="application/ld+json">' + jsonLd(faqSchema) + '</script>'}</svelte:head>

<EditorialLayout title={about.title} description={about.description} eyebrow="About the atlas" updated={about.updated}>
  {#each about.intro as paragraph, index (index)}<p><InlineText text={paragraph} /></p>{/each}

  <h2 id="key-features">Key features</h2>
  <ul>
    {#each about.features as feature, index (index)}<li><strong>{feature.title}.</strong> <InlineText text={feature.body} /></li>{/each}
  </ul>

  <h2 id="technical-reference">{about.reference.title}</h2>
  {#each about.reference.sections as section, index (index)}
    <h3>{section.heading}</h3>
    <ContentBlocks blocks={section.blocks} />
  {/each}

  <h2 id="example">{about.example.title}</h2>
  <ContentBlocks blocks={about.example.blocks} />

  <h2 id="limitations">Limitations</h2>
  <ul>{#each about.limits as limit, index (index)}<li><InlineText text={limit} /></li>{/each}</ul>

  <h2 id="faq">Frequently asked questions</h2>
  {#each about.faq as entry, index (index)}
    <details><summary><InlineText text={entry.question} /></summary><p><InlineText text={entry.answer} /></p></details>
  {/each}

  {#if data.guides.length > 0}
    <h2 id="guides">Guides</h2>
    <ul>{#each data.guides as guide (guide.slug)}<li><a href={'/guides/' + guide.slug}>{guide.title}</a>: {guide.description}</li>{/each}</ul>
  {/if}
</EditorialLayout>
