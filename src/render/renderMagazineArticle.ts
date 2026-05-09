import { readStyleText } from './readStyleText';
import type {
  OpportunityContentAngle,
  SelectedHeroImageAsset,
  SelectedWrittenOpportunity,
  WrittenOpportunityImage,
} from '../types';

const magazineCss = readStyleText(new URL('./styles/magazine.css', import.meta.url));

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function listItems(values: string[]): string {
  return values.map((value) => `<li>${escapeHtml(value)}</li>`).join('');
}

function paragraphItems(values: string[]): string {
  return values.map((value) => `<p>${escapeHtml(value)}</p>`).join('');
}

function renderContentAngles(values: OpportunityContentAngle[]): string {
  return `<ul>${values
    .map((value) => `<li>${escapeHtml(value.channel === 'wechat-article' ? '公众号' : '抖音')}：${escapeHtml(value.angle)}</li>`)
    .join('')}</ul>`;
}

function renderArticleCollage(images: WrittenOpportunityImage[] | undefined): string {
  if (!images || images.length === 0) {
    return '';
  }

  const imageTags = images
    .map(
      (image) =>
        `<img class="article-collage__image" src="${escapeHtml(image.path)}" alt="${escapeHtml(image.alt)}" />`,
    )
    .join('');

  return `<section class="article-collage">${imageTags}</section>`;
}

function renderMaterialFigure(image: WrittenOpportunityImage | undefined): string {
  if (!image) {
    return '';
  }

  return `<figure class="material-figure"><img class="material-figure__image" src="${escapeHtml(image.path)}" alt="${escapeHtml(image.alt)}" /><figcaption class="material-figure__caption">Source material</figcaption></figure>`;
}

function renderHeroImage(heroImage: SelectedHeroImageAsset | undefined): string {
  if (!heroImage?.imagePath || heroImage.status !== 'generated') {
    return '';
  }

  return `<div class="article-hero-image"><img src="${escapeHtml(heroImage.imagePath)}" alt="${escapeHtml('精选稿主视觉图')}" /></div>`;
}

function renderEvidenceGuide(images: WrittenOpportunityImage[] | undefined): string {
  if (!images || images.length === 0) {
    return '';
  }

  return `<section class="evidence-guide"><div class="evidence-guide__intro"><p class="evidence-guide__label">证据导览</p><p>本篇拆解基于真实海外项目页面与公开信号。</p></div>${renderArticleCollage(images)}</section>`;
}

export function renderMagazineArticleHtml(article: SelectedWrittenOpportunity): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${magazineCss}</style>
    <title>${escapeHtml(article.title)}</title>
  </head>
  <body class="magazine-page">
    <article class="magazine-article">
      <header class="hero article-cover">
        <p class="kicker">${escapeHtml(article.sourceLabel)}</p>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="hero__dek">${escapeHtml(article.oneLiner)}</p>
        ${renderHeroImage(article.heroImage)}
      </header>

      ${renderEvidenceGuide(article.collageImages)}

      <section class="section">
        <h2>项目介绍</h2>
        <p>${escapeHtml(article.projectIntro)}</p>
      </section>

      <section class="section">
        <h2>运作模式</h2>
        ${paragraphItems(article.operationModel)}
      </section>

      ${renderMaterialFigure(article.materialImage)}

      <section class="section">
        <h2>为什么值得看</h2>
        <ul>${listItems(article.whyItMatters)}</ul>
      </section>

      <section class="section">
        <h2>国产化路径</h2>
        <ul>${listItems(article.chinaAdaptation)}</ul>
      </section>

      <section class="section">
        <h2>变现实操</h2>
        <ul>${listItems(article.monetizationExecution)}</ul>
      </section>

      <section class="section">
        <h2>内容传播角度</h2>
        ${renderContentAngles(article.contentAngles)}
      </section>

      ${article.validationSteps && article.validationSteps.length > 0
        ? `<section class="section"><h2>验证步骤</h2><ul>${listItems(
            article.validationSteps.map((step) => `${step.title}：${step.detail}`),
          )}</ul></section>`
        : ''}
    </article>
  </body>
</html>`;
}
