# Sharing public snapshots

`SharePanel.svelte` creates an on-demand, client-side 1080×1080 PNG. It shares only a public Nusantara URL, the supplied public summary, and an optional administrative region. It never reads user pins, device location, or browser state. The user previews the card before sharing, copying a link, or downloading the PNG.

## Integration

```svelte
<SharePanel {region} {geometry} {summary} />
```

- `region` is `{ code, name }`. Only a two-digit province code or `NN.NN` city/regency code is added to the fixed `https://nusantara.readynaz.com/` URL.
- `geometry` is the offline `GeometryPackage`. The renderer checks required provenance fields, `viewBox`, and bounded SVG path syntax as input validation; those checks do **not** prove the source, license, or boundary edition. The caller must supply only a separately verified package. Pass `undefined` while the project boundary source remains unverified; the card explicitly says the map is unavailable rather than drawing a placeholder.
- `summary` is `{ generatedAt, counts: { warning, earthquake, incident, hazard }, sourceNames }`; counts must be safe nonnegative integers, sources nonempty text, and time valid. Global summary counts are suppressed on every region-specific card, never attributed to a selected province/city. City cards filter to the exact city path and fit its bounding box; province cards may retain its child city shapes. Geographic edition/license/source attribution accompanies region-only cards. Missing geometry remains explicitly unavailable.

The card includes the snapshot caveat “Snapshot may have changed; not an emergency service.” Summary times use the browser locale. The active light/dark theme is used. The built-in font is awaited before canvas rendering; system sans-serif remains the fallback for unsupported scripts. Map paths are rendered locally through `Path2D`; no remote assets are loaded.

Native file sharing is used only when `navigator.canShare({ files })` permits it. Copy-link and PNG download remain separate fallbacks. Closing the dialog restores focus to its launch button and revokes the preview object URL. A native-share `AbortError` is treated as user cancellation.

## Verification

Run the pure URL/summary tests with:

```sh
node --experimental-strip-types --test tests/share/*.test.mjs
```

`npm test` includes these checks. Browser tests exercise preview, generated PNG dimensions/content type, downloads, public URLs and device-coordinate exclusion. Actual OS native sharing and native cancellation still need device verification. All supported locale catalogs include: `share_heading`, `share_open_preview`, `share_generating`, `share_card_title`, `share_card_subtitle`, `share_card_caveat`, `share_count_warning`, `share_count_earthquake`, `share_count_incident`, `share_count_hazard`, `share_map_unavailable`, `share_image_failed`, `share_link_copied`, `share_action_failed`, `share_complete`, `share_close`, `share_preview_alt`, `share_action`, `share_copy_link`, `share_download_png`.
