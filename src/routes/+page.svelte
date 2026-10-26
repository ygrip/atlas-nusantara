<script lang="ts">
 import ClayMap from '$lib/components/ClayMap.svelte';
 import { layers, type LayerId } from '$lib/data/layers';
 import { m } from '$lib/paraglide/messages.js';
 let selected = $state<LayerId>('warnings');
 const texts: Record<LayerId,()=>string> = {warnings:m.warnings,earthquakes:m.earthquakes,history:m.history,hazards:m.hazards};
</script>
<svelte:head><title>{m.app_title()}</title><meta name="description" content={m.app_subtitle()} /></svelte:head>
<main><section class="intro"><p class="eyebrow">OPEN DATA · INDONESIA</p><h1>{m.app_title()}</h1><p>{m.app_subtitle()}</p><p class="notice">{m.demo_notice()}</p></section><div class="workspace"><ClayMap/><aside><h2>{m.explore()}</h2><nav aria-label={m.sources()}>{#each layers as layer}<button class:active={selected===layer.id} onclick={()=>selected=layer.id}>{texts[layer.id]()}</button>{/each}</nav><p class="source">{m.sources()}: <a href={layers.find(l=>l.id===selected)?.url} target="_blank" rel="noreferrer">{layers.find(l=>l.id===selected)?.source}</a></p><p class="status">Dataset integration pending · no live results</p></aside></div></main>
<style>
h1{font-size:clamp(2.25rem,5vw,4rem);margin:.25rem 0}.intro{margin:0 0 1.5rem}.intro>p{max-width:62ch}.eyebrow{letter-spacing:.15em;font-size:.75rem;font-weight:800;color:#648271}.notice{font-size:.86rem;color:#735e38}.workspace{display:grid;grid-template-columns:minmax(0,2fr) minmax(245px,1fr);gap:1.5rem}aside{border-radius:1.5rem;background:#f6faf4;padding:1.5rem;box-shadow:8px 8px 20px #d1dbd0}h2{margin-top:0}nav{display:grid;gap:.75rem}button{border:1px solid #c5d5c7;border-radius:1rem;background:#e6eee4;color:#284a36;padding:1rem;text-align:start;cursor:pointer}button.active{background:#aacdb5;border-color:#79a98a;box-shadow:inset 2px 3px 7px #8ab59a}.source,.status{font-size:.85rem;line-height:1.5}.status{color:#866b42}@media(max-width:700px){.workspace{grid-template-columns:1fr}.site-shell{padding:1rem}}
</style>
