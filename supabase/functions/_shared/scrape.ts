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
