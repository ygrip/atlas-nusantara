<script lang="ts">
  import { onMount } from 'svelte';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { m } from '$lib/paraglide/messages.js';
  import { assetUrl } from '$lib/pwa/assets';
  import { BookOpen, Clock, ExternalLink, ImageOff, Search, Utensils } from 'lucide-svelte';

  type Photo = {url:string;descriptionUrl:string;credit:string;license:string;licenseUrl:string;reviewedAt:string};
  type Instructions = {name?:string;ingredients:string[];steps:string[];status:'reviewed'|'machine-unreviewed'};
  type Recipe = {ingredients:string[];steps:string[];timeMinutes:number|null;difficulty:string|null;
    sourceRegion:string|null;language:'id';sourceUrl:string;license:string};
  type Dish = {id:string;name:string;provinceCodes:string[];category:string;image:Photo|null;
    recipe:Recipe|null; sourceUrls:string[];translations?:Record<string,Instructions>};
  type Catalog = {schemaVersion:number;dishes:Dish[];recipes:number;fetchedAt:string};
  let { provinceCode }: {provinceCode?:string} = $props();
  let catalog = $state<Catalog|null>(null);
  let error = $state(false);
  let query = $state('');
  let filter = $state<'all'|'recipe'|'listed'>('all');
  let limit = $state(24);
  let expanded = $state<string|null>(null);
  let failedPhotos = $state<string[]>([]);
  const filtered = $derived((catalog?.dishes ?? []).filter(dish=>{
    if(provinceCode && !dish.provinceCodes.includes(provinceCode)) return false;
    if(filter==='recipe' && !dish.recipe) return false;
    if(filter==='listed' && dish.recipe) return false;
    return !query.trim() || (dish.name+' '+(dish.recipe?.ingredients.join(' ')??'')).toLocaleLowerCase('id')
      .includes(query.trim().toLocaleLowerCase('id'));
  }));
  const shown = $derived(filtered.slice(0,limit));
  const chosen = $derived((catalog?.dishes??[]).find(dish=>dish.id===expanded));
  const chosenLocale = $derived(getLocale());
  const displayedRecipe = $derived(chosen?.recipe ? chosen.translations?.[chosenLocale] : undefined);
  const recipeIngredients = $derived(displayedRecipe?.ingredients ?? chosen?.recipe?.ingredients ?? []);
  const recipeSteps = $derived(displayedRecipe?.steps ?? chosen?.recipe?.steps ?? []);
  onMount(()=>{
    const controller = new AbortController();
    fetch(assetUrl('/data/cuisine/catalog.json'),{signal:controller.signal})
      .then(response=>{if(!response.ok) throw Error('Catalog missing');return response.json()})
      .then((data:Catalog)=>{
        if(data.schemaVersion!==1 || !Array.isArray(data.dishes)
          || data.dishes.some(item=>typeof item.id!=='string'||!Array.isArray(item.provinceCodes))) throw Error('Invalid catalog');
        catalog=data;
      })
      .catch(e=>{if(!controller.signal.aborted){console.warn('Cuisine catalog unavailable',e); error=true;}});
    return ()=>controller.abort();
  });
  function selectRecipe(id:string) { expanded=expanded===id?null:id; }
</script>

<section class="cuisine-panel" aria-label={m.layer_cuisine()}>
  <header class="cuisine-title">
    <span class="cuisine-eyebrow"><Utensils size={16} aria-hidden="true"/>{m.layer_cuisine()}</span>
    <p>{m.cuisine_provenance_note()}</p>
  </header>
  {#if error}
    <p role="alert">{m.data_unavailable()}</p>
  {:else if !catalog}
    <p role="status">{m.loading_data()}</p>
  {:else}
    <div class="cuisine-count">{filtered.length.toLocaleString()} {m.cuisine_dishes()} · {filtered.filter(d=>d.recipe).length.toLocaleString()} {m.cuisine_recipes()}</div>
    <div class="cuisine-filters">
      <label class="cuisine-search"><Search size={16} aria-hidden="true"/><input type="search" bind:value={query} placeholder={m.cuisine_search()} aria-label={m.cuisine_search()}/></label>
      <label class="filter-label">{m.cuisine_show()}
        <select bind:value={filter}>
          <option value="all">{m.cuisine_all()}</option>
          <option value="recipe">{m.cuisine_has_recipe()}</option>
          <option value="listed">{m.cuisine_listed_only()}</option>
        </select>
      </label>
    </div>
    {#if !provinceCode}<p class="cuisine-hint">{m.cuisine_choose_province()}</p>{/if}
    {#if !filtered.length}<p role="status">{m.cuisine_empty()}</p>{/if}
    <div class="cuisine-results">
      {#each shown as dish (dish.id)}
        <article class="dish-card">
          <button class="dish-trigger" type="button" aria-expanded={expanded===dish.id} onclick={()=>selectRecipe(dish.id)}>
            <span class="dish-photo">
              {#if dish.image && !failedPhotos.includes(dish.id)}
                <img src={dish.image.url} loading="lazy" decoding="async" alt={dish.name} onerror={()=>failedPhotos=[...failedPhotos,dish.id]}/>
              {:else}<ImageOff size={24} aria-label={m.cuisine_no_photo()}/>{/if}
            </span>
            <span class="dish-summary"><strong>{dish.translations?.[chosenLocale]?.name ?? dish.name}</strong>
              <small>{dish.recipe ? m.cuisine_has_recipe() : m.cuisine_listed_only()}
                {#if dish.recipe?.timeMinutes} · {dish.recipe.timeMinutes} {m.cuisine_minutes()}{/if}
              </small></span>
            <span class="dish-chevron" aria-hidden="true">{expanded===dish.id ? '−' : '+'}</span>
          </button>
          {#if expanded===dish.id}
            <div class="dish-body">
              {#if dish.image}
                <p class="photo-credit"><a href={dish.image.descriptionUrl} target="_blank" rel="noopener noreferrer">{dish.image.credit}</a> ·
                  <a href={dish.image.licenseUrl} target="_blank" rel="noopener noreferrer">{dish.image.license}</a></p>
              {/if}
              {#if dish.recipe}
                {#if chosenLocale!=='id' && !displayedRecipe}
                  <p class="original-note" role="note">{m.cuisine_original_language()}</p>
                {:else if displayedRecipe?.status==='machine-unreviewed'}
                  <p class="original-note" role="note">{m.cuisine_machine_translation()}</p>
                {/if}
                {#if dish.recipe.timeMinutes}<p class="recipe-timing"><Clock size={15}/> {dish.recipe.timeMinutes} {m.cuisine_minutes()}</p>{/if}
                <h4>{m.cuisine_ingredients()}</h4>
                <ul>{#each recipeIngredients as ingredient,i (i)}<li>{ingredient}</li>{/each}</ul>
                <h4>{m.cuisine_steps()}</h4>
                <ol>{#each recipeSteps as step,i (i)}<li>{step}</li>{/each}</ol>
              {:else}
                <p class="original-note">{m.cuisine_recipe_unavailable()}</p>
              {/if}
              <div class="dish-links"><BookOpen size={15} aria-hidden="true"/>
                {#each dish.sourceUrls as source (source)}
                  <a href={source} rel="noopener noreferrer" target="_blank">{new URL(source).hostname}<ExternalLink size={12}/></a>
                {/each}
              </div>
            </div>
          {/if}
        </article>
      {/each}
    </div>
    {#if shown.length<filtered.length}
      <button type="button" class="cuisine-more" onclick={()=>limit+=24}>{m.cuisine_more()}</button>
    {/if}
    <p class="cuisine-hint">{m.cuisine_source_note()}</p>
    <a class="catalog-download" href={assetUrl('/data/cuisine/catalog.json')} download>{m.download_data()}</a>
  {/if}
</section>

<style>
  .cuisine-panel { display:grid;gap:12px;min-width:0; }
  .cuisine-title {display:grid;gap:6px}
  .cuisine-title p,.cuisine-hint {font-size:.77rem;color:var(--muted);line-height:1.5;margin:0}
  .cuisine-eyebrow {display:flex;align-items:center;gap:7px;font-weight:850;font-size:1.05rem}
  .cuisine-count {font-size:.82rem;font-weight:750}
  .cuisine-filters {display:grid;gap:8px}
  .cuisine-search {display:flex;align-items:center;gap:8px;min-height:46px;padding:0 12px;background:var(--surface);border:1px solid var(--border);border-radius:16px;color:var(--muted)}
  .cuisine-search input {background:none;border:0;outline:none;min-width:0;width:100%;color:var(--text);font:inherit}
  .filter-label {display:grid;gap:4px;color:var(--muted);font-size:.76rem;font-weight:700}
  .filter-label select {width:100%;min-height:44px;color:var(--text);border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:0 10px}
  .cuisine-results {display:grid;gap:9px;min-width:0}
  .dish-card {border:1px solid var(--border);border-radius:18px;overflow:hidden;background:var(--surface);box-shadow:0 3px 0 var(--border),inset 0 1px var(--clay-highlight)}
  .dish-trigger {width:100%;border:0;display:flex;gap:10px;align-items:center;padding:9px;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer;min-height:75px}
  .dish-trigger:focus-visible,.cuisine-more:focus-visible {outline:3px solid var(--accent);outline-offset:2px}
  .dish-photo {width:70px;height:58px;display:grid;place-items:center;flex-shrink:0;border-radius:12px;overflow:hidden;color:var(--muted);background:var(--panel)}
  .dish-photo img {width:100%;height:100%;object-fit:cover}
  .dish-summary {display:grid;gap:3px;min-width:0;flex:1}
  .dish-summary strong {font-size:.88rem;overflow-wrap:anywhere}
  .dish-summary small {font-size:.74rem;color:var(--muted)}
  .dish-chevron {font-size:1.3rem;padding:0 4px}
  .dish-body {display:grid;gap:9px;padding:12px;border-top:1px solid var(--border);font-size:.82rem;line-height:1.6}
  .dish-body h4 {font-size:.86rem;margin:3px 0 0}
  .dish-body ol,.dish-body ul {padding-left:22px;margin:0;display:grid;gap:5px}
  .dish-body li {overflow-wrap:anywhere}
  .recipe-timing,.dish-links {display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0}
  .dish-links {padding-top:8px;border-top:1px solid var(--border);font-size:.74rem}
  .dish-links a,.photo-credit a,.catalog-download {color:var(--accent)}
  .dish-links a {display:inline-flex;align-items:center;gap:3px}
  .photo-credit {font-size:.72rem;color:var(--muted);margin:0;overflow-wrap:anywhere}
  .original-note {font-size:.76rem;border-left:3px solid var(--accent);padding:7px 10px;margin:0;background:var(--panel);border-radius:0 10px 10px 0}
  .cuisine-more {padding:12px;min-height:44px;cursor:pointer;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-weight:800}
  .catalog-download {font-size:.8rem}
</style>
