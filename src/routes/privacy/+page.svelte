<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import LegalLayout from '$lib/components/LegalLayout.svelte';
</script>

<LegalLayout title={m.privacy_title()} description={m.privacy_description()}>
  <h2>{m.privacy_storage_title()}</h2>
  <p>{m.privacy_storage_text()}</p>
  <h2>{m.privacy_notifications_title()}</h2>
  <p>{m.privacy_notifications_text()}</p>
  <h2>{m.privacy_tracking_title()}</h2>
  <p>{m.privacy_tracking_text()}</p>
  <p>Advertising is configured in live mode and loads automatically on the homepage. Empty, blocked or failed placements collapse without restricting the atlas. This site does not provide a certified consent-management platform; applicable Google and regional consent requirements still apply. See <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">Google’s advertising privacy information</a>.</p>
  <h2>Download verification and security</h2>
  <p>Opening archive download verification loads Cloudflare Turnstile. Cloudflare processes network and browser signals to distinguish legitimate requests from automated abuse. The server validates single-use proofs and the site hostname before reading archive records. Normal map browsing does not require a challenge. See <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare’s Privacy Policy</a>.</p>
  <p>Security counters use a hashed network address rather than storing the raw address in our D1 rate-limit table. Counters expire after their fixed window and are removed by scheduled cleanup; deletion can be delayed if the scheduler is unavailable. These counters are security controls, not anonymous analytics.</p>
  <h2>{m.privacy_location_title()}</h2>
  <p>{m.privacy_location_text()}</p>
</LegalLayout>
