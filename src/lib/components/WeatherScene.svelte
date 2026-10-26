<script lang="ts">
  import type { WeatherSceneKind } from '$lib/places/weather-scene';

  let { scene, night = false, paused = false }: { scene: WeatherSceneKind; night?: boolean; paused?: boolean } = $props();
  const rainDrops = [0, 1, 2, 3, 4, 5, 6, 7];
  const showSun = $derived(!night && (scene === 'clear' || scene === 'partly'));
  const showMoon = $derived(night && (scene === 'clear' || scene === 'partly'));
  const showCloud = $derived(scene !== 'clear');
  const showRain = $derived(scene === 'rain' || scene === 'storm');
</script>

<div class="scene scene-{scene}" class:night class:paused aria-hidden="true">
  {#if showSun}
    <div class="sun"><span class="rays"></span><span class="orb"></span></div>
  {/if}
  {#if showMoon}
    <div class="moon"><span class="crescent"></span><i class="star one"></i><i class="star two"></i><i class="star three"></i></div>
  {/if}
  {#if showCloud}
    <div class="cloud back"><span class="puff a"></span><span class="puff b"></span><span class="base"></span></div>
    <div class="cloud front"><span class="puff a"></span><span class="puff b"></span><span class="base"></span></div>
  {/if}
  {#if showRain}
    <div class="rain">{#each rainDrops as drop (drop)}<i style={`--i: ${drop}`}></i>{/each}</div>
  {/if}
  {#if scene === 'storm'}<div class="bolt"></div>{/if}
  {#if scene === 'mist'}<div class="mist"><i></i><i></i><i></i></div>{/if}
</div>

<style>
  .scene { --cloud-light: #ffffff; --cloud-dark: #dfe9f2; --cloud-shade: #b9c9d9; position: relative; width: 148px; height: 112px; flex: none; }
  .scene.night, .scene-storm { --cloud-light: #c9d0e2; --cloud-dark: #9aa4bf; --cloud-shade: #6e7899; }
  .scene-storm.night { --cloud-light: #8f98b3; --cloud-dark: #666f8d; --cloud-shade: #474f6b; }
  .scene-rain:not(.night) { --cloud-light: #f1f5fa; --cloud-dark: #cdd9e6; --cloud-shade: #a2b3c6; }

  .sun { position: absolute; top: 4px; right: 10px; width: 66px; height: 66px; animation: sun-bob 6s ease-in-out infinite; }
  .scene-partly .sun { top: 0; right: 4px; width: 56px; height: 56px; }
  .orb { position: absolute; inset: 11px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #fff4b8, #ffc94d 55%, #f59f2f); box-shadow: inset -4px -6px 10px #d9791c66, inset 3px 3px 6px #ffffffb3, 0 6px 14px #f59f2f66; }
  .rays { position: absolute; inset: 0; border-radius: 50%; background: repeating-conic-gradient(from 0deg, #ffd96b 0 10deg, transparent 10deg 45deg); mask: radial-gradient(circle, transparent 52%, #000 54%, #000 70%, transparent 72%); animation: spin 26s linear infinite; opacity: .85; }

  .moon { position: absolute; top: 6px; right: 14px; width: 60px; height: 60px; animation: sun-bob 7s ease-in-out infinite; }
  .crescent { position: absolute; inset: 8px; border-radius: 50%; background: transparent; box-shadow: inset -12px -6px 0 0 #f6efc9, 0 0 18px #f6efc955; transform: rotate(-18deg); }
  .star { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #fff7d6; box-shadow: 0 0 6px #fff7d6; animation: twinkle 3s ease-in-out infinite; }
  .star.one { top: 2px; left: -16px; } .star.two { top: 36px; left: -26px; animation-delay: -1s; width: 4px; height: 4px; } .star.three { top: -2px; left: 42px; animation-delay: -2s; width: 4px; height: 4px; }

  .cloud { position: absolute; width: 96px; height: 52px; filter: drop-shadow(0 7px 5px #3b506b2e); }
  .cloud.back { left: 4px; top: 16px; transform: scale(.78); opacity: .9; animation: drift-back 9s ease-in-out infinite alternate; }
  .cloud.front { left: 30px; top: 44px; animation: drift-front 7s ease-in-out infinite alternate; }
  .scene-partly .cloud.back { display: none; }
  .scene-partly .cloud.front { left: 8px; top: 40px; }
  .scene-storm .cloud.front, .scene-rain .cloud.front { top: 34px; }
  .puff, .base { position: absolute; background: radial-gradient(circle at 32% 26%, var(--cloud-light), var(--cloud-dark) 62%, var(--cloud-shade)); box-shadow: inset -3px -5px 8px #5b739028, inset 3px 3px 6px #ffffffb0; }
  .puff.a { left: 12px; bottom: 14px; width: 44px; height: 44px; border-radius: 50%; }
  .puff.b { left: 40px; bottom: 14px; width: 50px; height: 50px; border-radius: 50%; }
  .base { left: 0; bottom: 0; width: 96px; height: 30px; border-radius: 999px; }

  .rain { position: absolute; left: 36px; top: 78px; width: 84px; height: 40px; overflow: hidden; }
  .rain i { position: absolute; top: -12px; left: calc(var(--i) * 11px); width: 5px; height: 14px; border-radius: 999px; background: linear-gradient(#bfe3ff, #5aa9e6); box-shadow: inset 1px 1px 1px #ffffffaa; transform: rotate(14deg); animation: fall 1.1s linear infinite; animation-delay: calc(var(--i) * -0.19s); }
  .rain i:nth-child(odd) { animation-duration: 0.9s; height: 11px; }
  .scene-storm .rain i { animation-duration: .7s; background: linear-gradient(#d4e6ff, #6f8fe8); }

  .bolt { position: absolute; left: 62px; top: 66px; width: 26px; height: 40px; background: linear-gradient(160deg, #fff7b0, #ffcf2e 60%, #f59f2f); clip-path: polygon(55% 0, 12% 56%, 44% 56%, 28% 100%, 92% 38%, 56% 38%, 80% 0); filter: drop-shadow(0 0 8px #ffd84a); animation: flash 3.2s ease-in-out infinite; }

  .mist { position: absolute; left: 6px; top: 70px; width: 130px; height: 40px; }
  .mist i { position: absolute; left: 0; height: 9px; border-radius: 999px; background: linear-gradient(90deg, #ffffff00, #ffffffcc, #ffffff00); box-shadow: inset 0 -2px 3px #8aa0b522; animation: slide 6s ease-in-out infinite alternate; }
  .mist i:nth-child(1) { top: 0; width: 120px; } .mist i:nth-child(2) { top: 14px; width: 100px; animation-delay: -2s; left: 18px; } .mist i:nth-child(3) { top: 28px; width: 112px; animation-delay: -4s; }
  .scene-mist .cloud.front { top: 22px; }

  .paused *, .paused { animation-play-state: paused !important; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes sun-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
  @keyframes drift-front { from { transform: translateX(-6px); } to { transform: translateX(10px); } }
  @keyframes drift-back { from { transform: translateX(8px) scale(.78); } to { transform: translateX(-8px) scale(.78); } }
  @keyframes fall { from { transform: translateY(-14px) rotate(14deg); opacity: 0; } 15% { opacity: 1; } to { transform: translateY(52px) rotate(14deg); opacity: .2; } }
  @keyframes flash { 0%, 55%, 100% { opacity: 0; } 58% { opacity: 1; } 62% { opacity: .2; } 66% { opacity: 1; } 76% { opacity: 0; } }
  @keyframes twinkle { 0%, 100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
  @keyframes slide { from { transform: translateX(-10px); opacity: .6; } to { transform: translateX(12px); opacity: 1; } }

  @media (prefers-reduced-motion: reduce) { .scene *, .scene { animation: none !important; } .bolt { opacity: 1; } }
  @media (max-width: 380px) { .scene { transform: scale(.85); transform-origin: right center; } }
</style>
