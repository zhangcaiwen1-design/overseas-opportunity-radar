import { createCandidateRepository } from '../repositories/candidateRepository';
import { createContentVariantRepository } from '../repositories/contentVariantRepository';
import { createPublicationLogRepository } from '../repositories/publicationLogRepository';
import { createSelectedItemRepository } from '../repositories/selectedItemRepository';
import { createSupabaseServerClient } from '../supabase/serverClient';

export async function handleWithdrawSiteRun(runId: string, selectedItemId: string, operator: string) {
  const supabase = createSupabaseServerClient();
  const contentVariantRepository = createContentVariantRepository(supabase as never);
  const selectedItemRepository = createSelectedItemRepository(supabase as never);
  const candidateRepository = createCandidateRepository(supabase as never);
  const publicationLogRepository = createPublicationLogRepository(supabase as never);

  const [variants, selectedItems, candidates] = await Promise.all([
    contentVariantRepository.listByRun(runId),
    selectedItemRepository.listByRun(runId),
    candidateRepository.listByRun(runId),
  ]);

  const selectedItem = selectedItems.find((item) => item.id === selectedItemId);
  if (!selectedItem) {
    throw new Error(`Selected item not found: ${selectedItemId}`);
  }

  const candidate = selectedItem.candidateId ? candidates.find((item) => item.id === selectedItem.candidateId) : undefined;
  if (!candidate) {
    throw new Error(`Candidate not found for selected item: ${selectedItemId}`);
  }

  const publishedVariant = variants.find(
    (variant) => variant.channel === 'site' && variant.selectedItemId === selectedItemId && variant.status === 'published',
  );

  if (!publishedVariant) {
    throw new Error('published site variant not found');
  }

  const contentVariant = await contentVariantRepository.updateById(publishedVariant.id, {
    candidateId: candidate.id,
    title: selectedItem.title,
    body: candidate.summary,
    status: 'reviewed',
    publishedAt: publishedVariant.publishedAt,
  });

  await publicationLogRepository.create({
    contentVariantId: contentVariant.id,
    channel: 'site',
    action: 'withdraw',
    status: 'success',
    responseSummary: 'withdrawn from site',
    operator,
  });

  return {
    runId,
    selectedItemId,
    contentVariantId: contentVariant.id,
    action: 'withdraw' as const,
    channel: 'site' as const,
  };
}
