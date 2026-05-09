import { downloadArtifactText } from '../cloud/storage/uploadArtifact';
import { loadSiteContentIndex } from './loadSiteContentIndex';

export interface SiteArticle {
  slug: string;
  title: string;
  bodyHtml: string;
  coverImageUrl: string;
  markdownUrl: string;
  canonicalSourceUrl: string;
  publishedAt: string;
}

function sanitizeArticleHtml(bodyHtml: string) {
  return bodyHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'">]*\2/gi, '');
}

export async function loadSiteArticleBySlug(slug: string): Promise<SiteArticle | null> {
  const index = await loadSiteContentIndex();
  const item = index.items.find((entry) => entry.slug === slug);

  if (!item) {
    return null;
  }

  const bodyHtml = sanitizeArticleHtml(await downloadArtifactText(item.bodyHtmlStoragePath));

  return {
    slug,
    title: item.title,
    bodyHtml,
    coverImageUrl: item.coverImageUrl,
    markdownUrl: item.markdownUrl,
    canonicalSourceUrl: item.canonicalSourceUrl,
    publishedAt: item.publishedAt,
  };
}
