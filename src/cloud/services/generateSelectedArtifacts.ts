import { renderHtmlScreenshot } from '../../render/renderHtmlScreenshot';
import { renderMagazineArticleHtml } from '../../render/renderMagazineArticle';
import type { OpportunitySignal } from '../../types';
import { analyzeOpportunity } from '../../writer/analyzeOpportunity';
import { renderArticleMarkdown } from '../../writer/renderMarkdown';

export async function generateSelectedArtifacts(input: {
  runId: string;
  dateKey: string;
  selectedCandidates: OpportunitySignal[];
  upload: (input: {
    storagePath: string;
    body: Buffer | string;
    contentType: string;
  }) => Promise<{ storagePath: string; publicUrl: string }>;
  saveArtifact: (artifact: {
    runId: string;
    selectedItemId: string;
    artifactType: string;
    storagePath: string;
    publicUrl: string;
    mimeType: string;
  }) => Promise<void>;
  renderScreenshot?: typeof renderHtmlScreenshot;
}) {
  const renderScreenshot = input.renderScreenshot ?? renderHtmlScreenshot;
  const articles: Array<{
    article: ReturnType<typeof analyzeOpportunity>;
    artifact: {
      slug: string;
      title: string;
      markdownPath: string;
      htmlPath: string;
      screenshotPath: string;
    };
    selectedItemId: string;
    title: string;
  }> = [];

  for (const candidate of input.selectedCandidates) {
    const article = analyzeOpportunity(candidate);
    const markdown = renderArticleMarkdown(article);
    const html = renderMagazineArticleHtml(article);
    const htmlStoragePath = `runs/${input.dateKey}/selected/${article.slug}.html`;
    const markdownStoragePath = `runs/${input.dateKey}/selected/${article.slug}.md`;
    const pngStoragePath = `runs/${input.dateKey}/selected/${article.slug}.png`;

    const htmlUpload = await input.upload({
      storagePath: htmlStoragePath,
      body: html,
      contentType: 'text/html; charset=utf-8',
    });
    await input.saveArtifact({
      runId: input.runId,
      selectedItemId: candidate.id,
      artifactType: 'selected_html',
      storagePath: htmlUpload.storagePath,
      publicUrl: htmlUpload.publicUrl,
      mimeType: 'text/html',
    });

    const markdownUpload = await input.upload({
      storagePath: markdownStoragePath,
      body: markdown,
      contentType: 'text/markdown; charset=utf-8',
    });
    await input.saveArtifact({
      runId: input.runId,
      selectedItemId: candidate.id,
      artifactType: 'selected_markdown',
      storagePath: markdownUpload.storagePath,
      publicUrl: markdownUpload.publicUrl,
      mimeType: 'text/markdown',
    });

    const screenshotBuffer = await renderScreenshot(html, 1080, 1440);
    const pngUpload = await input.upload({
      storagePath: pngStoragePath,
      body: screenshotBuffer,
      contentType: 'image/png',
    });
    await input.saveArtifact({
      runId: input.runId,
      selectedItemId: candidate.id,
      artifactType: 'selected_png',
      storagePath: pngUpload.storagePath,
      publicUrl: pngUpload.publicUrl,
      mimeType: 'image/png',
    });

    articles.push({
      article,
      artifact: {
        slug: article.slug,
        title: article.title,
        markdownPath: markdownUpload.publicUrl,
        htmlPath: htmlUpload.publicUrl,
        screenshotPath: pngUpload.publicUrl,
      },
      selectedItemId: candidate.id,
      title: article.title,
    });
  }

  return {
    selectedCount: input.selectedCandidates.length,
    articles,
  };
}
