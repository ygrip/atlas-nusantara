# BMKG weather warning CAP adapter

`adaptBmkgCap` accepts one official public BMKG CAP 1.2 XML warning and converts its time, attribution and polygon data to the canonical warning snapshot. It is a parser only: it does not fetch, schedule, publish, notify or claim provider terms have been reviewed.

## Verified source contract

BMKG's open-data documentation at <https://data.bmkg.go.id/peringatan-dini-cuaca/> lists an RSS index at `https://www.bmkg.go.id/alerts/nowcast/id` and CAP details at `https://www.bmkg.go.id/alerts/nowcast/id/{kode_detail_cap}_alert.xml`. The page identifies CAP format, notes the feed may update at any time, and requires BMKG attribution to be displayed. The BMKG earthquake portal separately documents a 60 requests/minute/IP limit; do not assume that warning access has the same documented limit. Recheck provider terms before deployment.

The inspected CAP document uses namespace `urn:oasis:names:tc:emergency:cap:1.2`, official `@bmkg.go.id` sender, `status=Actual`, `msgType=Alert`, `scope=Public`, and an `info` section containing ISO 8601 `sent`, `effective`, and `expires` instants, headline, description, event, and one or more area polygons. CAP polygon pairs are latitude,longitude. This adapter converts them to GeoJSON longitude,latitude and retains all rings as MultiPolygon coordinates.

The inspected warning contains area descriptions and polygon coordinates, but no administrative codes. The adapter deliberately leaves `regionCodes` empty. **Do not join area names to province/city codes.** Future push matching requires a separately reviewed authoritative crosswalk or warning-specific geocodes.

## Safety behavior

- Requires the exact CAP namespace, URL pattern and BMKG sender domain; rejects DTD/entity declarations, malformed/oversized XML and unsafe source URLs.
- Accepts original public actual alerts only; rejects test, exercise, cancel, update and other message types so they cannot masquerade as active alerts.
- Requires a currently active validity window and valid closed polygon rings. Unsupported circle-only areas fail closed.
- Preserves CAP timestamps, severity, urgency, certainty, descriptions and source link. Expired warnings are rejected; `validUntil` is set from CAP `expires`.
- Produces no guessed region mapping, provider fetch, default active alert or automatic snapshot.

Source `copyright public domain` was visible on the BMKG RSS index, not a complete legal/reuse determination for every CAP detail. `DatasetProvenance.license` must reflect independently reviewed rights before any publication. Keep BMKG attribution visible.

## Use

Import `adaptBmkgCap` from `src/lib/data/ingestion/cap.ts` and supply reviewed provenance, snapshot generation time, and the raw detail XML. Run the isolated tests with `node --experimental-strip-types --test tests/ingestion/cap.test.ts` on Node 22.12+.
