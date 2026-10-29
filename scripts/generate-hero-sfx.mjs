// Original stylized sound design; no third-party recordings or runtime synthesis.
// Requires ffmpeg. Only writes the wave/chirp MP3 assets; recorded sounds have separate credits.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const rate = 44100;
let seed = 28431;
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}
function envelope(time, duration) {
  return Math.min(1, time / .08, (duration - time) / .4);
}
function waves(time, duration, white, low) {
  const swell = .3 + .7 * Math.sin(Math.PI * time / 2.1) ** 2;
  return (low * 2 + white * .1) * swell * envelope(time, duration);
}
function birds(time, duration) {
  const chirpTime = time % .48;
  if (chirpTime > .21) return 0;
  const chirpEnvelope = Math.sin(Math.PI * chirpTime / .21) ** 2;
  const phase = 2 * Math.PI * (1900 * chirpTime + 3200 * chirpTime ** 2);
  return (Math.sin(phase) + .25 * Math.sin(phase * 2)) * .3 * chirpEnvelope * envelope(time, duration);
}

const directory = mkdtempSync(join(tmpdir(), 'nusantara-sfx-'));
try {
  for (const [id, duration, sample] of [
    ['pinisi', 4.2, waves], ['cendrawasih', 3, birds]
  ]) {
    const count = Math.floor(rate * duration);
    const wav = Buffer.alloc(44 + count * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
    wav.writeUInt32LE(count * 2, 40);
    let low = 0;
    for (let i = 0; i < count; i++) {
      const white = noise();
      low = .985 * low + .015 * white;
      const value = Math.max(-1, Math.min(1, sample(i / rate, duration, white, low)));
      wav.writeInt16LE(Math.round(value * 29000), 44 + i * 2);
    }
    const input = join(directory, `${id}.wav`);
    writeFileSync(input, wav);
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-b:a', '96k', `static/audio/hero/${id}.mp3`], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`ffmpeg failed for ${id}: ${result.status}`);
    console.log(`Generated ${id}: ${duration}s`);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
