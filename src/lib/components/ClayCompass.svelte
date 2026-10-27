<script lang="ts">
  // Decorative claymorphic compass; unique gradient ids keep several instances safe.
  const uid = $props.id();
</script>

<svg class="clay-compass" viewBox="0 0 120 120" width="96" height="96" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="compass-body-{uid}" cx="34%" cy="28%" r="80%">
      <stop offset="0" stop-color="#fff6ee" />
      <stop offset=".6" stop-color="#f1ddd0" />
      <stop offset="1" stop-color="#d9bfae" />
    </radialGradient>
    <radialGradient id="compass-face-{uid}" cx="40%" cy="34%" r="75%">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="1" stop-color="#f3e8df" />
    </radialGradient>
    <linearGradient id="compass-red-{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e2705c" />
      <stop offset="1" stop-color="#b8402f" />
    </linearGradient>
    <linearGradient id="compass-gold-{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f5d98b" />
      <stop offset="1" stop-color="#c9a24a" />
    </linearGradient>
  </defs>
  <ellipse cx="60" cy="108" rx="40" ry="7" fill="#000" opacity=".12" />
  <circle cx="60" cy="58" r="52" fill="url(#compass-body-{uid})" />
  <circle cx="60" cy="58" r="52" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" />
  <circle cx="60" cy="58" r="41" fill="url(#compass-face-{uid})" stroke="#d9bfae" stroke-width="2" />
  <g stroke="#b9a090" stroke-width="2" stroke-linecap="round">
    <path d="M60 22v6M60 88v6M24 58h6M90 58h6" />
  </g>
  <path d="M60 14l4 7h-8z" fill="url(#compass-gold-{uid})" />
  <g class="needle">
    <path d="M60 58L50 58L60 24Z" fill="url(#compass-red-{uid})" />
    <path d="M60 58L70 58L60 24Z" fill="#cf5a47" />
    <path d="M60 58L50 58L60 92Z" fill="#e9dcd2" />
    <path d="M60 58L70 58L60 92Z" fill="#d3c2b5" />
  </g>
  <circle cx="60" cy="58" r="6" fill="url(#compass-gold-{uid})" stroke="#fff" stroke-opacity=".8" stroke-width="1.5" />
  <ellipse cx="44" cy="32" rx="14" ry="7" fill="#fff" opacity=".45" transform="rotate(-30 44 32)" />
</svg>

<style>
  .clay-compass { display: block; filter: drop-shadow(0 4px 0 var(--border)); }
  .needle { transform-origin: 60px 58px; animation: compass-sway 6s ease-in-out infinite; }
  @keyframes compass-sway {
    0%, 100% { transform: rotate(-14deg); }
    50% { transform: rotate(18deg); }
  }
  @media (prefers-reduced-motion: reduce) { .needle { animation: none; transform: rotate(8deg); } }
</style>
