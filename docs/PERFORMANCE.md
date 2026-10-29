# Startup rendering budget

## What changed

- Serve display-sized 1x/2x hero cutouts and motion strips. Audio remains activation-only; motion assets still wait for page load.
- Gate every initial forecast caller on page load and idle, sharing one download. Explicit weather exports await that shared request instead of dropping forecast columns.
- Load province details, saved-place cards and history charts only when needed. Cache their code and the city directory during background service-worker installation so offline navigation remains available.
- Treat fetched forecast/history documents as immutable `$state.raw` values. Keep map warming local to the map, read its initial size before canvas insertion, and consume subsequent `ResizeObserver` measurements directly. Playback no longer starts a second render clock over an already scheduled weather frame.
- Skip offscreen section layout/paint with guarded `content-visibility: auto`. Intrinsic block sizes are estimates from the default desktop/mobile layouts, not fixed rendered heights; `auto` remembers the measured size after first presentation. Unsupported browsers render normally, and print explicitly renders every section. WebKit retains normal-flow layout because repeated cold-anchor checks exposed jumps while skipped ancestors gained their actual height; the optimization is conservatively disabled there.

SSR tabs remain disabled until their client handlers are mounted, so the faster first paint cannot lose an early activation.

The speculative font preload was removed. Asset savings alone did not improve the measured text LCP; avoiding offscreen layout was the important rendering change.

## Controlled local comparison

Baseline: commit `1780632`. Five interleaved cold-browser baseline/candidate pairs used the same HTTP server and port, a 1440×900 viewport at 1x density, 4× CPU throttling, 150 ms emulated latency and 10 Mbit/s download throughput. Service workers and advertisements were disabled for measurement. Observation continued for seven seconds after the load event, including deferred forecast work.

| Metric | Baseline median (range) | Candidate median (range) |
| --- | --- | --- |
| FCP / text LCP | 704 ms (700–880) | 664 ms (652–668) |
| Observed blocking time | 92 ms (90–153) | 72 ms (65–86) |
| Startup JS / CSS, decoded | 465,412 / 136,764 bytes | 443,137 / 110,767 bytes |

Blocking time here is the sum of `max(0, longTask.duration - 50 ms)` over the observation window, **not Lighthouse TBT**. These local results do not guarantee a production Lighthouse score or field Core Web Vitals.

The seven selected static-plus-motion image payloads decreased from 676,408 bytes to 233,454 bytes at 1x (−65%) or 507,456 bytes at high density (−25%). JSON parsing itself measured about 7–8 ms under CPU throttling, so a parsing worker was not added without evidence that its startup and cloning overhead would help.

The traces still contain a small framework-owned synchronous layout when SvelteKit reads scroll position after hydration. Framework internals were not patched to remove that approximately 2 ms read.

## Regression coverage

`tests/browser/render-containment.spec.ts` verifies cold anchor navigation, native dialogs, saved-place section reveal and map activation at mobile and desktop sizes in Chromium/WebKit. Startup tests cover density selection, deferred forecast timing, contrast, early exports and first-use/offline lazy panels. Hero screenshots retained identical dimensions with less than 1% of pixels differing by more than 20/255 after resampling, in both themes at 390px and 1440px.
