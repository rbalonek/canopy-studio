// Single-page fetch + text extraction. Extracted from scrape-client's
// fetchAndParse so generation tasks can pull a landing page's real
// content into the prompt without importing the whole crawler.

// @ts-expect-error — esm.sh ships types but Deno's TS doesn't see them.
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_LEN = 20_000;

export async function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CanopyStudioBot/1.0 (+https://canopy-studio.netlify.app)' },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchPageText(
  url: string,
  maxLen = MAX_CONTENT_LEN,
): Promise<{ title: string | null; content: string; wordCount: number } | null> {
  const withScheme = url.startsWith('http') ? url : `https://${url}`;
  const resp = await fetchWithTimeout(withScheme);
  if (!resp.ok) return null;
  const html = await resp.text();
  const $ = cheerio.load(html);
  $(
    'script, style, noscript, iframe, nav, footer, header, [role="navigation"], .nav, .footer, .header, .menu',
  ).remove();
  const title = ($('title').first().text() || $('h1').first().text() || '').trim() || null;
  let text = $('main, article, [role="main"]').first().text();
  if (!text || text.length < 100) text = $('body').text();
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { title, content: text, wordCount };
}

/** Pick the best logo candidate out of a homepage's HTML. Order of
 * preference: an explicit logo <img>, then apple-touch-icon, then og:image,
 * then a rel=icon link. Relative URLs are resolved against the page. */
function extractLogo($: any, baseUrl: string): string | null {
  const abs = (href: string | undefined): string | null => {
    if (!href) return null;
    try {
      return new URL(href.trim(), baseUrl).href;
    } catch {
      return null;
    }
  };

  // 1. An <img> that looks like a brand logo (src/alt/class mentions "logo").
  let imgHit: string | null = null;
  $('img').each((_i: number, el: any) => {
    if (imgHit) return;
    const src = $(el).attr('src') || $(el).attr('data-src');
    const hay = `${src ?? ''} ${$(el).attr('alt') ?? ''} ${$(el).attr('class') ?? ''}`.toLowerCase();
    if (src && hay.includes('logo')) imgHit = abs(src);
  });
  if (imgHit) return imgHit;

  // 2–4. Head metadata, best square/branded first.
  return (
    abs($('link[rel="apple-touch-icon"]').attr('href')) ||
    abs($('link[rel="apple-touch-icon-precomposed"]').attr('href')) ||
    abs($('meta[property="og:image"]').attr('content')) ||
    abs($('meta[name="og:image"]').attr('content')) ||
    abs($('link[rel="icon"]').attr('href')) ||
    abs($('link[rel="shortcut icon"]').attr('href')) ||
    null
  );
}

/** Same-domain internal links worth reading for an "about the company" pass,
 * ranked so about/services/company pages come first. Returns absolute URLs. */
function rankedInternalLinks($: any, baseUrl: string, limit: number): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const scored: { url: string; score: number }[] = [];
  const PRIORITY = ['about', 'services', 'company', 'who-we-are', 'team', 'work', 'what-we-do'];
  $('a[href]').each((_i: number, el: any) => {
    let u: URL;
    try {
      u = new URL(($(el).attr('href') || '').trim(), baseUrl);
    } catch {
      return;
    }
    if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) return;
    const clean = `${u.origin}${u.pathname}`.replace(/\/$/, '');
    if (clean === `${base.origin}${base.pathname}`.replace(/\/$/, '') || seen.has(clean)) return;
    seen.add(clean);
    const path = u.pathname.toLowerCase();
    const score = PRIORITY.reduce((s, k, i) => (path.includes(k) ? Math.max(s, PRIORITY.length - i) : s), 0);
    scored.push({ url: clean, score });
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.url);
}

/** Read a site's own pages for the agency self-scrape: the homepage plus a
 * couple of ranked internal pages (about/services), and a best-effort logo
 * from the homepage. Best-effort throughout — a blocked page contributes
 * nothing rather than throwing. */
export async function fetchSiteBrand(
  url: string,
): Promise<{ text: string; logo: string | null; title: string | null }> {
  const withScheme = url.startsWith('http') ? url : `https://${url}`;
  const resp = await fetchWithTimeout(withScheme);
  if (!resp.ok) return { text: '', logo: null, title: null };
  const html = await resp.text();
  const $ = cheerio.load(html);

  const logo = extractLogo($, resp.url || withScheme);
  const links = rankedInternalLinks($, resp.url || withScheme, 2);

  // Strip the homepage for text (same recipe as fetchPageText).
  const $body = cheerio.load(html);
  $body('script, style, noscript, iframe, nav, footer, header, [role="navigation"], .nav, .footer, .header, .menu').remove();
  const title = ($body('title').first().text() || $body('h1').first().text() || '').trim() || null;
  let home = $body('main, article, [role="main"]').first().text();
  if (!home || home.length < 100) home = $body('body').text();
  home = home.replace(/\s+/g, ' ').trim().slice(0, 12_000);

  const sections = [`--- ${resp.url || withScheme}${title ? ` ("${title}")` : ''} ---\n${home}`];
  for (const link of links) {
    try {
      const page = await fetchPageText(link, 6000);
      if (page && page.content.length > 120) {
        sections.push(`--- ${link}${page.title ? ` ("${page.title}")` : ''} ---\n${page.content}`);
      }
    } catch {
      // best-effort: skip a page that won't load
    }
  }

  return { text: sections.join('\n\n').slice(0, 24_000), logo, title };
}

/** Best-effort landing-page grab for prompts: failures return '' with a
 * note instead of throwing, so a slow/blocked site never fails a job. */
export async function landingPageSection(url: string | null | undefined): Promise<string> {
  if (!url?.trim()) return '';
  try {
    const page = await fetchPageText(url.trim(), 8000);
    if (!page || page.content.length < 80) {
      return `(The landing page at ${url} could not be read — it may be JavaScript-rendered. Generate from the other context.)`;
    }
    return `LANDING PAGE (${url})${page.title ? ` — "${page.title}"` : ''}:\n${page.content}`;
  } catch (_e) {
    return `(The landing page at ${url} could not be fetched. Generate from the other context.)`;
  }
}
