import { createArtifactRepository } from '../repositories/artifactRepository';
import { createCandidateRepository } from '../repositories/candidateRepository';
import { createContentVariantRepository } from '../repositories/contentVariantRepository';
import { createPublicationLogRepository } from '../repositories/publicationLogRepository';
import { createSelectedItemRepository } from '../repositories/selectedItemRepository';
import { createSupabaseServerClient } from '../supabase/serverClient';

export async function handlePublishSiteRun(runId: string, selectedItemId: string, operator: string) {
  const supabase = createSupabaseServerClient();
  const contentVariantRepository = createContentVariantRepository(supabase as never);
  const selectedItemRepository = createSelectedItemRepository(supabase as never);
  const candidateRepository = createCandidateRepository(supabase as never);
  const artifactRepository = createArtifactRepository(supabase as never);
  const publicationLogRepository = createPublicationLogRepository(supabase as never);

  const [variants, selectedItems, candidates, artifacts] = await Promise.all([
    contentVariantRepository.listByRun(runId),
    selectedItemRepository.listByRun(runId),
    candidateRepository.listByRun(runId),
    artifactRepository.listByRun(runId),
  ]);

  const selectedItem = selectedItems.find((item) => item.id === selectedItemId);
  if (!selectedItem) {
    throw new Error(`Selected item not found: ${selectedItemId}`);
  }

  const candidate = selectedItem.candidateId ? candidates.find((item) => item.id === selectedItem.candidateId) : undefined;
  if (!candidate) {
    throw new Error(`Candidate not found for selected item: ${selectedItemId}`);
  }

  const siteArtifacts = artifacts.filter((artifact) => artifact.selectedItemId === selectedItemId);
  const hasHtml = siteArtifacts.some((artifact) => artifact.artifactType === 'selected_html' && artifact.storagePath);
  const hasMarkdown = siteArtifacts.some((artifact) => artifact.artifactType === 'selected_markdown' && artifact.publicUrl);
  const hasPng = siteArtifacts.some((artifact) => artifact.artifactType === 'selected_png' && artifact.publicUrl);

  if (!hasHtml || !hasMarkdown || !hasPng) {
    throw new Error('site artifacts unavailable');
  }

  const publishedAt = new Date().toISOString();
  const existingVariant = variants.find((variant) => variant.channel === 'site' && variant.selectedItemId === selectedItemId);

  const contentVariant = existingVariant
    ? await contentVariantRepository.updateById(existingVariant.id, {
        candidateId: candidate.id,
        title: selectedItem.title,
        body: candidate.summary,
        status: 'published',
        publishedAt,
      })
    : await contentVariantRepository.create({
        runId,
        candidateId: candidate.id,
        selectedItemId,
        channel: 'site',
        title: selectedItem.title,
        body: candidate.summary,
        status: 'published',
        publishedAt,
      });

  await publicationLogRepository.create({
    contentVariantId: contentVariant.id,
    channel: 'site',
    action: 'publish',
    status: 'success',
    responseSummary: 'published to site',
    operator,
  });

  return {
    runId,
    selectedItemId,
    contentVariantId: contentVariant.id,
    action: 'publish' as const,
    channel: 'site' as const,
    publishedAt: contentVariant.publishedAt ?? publishedAt,
  };
}
