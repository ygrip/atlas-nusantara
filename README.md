# Nusantara

An Indonesian environmental and disaster atlas, designed as a lightweight claymorphic map with transparent public-data provenance.

## Current status
Initial SvelteKit + Paraglide JS scaffold only. The visual map is deliberately a placeholder; no real administrative geometry or live disaster feed is connected yet. Do not use it for emergency decisions.

## Development
```sh
pnpm install
pnpm dev
pnpm check:i18n
pnpm check
pnpm build
```

## Languages
English (base), Indonesian, Malay (Brunei/Malaysia/Singapore), Filipino, Thai, Vietnamese, Burmese, Khmer, Lao, Simplified Chinese (Singapore), Tamil (Singapore), Tetum and Portuguese (Timor-Leste). 13 BCP-47 locale identifiers. Locales represent principal official/national languages, **not every regional/minority language**. Current starter copy is translated, but translations need native-speaker verification before any emergency-facing launch.

All strings live in `messages/{locale}.json`, configured in `project.inlang/settings.json` and compiled by Paraglide JS; locale URL routes use the server middleware. No parallel handwritten locales runtime.

## Data implementation
See [architecture and phased plan](docs/ARCHITECTURE.md). Boundary sources, reuse licenses, administrative crosswalks, API limits, and disaster information provenance must be validated before publishing populated maps.
