<script lang="ts">
  import EditorialLayout from '$lib/components/EditorialLayout.svelte';
  import EditorialDocument from '$lib/components/EditorialDocument.svelte';
  import { m } from '$lib/i18n/messages';
  import { pathFor } from '$lib/i18n/links';
</script>

<EditorialLayout title={m.editorial_about_title()} description={m.editorial_about_description()} eyebrow={m.editorial_about_label()}>
  <EditorialDocument text={m.editorial_about_body()} />
  <h2>{m.editorial_more_guides()}</h2>
  <p><a href={pathFor('/guides')}>{m.editorial_nav_guides()}</a></p>
</EditorialLayout>
