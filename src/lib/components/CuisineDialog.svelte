<script lang="ts">
  import { ChevronLeft, ChevronRight, Clock3, ExternalLink, Share2, Users } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { Region } from '$lib/atlas/regions';
  import type { CuisineDish, CuisineRecipe, CuisineTranslation, CuisineTranslations } from '$lib/data/cuisine';
  import { cuisineImageCredit, cuisineImagePage } from '$lib/data/cuisine-images';
  import { cuisineGroupColor, cuisineGroupLabel } from '$lib/data/cuisine-labels';
  import MapDialog from './MapDialog.svelte';
  import CuisinePhoto from './CuisinePhoto.svelte';

  let { dish, provinces, translations = null, onclose, onshare }: {
    dish?: CuisineDish; provinces: Region[]; translations?: CuisineTranslations | null;
    onclose: () => void; onshare: (dish: CuisineDish) => void;
  } = $props();

  let active = $state(0);
  let recipeIndex = $state(0);
  $effect(() => { void dish; active = 0; recipeIndex = 0; });
  const locale = getLocale();
  const images = $derived(dish?.images ?? []);
  const current = $derived(images[active]);
  const recipes = $derived(dish?.recipes ?? []);
  const recipe = $derived<CuisineRecipe | undefined>(recipes[recipeIndex]);
  const provinceNames = $derived.by(() => {
    if (!dish) return [];
    const names = new Map(provinces.map(item => [item.code, item.name]));
    return dish.provinceCodes.map(code => names.get(code) ?? code);
  });

  /** Only the first recipe is translated, and only when the line counts still match the Indonesian original. */
  const translation = $derived.by((): CuisineTranslation | undefined => {
    if (!dish || recipeIndex !== 0 || !recipe) return undefined;
    const candidate = translations?.items[dish.id];
    if (!candidate) return undefined;
    if (candidate.ingredients?.length !== recipe.ingredients.length || candidate.steps?.length !== recipe.steps.length) return undefined;
    return candidate;
  });
  const ingredientLines = $derived(translation?.ingredients ?? recipe?.ingredients ?? []);
  const stepLines = $derived(translation?.steps ?? recipe?.steps ?? []);

  function step(direction: number) {
    if (images.length < 2) return;
    active = (active + direction + images.length) % images.length;
  }
</script>

<MapDialog open={Boolean(dish)} title={dish?.name ?? ''} {onclose} wide>
  {#if dish}
    <article class="dish-detail">
      <div class="gallery">
        <div class="stage">
          <CuisinePhoto image={current} size="large" alt={dish.name} />
          {#if images.length > 1}
            <button type="button" class="nav prev" onclick={() => step(-1)} aria-label={m.destination_previous()}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" class="nav next" onclick={() => step(1)} aria-label={m.destination_next()}><ChevronRight size={20} aria-hidden="true" /></button>
            <span class="counter" aria-live="polite">{m.species_photo_of({ current: active + 1, total: images.length })}</span>
          {/if}
        </div>
        {#if images.length > 1}
          <div class="thumbs">
            {#each images as image, index (image.ref)}
              <button type="button" class:selected={index === active} onclick={() => { active = index; }} aria-label={m.species_photo_of({ current: index + 1, total: images.length })} aria-current={index === active}>
                <CuisinePhoto {image} size="small" alt="" />
              </button>
            {/each}
          </div>
        {/if}
        {#if current}<p class="credit"><a href={cuisineImagePage(current)} target="_blank" rel="noopener noreferrer">{cuisineImageCredit(current)} ↗</a></p>{/if}
      </div>

      <div class="info">
        <div class="identity">
          <span class="group-badge" style:background={cuisineGroupColor(dish.group)}>{cuisineGroupLabel(dish.group)}</span>
          {#if recipes.length}<span class="recipe-badge">{m.cuisine_recipe_count({ count: recipes.length })}</span>{/if}
        </div>

        <section>
          <h3>{m.cuisine_summary()}</h3>
          {#if dish.summary}
            <p>{dish.summary}{#if dish.articleUrl} <a href={dish.articleUrl} target="_blank" rel="noopener noreferrer">Wikipedia <ExternalLink size={12} aria-hidden="true" /></a>{/if}</p>
          {:else}<p class="muted">{m.cuisine_no_summary()}</p>{/if}
        </section>

        {#if provinceNames.length}
          <section>
            <h3>{m.cuisine_in_provinces({ count: provinceNames.length })}</h3>
            <ul class="chips">{#each provinceNames as name (name)}<li>{name}</li>{/each}</ul>
          </section>
        {/if}

        {#if recipe}
          <section class="recipe">
            <h3>{m.cuisine_recipes_heading()}</h3>
            {#if recipes.length > 1}
              <div class="recipe-tabs" role="group" aria-label={m.cuisine_recipes_heading()}>
                {#each recipes as item, index (item.id)}
                  <button type="button" class:selected={index === recipeIndex} aria-pressed={index === recipeIndex} onclick={() => { recipeIndex = index; }}>{m.cuisine_recipe_n({ number: index + 1 })}</button>
                {/each}
              </div>
            {/if}
            <p class="recipe-title">{translation?.name || recipe.title}</p>
            <p class="recipe-meta">
              {#if recipe.timeMinutes}<span><Clock3 size={13} aria-hidden="true" /> {recipe.timeMinutes} {m.cuisine_minutes()}</span>{/if}
              {#if recipe.yield}<span><Users size={13} aria-hidden="true" /> {recipe.yield}</span>{/if}
            </p>
            {#if locale !== 'id' && !translation}<p class="note">{m.cuisine_id_fallback()}</p>{/if}
            {#if translation?.status === 'machine-unreviewed'}<p class="note">{m.cuisine_machine_notice()}</p>{/if}
            <h4>{m.cuisine_ingredients()}</h4>
            <ul class="lines">{#each ingredientLines as line, index (index)}<li>{line}</li>{/each}</ul>
            <h4>{m.cuisine_steps()}</h4>
            <ol class="lines">{#each stepLines as line, index (index)}<li>{line}</li>{/each}</ol>
            <p class="attribution">
              {#if recipe.author}{m.cuisine_by_author({ author: recipe.author })} · {/if}<a href={recipe.url} target="_blank" rel="noopener noreferrer">{m.cuisine_view_source()} ↗</a>
            </p>
          </section>
        {:else}
          <section><h3>{m.cuisine_recipes_heading()}</h3><p class="muted">{m.cuisine_no_recipe_yet()}</p></section>
        {/if}

        <p class="sources">{m.species_sources()}: {dish.sources.map(source => new URL(source.url).hostname.replace(/^www\./, '')).filter((host, index, all) => all.indexOf(host) === index).join(' · ')}</p>
        <button type="button" class="share" onclick={() => onshare(dish)}><Share2 size={16} aria-hidden="true" /> {m.share_action()}</button>
      </div>
    </article>
  {/if}
</MapDialog>

<style>
  .dish-detail { display: grid; gap: 12px; min-width: 0; }
  .gallery { display: grid; gap: 8px; }
  .stage { position: relative; aspect-ratio: 4 / 3; max-height: 46dvh; width: 100%; overflow: hidden; border-radius: 20px; border: 1px solid var(--border); background: var(--border); box-shadow: inset 0 2px 1px var(--clay-highlight); }
  .nav { position: absolute; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 15px; color: var(--text); background: color-mix(in srgb, var(--surface) 90%, transparent); cursor: pointer; }
  .prev { left: 10px; } .next { right: 10px; }
  .counter { position: absolute; right: 10px; bottom: 10px; padding: 3px 9px; border-radius: 10px; font-size: .7rem; font-weight: 750; color: var(--text); background: color-mix(in srgb, var(--surface) 90%, transparent); }
  .thumbs { display: flex; gap: 8px; overflow-x: auto; padding: 2px; }
  .thumbs button { flex: none; width: 72px; height: 54px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 12px; cursor: pointer; background: var(--border); }
  .thumbs button.selected { border-color: var(--accent); }
  .info { display: grid; gap: 12px; min-width: 0; align-content: start; }
  .credit, .sources, .muted, .note, .attribution { margin: 0; color: var(--muted); font-size: .72rem; line-height: 1.5; }
  .credit a, section a, .attribution a { color: var(--accent); }
  .identity { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .group-badge { display: inline-block; padding: 5px 12px; border-radius: 12px; color: #1a1a1a; font-size: .8rem; font-weight: 850; }
  .recipe-badge { padding: 4px 10px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 16%, transparent); font-size: .74rem; font-weight: 750; }
  h3 { margin: 0 0 4px; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  h4 { margin: 12px 0 4px; font-size: .84rem; }
  section p { margin: 0; font-size: .92rem; line-height: 1.6; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .chips li { padding: 3px 10px; border: 1px solid var(--border); border-radius: 999px; font-size: .76rem; background: var(--surface); }
  .recipe-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; }
  .recipe-tabs button { min-height: 40px; padding: 5px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font: inherit; font-weight: 750; cursor: pointer; }
  .recipe-tabs button.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
  .recipe-title { font-weight: 800; }
  .recipe-meta { display: flex; flex-wrap: wrap; gap: 12px; color: var(--muted); font-size: .8rem !important; }
  .recipe-meta span { display: inline-flex; align-items: center; gap: 5px; }
  .lines { margin: 0; padding-left: 1.25rem; font-size: .88rem; line-height: 1.6; }
  .lines li + li { margin-top: 3px; }
  .share { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 8px 18px; border: 1px solid var(--border); border-radius: 15px; color: var(--text); font: inherit; font-weight: 800; cursor: pointer; background: linear-gradient(165deg, var(--surface), var(--panel)); box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .share:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border); }
  @media (min-width: 720px) { .dish-detail { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: start; column-gap: 20px; } }
</style>
