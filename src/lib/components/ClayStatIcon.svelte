<script lang="ts">
  export type StatIconKind = 'provinces' | 'regencies' | 'cities' | 'islands' | 'population' | 'languages' | 'ethnicGroups' | 'seaArea' | 'landArea';

  let { kind, size = 52 }: { kind: StatIconKind; size?: number } = $props();

  // Each tile is a clay squircle in one hue, with a pale glyph pressed into it.
  const TONES: Record<StatIconKind, { light: string; base: string; dark: string }> = {
    provinces: { light: '#f4b6bd', base: '#e0838f', dark: '#b8525f' },
    regencies: { light: '#a9d6b5', base: '#6fb086', dark: '#43805b' },
    cities: { light: '#f4d98d', base: '#dcae52', dark: '#a77b25' },
    islands: { light: '#9fe0cf', base: '#55b9a2', dark: '#2f8a76' },
    population: { light: '#f6bf9e', base: '#e38a62', dark: '#b2582f' },
    languages: { light: '#cfc0ec', base: '#a58bc9', dark: '#7459a0' },
    ethnicGroups: { light: '#f3b7cf', base: '#d97fa4', dark: '#a94e75' },
    seaArea: { light: '#a8d4ee', base: '#5fa5cf', dark: '#33739f' },
    landArea: { light: '#cfe3a0', base: '#97b862', dark: '#648a31' }
  };

  const uid = $props.id();
  const tone = $derived(TONES[kind]);
</script>

<svg class="clay-stat-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="stat-body-{uid}" cx="32%" cy="24%" r="85%">
      <stop offset="0" stop-color={tone.light} />
      <stop offset=".55" stop-color={tone.base} />
      <stop offset="1" stop-color={tone.dark} />
    </radialGradient>
  </defs>
  <ellipse cx="32" cy="58" rx="20" ry="3.6" fill="#2b1d1a" opacity=".16" />
  <rect x="5" y="9" width="54" height="50" rx="19" fill={tone.dark} />
  <rect x="5" y="6" width="54" height="50" rx="19" fill="url(#stat-body-{uid})" />
  <g fill="#fffaf2" stroke="#fffaf2" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" style="filter: drop-shadow(0 1.6px 0 {tone.dark})">
    {#if kind === 'provinces'}
      <path d="M32 15c-7.2 0-12.6 5.2-12.6 11.8 0 8.6 12.6 21.2 12.6 21.2s12.6-12.6 12.6-21.2C44.6 20.2 39.2 15 32 15z" />
      <circle cx="32" cy="27" r="4.6" fill={tone.base} stroke="none" />
    {:else if kind === 'regencies'}
      <path d="M13 37l9.5-8.5L32 37v10.5H13z" />
      <path d="M31 33l10-9.5L51 33v14.5H31z" />
      <rect x="38" y="38" width="6" height="9.5" rx="2" fill={tone.base} stroke="none" />
    {:else if kind === 'cities'}
      <rect x="14" y="31" width="11" height="17" rx="2.6" />
      <rect x="26.5" y="18" width="11" height="30" rx="2.6" />
      <rect x="39" y="26" width="11" height="22" rx="2.6" />
      <path d="M30 24h4M30 30h4M30 36h4" stroke={tone.base} stroke-width="2.2" fill="none" />
    {:else if kind === 'islands'}
      <ellipse cx="32" cy="45" rx="18" ry="6" />
      <path d="M33 44c-1.4-8-.6-14 2.2-19.5" fill="none" stroke-width="3.4" />
      <path d="M35 24c-3-4.4-8.6-5.4-13-3 4.4.2 8 1.4 13 3zM35 24c3.6-3.6 9.2-3.8 13-.6-4.6-.6-8.8-.2-13 .6zM35.2 24.6c-1.4-5-5.2-8.4-10.4-8.6 4.4 2 7.4 4.6 10.4 8.6z" stroke-width="1.8" />
    {:else if kind === 'population'}
      <circle cx="17" cy="26" r="4.4" opacity=".8" />
      <path d="M8 45v-3.5c0-4.6 3.6-7.5 9-7.5s9 2.9 9 7.5V45z" opacity=".8" />
      <circle cx="47" cy="26" r="4.4" opacity=".8" />
      <path d="M38 45v-3.5c0-4.6 3.6-7.5 9-7.5s9 2.9 9 7.5V45z" opacity=".8" />
      <circle cx="32" cy="22" r="7" stroke={tone.base} stroke-width="5" paint-order="stroke" />
      <path d="M19.5 49v-5c0-7.2 5.2-11.5 12.5-11.5S44.5 36.8 44.5 44v5z" stroke={tone.base} stroke-width="5" paint-order="stroke" />
    {:else if kind === 'languages'}
      <rect x="13" y="17" width="38" height="25" rx="11" />
      <path d="M23 41l-2 10 11-9.5z" />
      <circle cx="24" cy="29.5" r="2.6" fill={tone.base} stroke="none" />
      <circle cx="32" cy="29.5" r="2.6" fill={tone.base} stroke="none" />
      <circle cx="40" cy="29.5" r="2.6" fill={tone.base} stroke="none" />
    {:else if kind === 'ethnicGroups'}
      <circle cx="23" cy="33" r="10" />
      <circle cx="41" cy="33" r="10" opacity=".78" />
      <circle cx="32" cy="22" r="9" opacity=".92" />
    {:else if kind === 'seaArea'}
      <path d="M12 27q5.2-5.4 10.4 0t10.4 0 10.4 0 8.4-3" fill="none" stroke-width="4.4" />
      <path d="M12 38q5.2-5.4 10.4 0t10.4 0 10.4 0 8.4-3" fill="none" stroke-width="4.4" />
      <path d="M12 49q5.2-5.4 10.4 0t10.4 0 10.4 0 8.4-3" fill="none" stroke-width="4.4" opacity=".7" />
    {:else}
      <path d="M11 47l15.5-25 8.5 12.5 5.5-8L53 47z" />
      <path d="M22.4 28.4l4.1-6.4 3.2 4.8-3.4 1.6-2.2-1.6z" fill={tone.light} stroke="none" />
    {/if}
  </g>
  <ellipse cx="20" cy="15.5" rx="9.5" ry="4.4" fill="#fff" opacity=".5" transform="rotate(-24 20 15.5)" />
</svg>

<style>
  .clay-stat-icon { display: block; flex-shrink: 0; filter: drop-shadow(0 3px 0 color-mix(in srgb, var(--border) 85%, transparent)); }
</style>
