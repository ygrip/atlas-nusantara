# Atlas testing strategy

The PR/push workflow is a **fast release gate**, aiming for about three minutes on a GitHub-hosted runner. The full browser regression suite remains available.

- `npm run check:locales`, `npm run check`, `npm run worker:check`, `npm test`, the production `npm run build` and Worker dry-run remain mandatory. The slower Wrangler/Pages/D1 integration runs in extended regression.
- `npx playwright test --grep '@smoke' --workers=2` runs critical Chromium journeys, including homepage/2D map, province navigation, destination data, locale switching, no-JS SEO (English, Indonesian, Chinese), map help, local languages, core content, metadata, error fallback, and mobile layout.
- `npx playwright test` runs the full Chromium suite locally; `WEBKIT=1 npx playwright test` also runs WebKit. The **Extended browser regression** workflow runs the complete Chromium suite weekly or on demand, with WebKit opt-in.
- Check all 13 catalogs with `npm run check:locales` and Node i18n tests rather than opening all 13 locales repeatedly in a browser. Representative locales cover client rendering.
- Add `@smoke` only to deterministic critical user journeys normally completing within seconds. Expensive visual, animation, 3D, export, offline replay and viewport matrices belong in extended regression unless release-critical.
- Never remove a failing behavior check solely to make CI green. Triage extended-regression failures; the weekly job deliberately reports them.

The three-minute target must be confirmed from GitHub Actions after this change. Only Chromium is required by the default Playwright config; downloading WebKit in the old CI was redundant.

GitHub-hosted runners use **two Playwright browser workers**, matching `playwright.config.ts`, to avoid resource contention from simultaneous heavy map/WebGL scenarios.
