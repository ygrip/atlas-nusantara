import './ornaments.css';
export { heroSprites, preloadHeroSprites } from './sprites';

export interface HeroInteraction {
  toggle(id: string): void;
  destroy(): void;
}

const durations: Record<string, number> = {
  tiger: 3200, orangutan: 3600, flag: 14000, volcano: 3600,
  komodo: 3600, pinisi: 4200, cendrawasih: 3000
};

/** One sound at a time, initiated synchronously by a real click or keypress. */
export function createHeroInteraction(onChange: (id: string) => void, onAudioError: () => void): HeroInteraction {
  let active = '';
  let audio: HTMLAudioElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    clearTimeout(timer);
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio = undefined;
    }
    active = '';
    onChange('');
  }

  function toggle(id: string) {
    const wasActive = active === id;
    stop();
    if (wasActive || !Object.hasOwn(durations, id)) return;
    active = id;
    onChange(id);
    const currentAudio = new Audio();
    audio = currentAudio;
    currentAudio.preload = 'none';
    currentAudio.volume = 0.55;
    currentAudio.src = `/audio/hero/${id}.mp3`;
    currentAudio.onerror = () => {
      if (audio === currentAudio) onAudioError();
    };
    void currentAudio.play().catch((error: unknown) => {
      // Rapid switching intentionally aborts the previous play promise.
      if (audio !== currentAudio) return;
      console.warn('Ornament audio could not play.', error);
      onAudioError();
    });
    timer = setTimeout(stop, durations[id]);
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') stop();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('keydown', onKeydown);
  return {
    toggle,
    destroy() {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeydown);
    }
  };
}
