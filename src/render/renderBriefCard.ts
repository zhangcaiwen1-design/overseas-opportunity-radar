import { readFileSync } from 'node:fs';
import type { WrittenOpportunity } from '../types';

const briefCss = readFileSync(new URL('./styles/brief.css', import.meta.url), 'utf8');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderBriefCardHtml(article: WrittenOpportunity): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${briefCss}</style>
    <title>${escapeHtml(article.title)}</title>
  </head>
  <body class="brief-page">
    <article class="brief-card">
      <p class="brief-label">Business brief</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="brief-signal">${escapeHtml(article.overseasSignal)}</p>
      <div class="brief-points">
        <div>
          <h2>Localization</h2>
          <p>${escapeHtml(article.localizationPath)}</p>
        </div>
        <div>
          <h2>Validation</h2>
          <p>${escapeHtml(article.validationPath)}</p>
        </div>
      </div>
    </article>
  </body>
</html>`;
}
