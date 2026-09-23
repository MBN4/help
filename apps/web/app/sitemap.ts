import type { MetadataRoute } from 'next';
import type { CategoryNode } from '@buisnez/shared';
import { MAX_PER_PAGE } from '@buisnez/shared';
import { getCategoryTree, getCities, searchBusinesses } from '@/lib/api';
import { SITE_URL } from '@/lib/seo/metadata';

function flattenCategorySlugs(nodes: CategoryNode[]): string[] {
  return nodes.flatMap((node) => [
    node.slug,
    ...flattenCategorySlugs(node.children),
  ]);
}

/**
 * Search results are capped at MAX_PER_PAGE (50) per request server-side (docs/09-search-discovery.md),
 * so every published business is paginated through here. A single sitemap file supports up to 50,000 URLs;
 * split into `generateSitemaps()`-backed multiple files if the catalog ever approaches that.
 */
async function allBusinessSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  for (;;) {
    const { data, meta } = await searchBusinesses({
      page,
      perPage: MAX_PER_PAGE,
      sort: 'newest',
    });
    slugs.push(...data.map((business) => business.slug));
    if (data.length === 0 || !meta || page * MAX_PER_PAGE >= meta.total) {
      break;
    }
    page += 1;
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: 'daily', priority: 0.5 },
  ];

  const [{ data: cities }, { data: categories }, businessSlugs] =
    await Promise.all([getCities(), getCategoryTree(), allBusinessSlugs()]);
  const categorySlugs = flattenCategorySlugs(categories);

  for (const city of cities) {
    entries.push({
      url: `${SITE_URL}/${city.slug}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
    for (const categorySlug of categorySlugs) {
      entries.push({
        url: `${SITE_URL}/${city.slug}/${categorySlug}`,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  }

  for (const slug of businessSlugs) {
    entries.push({
      url: `${SITE_URL}/business/${slug}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return entries;
}
