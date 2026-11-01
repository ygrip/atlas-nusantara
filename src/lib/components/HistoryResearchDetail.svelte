<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import { historySourceClaim, type HistoryDossier, type HistoryResearch } from '$lib/data/history-catalogue';
  let { dossier, research, embedded = false }: { dossier: HistoryDossier; research: HistoryResearch; embedded?: boolean } = $props();
  const sections = $derived(research.genealogy_sections.filter(section => dossier.properties.genealogy_sections.some(reference => reference.name === section.name)));
</script>

<header><span class="research-chip">{m.history_research_detail()}</span>{#if embedded}<h5 class="dossier-title">{dossier.properties.source_label}</h5>{:else}<h4>{dossier.properties.source_label}</h4>{/if}<span class="research-chip">{m.history_dates_unknown()}</span></header>
<p class="research-warning">{m.history_evidence_warning()}</p>
{#if dossier.properties.source_claim_wikitext_id}<section class="evidence"><h5>{m.history_sources()}</h5><p lang="id">{historySourceClaim(dossier.properties.source_claim_wikitext_id)}</p><a href={dossier.properties.source_url} target="_blank" rel="noreferrer">Wikipedia · CC BY-SA 4.0</a></section>{/if}
{#if dossier.properties.web_research}
  <section class="evidence"><h5>{m.history_research_detail()}</h5>
    {#if dossier.properties.web_research.factual_claim}<p lang="en">{dossier.properties.web_research.factual_claim}</p>{/if}
    <p class="research-warning" lang="en">{dossier.properties.web_research.uncertain_or_missing}</p>
    {#each dossier.properties.web_research.sources as source, index (`${source.url}-${index}`)}<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>{/each}
  </section>
{/if}
{#if dossier.properties.book_mentions?.length}
  <section class="evidence"><h5>{m.history_sources()}</h5>
    {#each dossier.properties.book_mentions as mention (mention.file)}
      <details><summary lang="id">{mention.book_title}</summary><p>PDF · {mention.pages.join(', ')}</p></details>
    {/each}
  </section>
{/if}
{#each dossier.properties.articles as article (article.url)}
  <section class="evidence">
    <h5 lang={article.language}>{article.title}</h5><p lang={article.language}>{article.summary}</p>
    {#if article.reported_fields.length}
      <details><summary>{m.history_reported_fields()}</summary><dl>{#each article.reported_fields as field, index (`${field.field}-${index}`)}<div><dt>{field.field}</dt><dd>{historySourceClaim(field.source_expression)}</dd></div>{/each}</dl></details>
    {/if}
    <a href={article.url} target="_blank" rel="noreferrer">Wikipedia · {article.revision} · CC BY-SA 4.0</a>
  </section>
{/each}
{#each sections as section (section.name)}
  <section class="evidence">
    <h5>{section.name}</h5>
    <a href={`https://dataverse.nl/api/access/datafile/617869#page=${section.pages[0].pdf_page}`} target="_blank" rel="noreferrer">Hägerdal · 2026 · {section.pages[0].pdf_page}–{section.pages.at(-1)?.pdf_page} · CC BY 4.0</a>
    <details><summary>{m.history_genealogy_source()}</summary>{#each section.pages as page (page.pdf_page)}<pre lang="en" aria-label={`PDF ${page.pdf_page}`}>{page.text}</pre>{/each}</details>
  </section>
{/each}

<style>
  header{display:grid;justify-items:start;gap:12px}h4,h5,p{margin:0}h4,.dossier-title{font-size:1.18rem;line-height:1.35;overflow-wrap:anywhere}.dossier-title{font-size:1rem}h5{font-size:.88rem;color:var(--accent-strong)}
  .research-chip{padding:5px 9px;border-radius:10px;background:var(--mint);color:var(--accent-strong);font-size:.75rem;font-weight:850;box-shadow:0 2px 0 var(--border),inset 1px 1px 2px var(--clay-highlight)}
  .evidence{display:grid;gap:10px;padding:13px;border:1px solid var(--border);border-radius:17px;background:var(--panel);box-shadow:inset 1px 1px 3px var(--clay-highlight),0 2px 0 -1px var(--border);min-width:0}
  p{font-size:.84rem;line-height:1.65;color:var(--text);overflow-wrap:anywhere}.research-warning{font-size:.78rem;color:var(--muted)}a{color:var(--accent-strong);font-size:.78rem;min-height:44px;display:flex;align-items:center;overflow-wrap:anywhere}
  details{min-width:0}summary{min-height:44px;padding:9px;border-radius:11px;background:var(--surface);font-size:.8rem;font-weight:800;cursor:pointer;box-shadow:0 2px 0 var(--border)}summary:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
  pre{max-width:100%;padding:10px;overflow:auto;border-radius:11px;background:var(--surface);font-size:.7rem;line-height:1.6;color:var(--text)}dl{font-size:.75rem}dl div{padding:7px 0;border-bottom:1px solid var(--border)}dt{font-weight:800}dd{margin:5px 0;overflow-wrap:anywhere}
</style>
