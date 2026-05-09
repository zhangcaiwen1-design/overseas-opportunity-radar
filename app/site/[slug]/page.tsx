import React from 'react';
import { notFound } from 'next/navigation';
import { LeadCaptureButton } from '../LeadCaptureButton';
import { loadSiteArticleBySlug } from '../../../src/site/loadSiteArticleBySlug';

export const dynamic = 'force-dynamic';

export default async function SiteArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await loadSiteArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <article className="site-article">
      <header className="site-article__header">
        <h1>{article.title}</h1>
        <p>{article.publishedAt}</p>
        <img className="site-article__image" src={article.coverImageUrl} alt={article.title} />
        <div className="site-article__actions">
          <a href={article.canonicalSourceUrl} target="_blank" rel="noreferrer">
            原始来源
          </a>
          <a href={article.markdownUrl} target="_blank" rel="noreferrer">
            下载 Markdown
          </a>
          <LeadCaptureButton pageType="site_article" eventType="subscribe" label="订阅" />
          <LeadCaptureButton pageType="site_article" eventType="consult" label="咨询" />
        </div>
      </header>
      <div dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />
    </article>
  );
}
