import React from 'react';
import Link from 'next/link';
import { LeadCaptureButton } from './LeadCaptureButton';
import { loadSiteContentIndex } from '../../src/site/loadSiteContentIndex';

export const dynamic = 'force-dynamic';

export default async function SitePage() {
  const index = await loadSiteContentIndex();

  return (
    <section className="site-shell">
      <header className="site-hero">
        <span className="page-kicker">Public Site</span>
        <h1>今日精选机会</h1>
        <p>围绕最近一次已生成 run 的精选成稿，对外提供最小可访问站点入口。</p>
        <div className="site-hero__actions">
          <LeadCaptureButton pageType="site_index" eventType="subscribe" label="订阅" />
          <LeadCaptureButton pageType="site_index" eventType="consult" label="咨询" />
        </div>
      </header>
      <div className="site-grid">
        {index.items.map((item) => (
          <article key={item.id} className="site-card">
            <img className="site-card__image" src={item.coverImageUrl} alt={item.title} />
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
            <div className="site-card__actions">
              <Link href={item.articleUrl}>查看文章</Link>
              <a href={item.markdownUrl} target="_blank" rel="noreferrer">
                Markdown
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
