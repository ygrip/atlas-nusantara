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
  <h2>{m.privacy_location_title()}</h2>
  <p>{m.privacy_location_text()}</p>
</LegalLayout>
