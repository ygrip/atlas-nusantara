<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { ADMIN_DATA_PATH } from '$lib/atlas/edition';
  import { loadRegions } from '$lib/atlas/regions';
  import { loadLanguages, rankProvinces, type LanguageData } from '$lib/data/languages';

  /** provinceCode is the atlas province (two digits); without it the panel describes Indonesia as a whole. */
  let { provinceCode }: { provinceCode?: string } = $props();

  const TOP_COUNT = 5;
  let data = $state<LanguageData>();
  let names = $state(new Map<string, string>());
  let loading = $state(true);
  let failed = $state(false);

  const ranking = $derived(data ? rankProvinces(data) : []);
  const selected = $derived(ranking.find(item => item.code === provinceCode));
  const rank = $derived(selected ? ranking.indexOf(selected) + 1 : 0);
  const scopeName = $derived.by(() => {
    if (selected) return names.get(selected.code) ?? selected.code;
    return m.level_national();
  });
  const topProvinces = $derived(ranking.slice(0, TOP_COUNT));
  const widest = $derived(ranking.length > 0 ? ranking[0].count : 1);

  onMount(() => {
    let active = true;
    Promise.all([loadLanguages(), loadRegions(ADMIN_DATA_PATH + '/provinces.json')])
      .then(([languages, regions]) => {
        if (!active) return;
        data = languages;
        names = new Map(regions.regions.map(region => [region.code, region.name]));
      })
      .catch(error => {
        if (!active) return;
        failed = true;
        console.warn('Language data unavailable', error);
      })
      .finally(() => { if (active) loading = false; });
    return () => { active = false; };
  });

  function number(value: number): string {
    return new Intl.NumberFormat(getLocale()).format(value);
  }

  function barWidth(value: number): string {
    return (value / widest) * 100 + '%';
  }

  function date(value: string): string {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(new Date(value));
  }
</script>

<section class="language-panel" aria-label={m.layer_languages()} aria-busy={loading}>
  <header>
    <div><h3>{m.layer_languages()} · {scopeName}</h3><p>{m.language_panel_desc()}</p></div>
    <span class="source-badge">Badan Bahasa</span>
  </header>

  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if failed || !data}<p role="alert">{m.data_unavailable()}</p>
  {:else}
    {#if selected}
      <dl class="summary">
        <div><dt>{m.language_count_label()}</dt><dd>{number(selected.count)}</dd></div>
        <div><dt>{m.language_rank()}</dt><dd>#{rank} / {ranking.length}</dd></div>
        <div><dt>{m.language_share()}</dt><dd>{number(Math.round((selected.count / data.totalLanguages) * 100))}%</dd></div>
      </dl>
      <h4>{m.language_list_heading()} · {scopeName}</h4>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard users must be able to scroll a long list) -->
      <ul class="language-list scroll-area" tabindex="0" aria-label={m.language_list_heading() + ' · ' + scopeName}>
        {#each selected.languages as language (language)}<li lang="id">{language}</li>{/each}
      </ul>
    {:else}
      <dl class="summary two">
        <div><dt>{m.language_total()}</dt><dd>{number(data.totalLanguages)}</dd></div>
        <div><dt>{m.language_provinces_covered()}</dt><dd>{number(ranking.length)}</dd></div>
      </dl>
      <h4>{m.language_top_heading()}</h4>
      <ol class="top-list">
        {#each topProvinces as item (item.code)}
          <li><span class="name">{names.get(item.code) ?? item.code}</span><span class="bar" style={`width: ${barWidth(item.count)}`}></span><span class="value">{number(item.count)}</span></li>
        {/each}
      </ol>
      <p class="hint">{m.language_province_hint()}</p>
    {/if}
    <p class="clay-note">{m.language_source_note()}</p>
    <p class="clay-note"><a href={data.sourceUrl} target="_blank" rel="noreferrer">{data.source} ↗</a> · {date(data.fetchedAt)}</p>
  {/if}
</section>

<style>
  .language-panel { margin-top: 20px; padding: 20px; border-radius: 22px; background: var(--surface); box-shadow: var(--clay-pressed); display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h3 { margin: 0 0 6px; }
  h4 { margin: 0; font-size: 1rem; }
  p { margin: 0; font-size: .85rem; color: var(--muted); }
  .source-badge { padding: 6px 10px; border-radius: 12px; background: var(--peach); color: var(--text); font-size: .75rem; font-weight: 900; white-space: nowrap; }
  .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
  .summary.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary div { padding: 12px 14px; border-radius: 16px; background: var(--panel); min-width: 0; }
  .summary dt { font-size: .75rem; font-weight: 800; color: var(--muted); }
  .summary dd { margin: 4px 0 0; font-size: 1.3rem; font-weight: 900; font-variant-numeric: tabular-nums; }
  .language-list { display: flex; flex-wrap: wrap; gap: 8px; max-height: 240px; margin: 0; padding: 4px; overflow: auto; list-style: none; }
  .language-list:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 2px; }
  .language-list li { padding: 6px 12px; border-radius: 999px; background: var(--panel); color: var(--text); font-size: .8rem; font-weight: 750; box-shadow: var(--clay-shadow); }
  .top-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .top-list li { display: grid; grid-template-columns: minmax(110px, 1fr) minmax(0, 2fr) 4ch; align-items: center; gap: 10px; font-size: .85rem; }
  .top-list .name { font-weight: 800; }
  .top-list .bar { display: block; height: 16px; border-radius: 6px; background: var(--accent); }
  .top-list .value { text-align: right; font-weight: 850; font-variant-numeric: tabular-nums; }
  .hint { font-size: .78rem; }
  @media (max-width: 520px) { .summary, .summary.two { grid-template-columns: minmax(0, 1fr); } header { flex-wrap: wrap; } .top-list li { grid-template-columns: minmax(90px, 1fr) minmax(0, 1fr) 4ch; } }
</style>
