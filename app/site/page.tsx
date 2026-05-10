import React from 'react';
import Link from 'next/link';
import { LeadCaptureButton } from './LeadCaptureButton';
import { loadSiteContentIndex } from '../../src/site/loadSiteContentIndex';

const valuePoints = [
  {
    title: '只看能落地的机会',
    description: '聚焦跨境商业、工具链、服务出海与可复制需求，不给你堆泛新闻。',
  },
  {
    title: '每天筛一遍噪音',
    description: '采集、筛选、重写、归档一条链路压缩成每日简报，减少盲搜时间。',
  },
  {
    title: '从信号到动作',
    description: '不只是告诉你发生了什么，更强调谁在买、哪里能切入、下一步该怎么试。',
  },
];

const workflowSteps = ['抓取海外机会源', '筛选高意图信号', '生成中文内参', '沉淀成对外内容与商机线索'];

export const dynamic = 'force-dynamic';

export default async function SitePage() {
  const index = await loadSiteContentIndex();
  const featuredCount = index.items.length;
  const latestPublishedAt = index.items[0]?.publishedAt?.slice(0, 10) ?? '今日更新';

  return (
    <section className="site-shell">
      <header className="site-hero">
        <div className="site-hero__eyebrow">
          <span className="page-kicker">Commercial Intelligence Brief</span>
          <span className="site-hero__timestamp">{latestPublishedAt}</span>
        </div>
        <div className="site-hero__layout">
          <div className="site-hero__copy">
            <span className="site-hero__label">Signal-to-Action Intelligence</span>
            <h1>海外商业机会内参</h1>
            <p>
              给正在找增量业务的人，一份更短、更准、更能行动的外网机会简报。我们把公开信号压缩成可读、可跟进、可咨询的每日精选。
            </p>
            <div className="site-hero__stats" aria-label="站点概览">
              <div>
                <strong>{featuredCount}</strong>
                <span>本期精选</span>
              </div>
              <div>
                <strong>24h</strong>
                <span>扫描周期</span>
              </div>
              <div>
                <strong>中文</strong>
                <span>决策摘要</span>
              </div>
            </div>
          </div>
          <aside className="site-hero__brief">
            <span>适合谁</span>
            <ul>
              <li>做出海业务拓展的创始人</li>
              <li>找新产品线的中小团队</li>
              <li>想持续跟踪海外需求变化的顾问与投资人</li>
            </ul>
          </aside>
        </div>
        <div className="site-hero__actions">
          <LeadCaptureButton pageType="site_index" eventType="subscribe" label="订阅" />
          <LeadCaptureButton pageType="site_index" eventType="consult" label="咨询" />
        </div>
      </header>

      <section className="site-panel site-panel--signal" aria-label="价值说明">
        <div className="site-panel__heading">
          <div>
            <span className="page-kicker">Why It Matters</span>
            <span>你看到的不是资讯流，是行动信号。</span>
          </div>
          <p>我们用更像投研快报的方式组织页面，让客户一眼知道这里卖的是什么价值。</p>
        </div>
        <div className="site-value-grid">
          {valuePoints.map((point) => (
            <article key={point.title} className="site-value-card">
              <h2>{point.title}</h2>
              <p>{point.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-panel site-panel--content" aria-label="精选机会">
        <div className="site-section-head">
          <div>
            <span className="page-kicker">Featured Briefs</span>
            <h2>本期精选机会</h2>
          </div>
          <p>每条机会都给出中文摘要与延伸阅读入口，方便先判断，再决定是否深挖。</p>
        </div>

        {featuredCount > 0 ? (
          <div className="site-grid">
            {index.items.map((item) => (
              <article key={item.id} className="site-card">
                <img className="site-card__image" src={item.coverImageUrl} alt={item.title} />
                <div className="site-card__meta">
                  <span>{item.publishedAt ? item.publishedAt.slice(0, 10) : '最新发布'}</span>
                  <span>精选条目</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <div className="site-card__actions">
                  <Link href={item.articleUrl}>查看内参</Link>
                  <a href={item.markdownUrl} target="_blank" rel="noreferrer">
                    导出 Markdown
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="site-empty-state">
            <strong>新一期内参正在生成</strong>
            <p>当前没有已发布内容。你可以先留下联系方式，我们会在下一次更新后通知你。</p>
          </div>
        )}
      </section>

      <section className="site-panel site-process" aria-label="工作流说明">
        <div className="site-section-head">
          <div>
            <span className="page-kicker">Workflow</span>
            <h2>这份内参怎么产出</h2>
          </div>
        </div>
        <ol className="site-process__list">
          {workflowSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="site-panel site-cta-band" aria-label="转化入口">
        <div>
          <span className="page-kicker">Contact</span>
          <h2>想要更贴近你业务的机会雷达</h2>
          <p>可以直接订阅公开版，也可以联系我们做更聚焦的行业、地区或客户群筛选。</p>
        </div>
        <div className="site-cta-band__actions">
          <LeadCaptureButton pageType="site_index" eventType="subscribe" label="订阅" />
          <LeadCaptureButton pageType="site_index" eventType="consult" label="咨询" />
        </div>
      </section>

      <footer className="site-admin-entry" aria-label="管理员入口">
        <span>运营入口</span>
        <a href="https://admin-radar.yifan1.com">进入后台采集台</a>
      </footer>
    </section>
  );
}
