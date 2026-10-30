<script lang="ts">
  import EditorialLayout from '$lib/components/EditorialLayout.svelte';
  import EditorialDocument from '$lib/components/EditorialDocument.svelte';
  import { m } from '$lib/i18n/messages';
  import { pathFor } from '$lib/i18n/links';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const translate = (key: string) => (m as unknown as Record<string, () => string>)[key]();
</script>

<EditorialLayout
  title={translate('editorial_' + data.slug + '_title')}
  description={translate('editorial_' + data.slug + '_description')}
  eyebrow={m.editorial_guide_label()}
  route={('guides/' + data.slug) as 'guides/regions' | 'guides/conditions' | 'guides/nature'}
>
  <EditorialDocument text={translate('editorial_' + data.slug + '_body')} />
  <p class="editorial-return"><a href={pathFor('/')}>{m.editorial_open_atlas()}</a> · <a href={pathFor('/guides')}>{m.editorial_all_guides()}</a> · <a href={pathFor('/about')}>{m.editorial_nav_about()}</a></p>
</EditorialLayout>
