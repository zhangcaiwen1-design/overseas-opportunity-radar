import { ZodError } from 'zod';
import { isCloudSchemaMissingError } from '../cloud/cloudEnv';
import { createArtifactRepository } from '../cloud/repositories/artifactRepository';
import { createCandidateRepository } from '../cloud/repositories/candidateRepository';
import { createContentVariantRepository } from '../cloud/repositories/contentVariantRepository';
import { createSelectedItemRepository } from '../cloud/repositories/selectedItemRepository';
import { createSupabaseServerClient } from '../cloud/supabase/serverClient';

export interface SiteContentIndexItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string;
  articleUrl: string;
  markdownUrl: string;
  canonicalSourceUrl: string;
  publishedAt: string;
  bodyHtmlStoragePath: string;
}

export interface SiteContentIndex {
  generatedAt: string;
  dateKey: string;
  items: SiteContentIndexItem[];
}

function getSlug(storagePath: string | undefined, fallbackTitle: string) {
  const match = storagePath?.match(/\/([^/]+)\.(html|md|png)$/);
  if (match?.[1]) {
    return match[1];
  }

  return fallbackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'opportunity';
}

export async function loadSiteContentIndex(): Promise<SiteContentIndex> {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        generatedAt: '',
        dateKey: '',
        items: [],
      };
    }

    throw error;
  }

  const contentVariantRepository = createContentVariantRepository(supabase as never);

  let publishedVariants;
  try {
    const variants = await contentVariantRepository.listPublishedByChannel('site');
    publishedVariants = variants.filter((variant) => variant.status === 'published');
  } catch (error) {
    if (isCloudSchemaMissingError(error)) {
      return {
        generatedAt: '',
        dateKey: '',
        items: [],
      };
    }

    throw error;
  }

  if (publishedVariants.length === 0) {
    return {
      generatedAt: '',
      dateKey: '',
      items: [],
    };
  }

  const candidateRepository = createCandidateRepository(supabase as never);
  const selectedItemRepository = createSelectedItemRepository(supabase as never);
  const artifactRepository = createArtifactRepository(supabase as never);

  const runIds = Array.from(new Set(publishedVariants.map((variant) => variant.runId)));
  const runDataById = new Map<
    string,
    {
      candidateById: Map<string, Awaited<ReturnType<typeof candidateRepository.listByRun>>[number]>;
      selectedItemById: Map<string, Awaited<ReturnType<typeof selectedItemRepository.listByRun>>[number]>;
      artifactsBySelectedItemId: Map<string, { png?: string; md?: string; htmlStoragePath?: string; slug?: string }>;
    }
  >();

  for (const runId of runIds) {
    const [candidates, selectedItems, artifacts] = await Promise.all([
      candidateRepository.listByRun(runId),
      selectedItemRepository.listByRun(runId),
      artifactRepository.listByRun(runId),
    ]);

    const selectedItemById = new Map(selectedItems.map((item) => [item.id, item]));
    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const artifactsBySelectedItemId = new Map<string, { png?: string; md?: string; htmlStoragePath?: string; slug?: string }>();

    for (const artifact of artifacts) {
      if (!artifact.selectedItemId) {
        continue;
      }

      const current = artifactsBySelectedItemId.get(artifact.selectedItemId) ?? {};
      const selectedItem = selectedItemById.get(artifact.selectedItemId);
      const slug = selectedItem?.slug ?? getSlug(artifact.storagePath, selectedItem?.title ?? 'opportunity');

      if (artifact.artifactType === 'selected_png') {
        current.png = artifact.publicUrl;
        current.slug = slug;
      }

      if (artifact.artifactType === 'selected_markdown') {
        current.md = artifact.publicUrl;
        current.slug = slug;
      }

      if (artifact.artifactType === 'selected_html') {
        current.htmlStoragePath = artifact.storagePath;
        current.slug = slug;
      }

      artifactsBySelectedItemId.set(artifact.selectedItemId, current);
    }

    runDataById.set(runId, {
      candidateById,
      selectedItemById,
      artifactsBySelectedItemId,
    });
  }

  const items = publishedVariants
    .map((variant) => {
      if (!variant.selectedItemId) {
        return null;
      }

      const runData = runDataById.get(variant.runId);
      if (!runData) {
        return null;
      }

      const selectedItem = runData.selectedItemById.get(variant.selectedItemId);
      const candidate = variant.candidateId ? runData.candidateById.get(variant.candidateId) : undefined;
      const artifacts = runData.artifactsBySelectedItemId.get(variant.selectedItemId);
      const slug = selectedItem?.slug ?? artifacts?.slug ?? getSlug(undefined, variant.title);

      if (!selectedItem || !candidate || !artifacts?.png || !artifacts?.md || !artifacts.htmlStoragePath) {
        return null;
      }

      return {
        id: selectedItem.id,
        slug,
        title: variant.title,
        summary: candidate.summary,
        coverImageUrl: artifacts.png,
        articleUrl: `/site/${slug}`,
        markdownUrl: artifacts.md,
        canonicalSourceUrl: candidate.canonicalUrl,
        publishedAt: variant.publishedAt ?? '',
        bodyHtmlStoragePath: artifacts.htmlStoragePath,
      };
    })
    .filter((item): item is SiteContentIndexItem => item !== null);

  return {
    generatedAt: items[0]?.publishedAt ?? '',
    dateKey: '',
    items,
  };
}
