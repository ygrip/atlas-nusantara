<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { loadCuisineIndex, loadCuisineProvince, loadCuisineTranslations, type CuisineIndex, type CuisineItem, type CuisineTranslations } from '$lib/data/cuisine';
  import { BookOpen, Clock3, ImageOff, Search } from 'lucide-svelte';

  let { provinceCode }: { provinceCode?: string } = $props();
  const locale = getLocale();
  let index = $state<CuisineIndex>();
  let items = $state<CuisineItem[]>([]);
  let translations = $state<CuisineTranslations|null>(null);
  let query = $state('');
  let expanded = $state<string|null>(null);
  let loading = $state(true);
  let error = $state(false);
  let photoFailures = $state<string[]>([]);
  let limit = $state(24);
  const filtered = $derived(items.filter(item => {
    const term = query.trim().toLocaleLowerCase();
    return !term || (item.name+' '+(item.broadRegion??'')).toLocaleLowerCase().includes(term);
  }));
  const visible = $derived(filtered.slice(0,limit));

  onMount(() => {
    const controller = new AbortController();
    void loadCuisineIndex(controller.signal).then(result => { index = result; })
      .catch(err => { if (!controller.signal.aborted) { console.warn('Cuisine index unavailable',err); error=true; loading=false; } });
    void loadCuisineTranslations(locale,controller.signal).then(value=>{translations=value;})
      .catch(err=>{if(!controller.signal.aborted)console.warn('Cuisine translation fallback to Indonesian',err);});
    return () => controller.abort();
  });
  $effect(() => {
    const nextIndex=index, code=provinceCode?.split('.')[0];
    if (!nextIndex) return;
    const controller=new AbortController();
    loading=true; error=false; expanded=null; limit=24; query='';
    if (!code) { items=nextIndex.featured; loading=false; return; }
    void loadCuisineProvince(nextIndex,code,controller.signal)
      .then(rows=>{if(!controller.signal.aborted){items=rows;loading=false;}})
      .catch(err=>{if(!controller.signal.aborted){console.warn('Cuisine shard unavailable',err);items=[];loading=false;error=true;}});
    return ()=>controller.abort();
  });
  function validTranslation(item:CuisineItem) {
    const candidate=translations?.items[item.id], recipe=item.recipe;
    return candidate && recipe && candidate.ingredients?.length === recipe.ingredients.length
      && candidate.steps?.length === recipe.steps.length ? candidate : null;
  }
</script>

<section class="cuisine-panel" aria-labelledby="cuisine-heading">
  <header class="panel-heading">
    <div>
      <span class="eyebrow"><BookOpen size={16} aria-hidden="true" /> {m.layer_cuisine()}</span>
      <h3 id="cuisine-heading">{m.cuisine_heading()}</h3>
      <p>{m.cuisine_description()}</p>
      {#if index?.scope}<small>{index.scope}</small>{/if}
    </div>
    {#if index}<span class="count">{provinceCode ? items.length : index.totals.dishes} {m.layer_cuisine()}</span>{/if}
  </header>
  <label class="search"><Search size={18} aria-hidden="true" /><input type="search" bind:value={query} placeholder={m.cuisine_search()} aria-label={m.cuisine_search()} /></label>

  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if error}<p role="alert">{m.data_unavailable()}</p>
  {:else if !provinceCode}<p class="hint">{m.cuisine_choose_province()}</p>
  {:else if filtered.length===0}<p role="status">{m.cuisine_empty()}</p>{/if}

  <div class="recipe-grid">
    {#each visible as item (item.id)}
      {@const recipe = item.recipe}
      {@const translation = validTranslation(item)}
      {@const ingredientLines = translation?.ingredients ?? recipe?.ingredients ?? []}
      {@const stepLines = translation?.steps ?? recipe?.steps ?? []}
      <article class="recipe-card">
        <div class="photo">
          {#if item.image && !photoFailures.includes(item.id)}
            <img src={item.image.url} alt={item.name} loading="lazy" decoding="async" onerror={() => {photoFailures=[...photoFailures,item.id];}} />
          {:else}
            <div class="photo-placeholder"><ImageOff size={30} aria-hidden="true"/><small>{m.cuisine_no_image()}</small></div>
          {/if}
        </div>
        <div class="details">
          <h4>{translation?.name || item.name}</h4>
          {#if recipe?.timeMinutes}<p class="time"><Clock3 size={14} aria-hidden="true"/> {recipe.timeMinutes} {m.cuisine_minutes()}</p>{/if}
          <button class="recipe-toggle" disabled={!recipe} onclick={() => {expanded=expanded===item.id?null:item.id;}} aria-expanded={expanded===item.id} type="button">
            {recipe ? m.cuisine_recipe() : m.cuisine_no_recipe()}
          </button>
          {#if expanded===item.id && recipe}
            <div class="recipe-body">
              {#if locale!=='id' && !translation}<p class="language-note">{m.cuisine_id_fallback()}</p>{/if}
              {#if translation?.status==='machine-unreviewed'}<p class="language-note">{m.cuisine_machine_notice()}</p>{/if}
              <h5>{m.cuisine_ingredients()}</h5>
              <ul>{#each ingredientLines as ingredient}<li>{ingredient}</li>{/each}</ul>
              <h5>{m.cuisine_steps()}</h5>
              <ol>{#each stepLines as step}<li>{step}</li>{/each}</ol>
              {#if recipe.sourceUrl}<a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">{m.cuisine_recipe_source()}</a>{/if}
            </div>
          {/if}
          <div class="credits">
            {#if item.image}
              <a href={item.image.descriptionUrl} target="_blank" rel="noopener noreferrer">{item.image.credit} · {item.image.license}</a>
            {/if}
            {#if item.articleUrl}<a href={item.articleUrl} target="_blank" rel="noopener noreferrer">Wikipedia</a>{/if}
          </div>
        </div>
      </article>
    {/each}
  </div>
  {#if !loading && limit < filtered.length}<button class="more" type="button" onclick={() => {limit+=24;}}>{m.cuisine_more()}</button>{/if}
  <p class="source-note"><a href="https://id.wikipedia.org/wiki/Daftar_masakan_Indonesia" target="_blank" rel="noopener noreferrer">Wikipedia</a> · <a href="https://huggingface.co/datasets/LorthGyu/indonesian-recipes" target="_blank" rel="noopener noreferrer">LorthGyu (MIT)</a> · Wikimedia Commons. {m.cuisine_scope_notice()}</p>
</section>

<style>
  .cuisine-panel { margin: 14px 0 0; padding: clamp(14px,2.5vw,24px); border-radius: 22px; background: var(--panel); border:1px solid var(--border); min-width:0; color:var(--text); }
  .panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px}
  .panel-heading h3{font-size:clamp(1.25rem,2.5vw,1.75rem);margin:.4rem 0}
  .panel-heading p,.panel-heading small,.hint,.source-note{color:var(--muted);font-size:.83rem;line-height:1.6;margin:.35rem 0}
  .eyebrow,.time{display:inline-flex;align-items:center;gap:7px;color:var(--muted)}
  .count{flex:none;background:var(--surface);border-radius:18px;padding:8px 12px;font-size:.8rem;font-weight:800}
  .search{display:flex;align-items:center;gap:9px;background:var(--surface);padding:9px 13px;border:1px solid var(--border);border-radius:15px;margin-bottom:15px;box-shadow:inset 0 2px 4px var(--shadow)}
  .search input{width:100%;min-height:28px;border:0;background:none;color:inherit;font:inherit;outline:none}
  .recipe-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:14px}
  .recipe-card{min-width:0;border:1px solid var(--border);border-radius:21px;overflow:hidden;background:var(--surface);box-shadow:0 3px 0 var(--border),inset 0 1px var(--clay-highlight)}
  .photo{height:168px;background:var(--panel);overflow:hidden}
  .photo img{width:100%;height:100%;object-fit:cover}
  .photo-placeholder{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:var(--muted)}
  .details{padding:12px 13px 14px}
  .details h4{margin:0 0 5px;font-size:1rem}
  .time{font-size:.75rem;margin:0 0 10px}
  button{min-height:38px;border:1px solid var(--border);border-radius:13px;background:var(--surface);color:var(--text);font:inherit;font-weight:800;padding:8px 12px;cursor:pointer}
  button:disabled{opacity:.6;cursor:default}
  .recipe-toggle{width:100%;background:var(--panel);box-shadow:0 2px 0 var(--border)}
  .recipe-body{margin:12px 0 8px;font-size:.81rem;line-height:1.58}
  .recipe-body h5{font-size:.84rem;margin:14px 0 6px}
  .recipe-body ul,.recipe-body ol{padding-left:20px;margin:6px 0}
  .recipe-body li{margin:0 0 6px}
  .language-note{color:var(--muted);font-size:.76rem}
  .credits{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px;font-size:.68rem;line-height:1.4}
  .credits a,.recipe-body a,.source-note a{color:var(--accent);overflow-wrap:anywhere}
  .more{margin:18px auto 4px;display:block}
  .source-note{margin-top:18px}
  @media(max-width:540px){.photo{height:175px}.recipe-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,165px),1fr))}}
</style>
