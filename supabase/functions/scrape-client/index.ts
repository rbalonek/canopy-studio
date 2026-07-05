// scrape-client
//
// Discovers + scrapes a client's website. Workflow:
//   1. Authenticate the caller, assert workspace membership of the
//      target client (RLS gate via user JWT).
//   2. Fetch robots.txt → sitemap URLs → all sitemap entries. Fall back
//      to the homepage and crawl its same-domain links if no sitemap.
//   3. Rank URLs (homepage / about / services / pricing first), cap at
//      max_pages (default 8).
//   4. Fetch each page with a timeout, parse with cheerio, extract
//      title + main-content text. Strip nav, footer, scripts.
//   5. Upsert into scraped_pages + roll up domain stats into
//      scraped_domains. Service role bypasses RLS for the writes.
//
// Ported from Swimm-Copywriting-API/server/routes/assets.js. The
// original was Node + cheerio; here we use cheerio via esm.sh which
// works in the Deno runtime.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-expect-error — esm.sh ships types but Deno's TS doesn't see them.
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_LEN = 20_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Req {
  client_id: string;
  url: string;
  /** Cap on pages scraped. Default 8. */
  max_pages?: number;
  /** When set, this is a competitor scrape: pages/domain rows are tagged
   * with the competitor and replaced wholesale on each run. */
  competitor_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as Req;
    if (!body?.client_id || !body?.url) {
      return json({ ok: false, error: 'client_id and url are required' }, 400);
    }
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return json({ ok: false, error: 'Missing Authorization header' }, 401);
    }

    // 1. Validate caller + membership via RLS (selecting the client by id
    // succeeds only if the user is a workspace member).
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: clientRow, error: clientErr } = await userClient
      .from('clients')
      .select('id, workspace_id')
      .eq('id', body.client_id)
      .maybeSingle();
    if (clientErr || !clientRow) {
      return json({ ok: false, error: 'Client not found or access denied' }, 403);
    }

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Competitor scrapes must reference a competitor of this client.
    if (body.competitor_id) {
      const { data: comp } = await service
        .from('competitors')
        .select('id')
        .eq('id', body.competitor_id)
        .eq('client_id', body.client_id)
        .maybeSingle();
      if (!comp) {
        return json({ ok: false, error: 'Competitor not found for this client' }, 404);
      }
    }

    const maxPages = Math.max(1, Math.min(body.max_pages ?? 8, 20));
    const result = await scrape(
      body.client_id,
      body.url,
      maxPages,
      service,
      body.competitor_id ?? null,
    );
    return json(result, 200);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

async function scrape(
  clientId: string,
  startUrl: string,
  maxPages: number,
  service: ReturnType<typeof createClient>,
  competitorId: string | null = null,
): Promise<{
  ok: boolean;
  pages_scraped: number;
  pages_discovered: number;
  errors?: string[];
  at: string;
}> {
  const errors: string[] = [];
  const startedAt = new Date().toISOString();

  let base: URL;
  try {
    base = new URL(startUrl.startsWith('http') ? startUrl : `https://${startUrl}`);
  } catch {
    return {
      ok: false,
      pages_scraped: 0,
      pages_discovered: 0,
      errors: ['Invalid URL'],
      at: startedAt,
    };
  }
  const domain = base.hostname;

  // --- 1. Discover URLs ---
  const discovered = new Set<string>();
  discovered.add(base.toString());

  let sitemapStatus: 'Discovered' | 'Partial' | 'Failed' = 'Failed';
  try {
    const sitemapUrls = await discoverFromSitemap(base);
    sitemapUrls.forEach((u) => discovered.add(u));
    sitemapStatus = sitemapUrls.length > 0 ? 'Discovered' : 'Failed';
  } catch (e) {
    errors.push(`sitemap: ${(e as Error).message}`);
  }

  // Fall back to crawling homepage links if sitemap was sparse
  if (discovered.size < 3) {
    try {
      const homeLinks = await crawlSameDomain(base);
      homeLinks.forEach((u) => discovered.add(u));
      if (sitemapStatus === 'Failed' && homeLinks.length > 0) sitemapStatus = 'Partial';
    } catch (e) {
      errors.push(`homepage crawl: ${(e as Error).message}`);
    }
  }

  // Rank + cap
  const ranked = rankUrls(Array.from(discovered), base);
  const toScrape = ranked.slice(0, maxPages);

  // --- 2. Scrape each ---
  // Competitor runs replace their previous pages wholesale (the
  // client_id+url unique key can't distinguish competitors).
  if (competitorId) {
    await service.from('scraped_pages').delete().eq('competitor_id', competitorId);
  }

  let scrapedCount = 0;
  for (const u of toScrape) {
    try {
      const page = await fetchAndParse(u);
      if (!page) continue;
      const row = {
        client_id: clientId,
        competitor_id: competitorId,
        url: u,
        title: page.title,
        content: page.content,
        word_count: page.wordCount,
        status: 'analyzed',
        scraped_at: new Date().toISOString(),
      };
      const { error: writeErr } = competitorId
        ? await service.from('scraped_pages').insert(row)
        : await service.from('scraped_pages').upsert(row, { onConflict: 'client_id,url' });
      if (writeErr) {
        errors.push(`write ${u}: ${writeErr.message}`);
        continue;
      }
      scrapedCount++;
    } catch (e) {
      errors.push(`${u}: ${(e as Error).message}`);
    }
  }

  // --- 3. Design signals (palette / fonts / logo) from the homepage ---
  // Heuristic by nature — staged on the domain row for the
  // website_analysis job to fold into brand_profiles as "detected".
  let design: DesignSignals = { palette: [], fonts: [], logoUrl: null };
  try {
    design = await extractDesignSignals(base);
  } catch (e) {
    errors.push(`design signals: ${(e as Error).message}`);
  }

  // --- 4. Roll up domain stats ---
  const domainRow = {
    client_id: clientId,
    competitor_id: competitorId,
    domain,
    health: scrapedCount > 0 ? 'Healthy' : 'Error',
    sitemap_status: sitemapStatus,
    pages_discovered: discovered.size,
    pages_indexed: scrapedCount,
    raw_palette: design.palette.length ? design.palette : null,
    raw_fonts: design.fonts.length ? design.fonts : null,
    logo_url: design.logoUrl,
    last_crawled_at: new Date().toISOString(),
  };
  if (competitorId) {
    await service.from('scraped_domains').delete().eq('competitor_id', competitorId);
    await service.from('scraped_domains').insert(domainRow);
    await service
      .from('competitors')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', competitorId);
  } else {
    await service.from('scraped_domains').upsert(domainRow, { onConflict: 'client_id,domain' });
  }

  return {
    ok: scrapedCount > 0,
    pages_scraped: scrapedCount,
    pages_discovered: discovered.size,
    errors: errors.length ? errors : undefined,
    at: startedAt,
  };
}

async function discoverFromSitemap(base: URL): Promise<string[]> {
  const urls = new Set<string>();
  const sitemapCandidates = [`${base.origin}/sitemap.xml`, `${base.origin}/sitemap_index.xml`];

  try {
    const robotsResp = await fetchWithTimeout(`${base.origin}/robots.txt`);
    if (robotsResp.ok) {
      const txt = await robotsResp.text();
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*sitemap:\s*(\S+)/i);
        if (m) sitemapCandidates.push(m[1]);
      }
    }
  } catch {
    // ignore
  }

  for (const sm of sitemapCandidates) {
    try {
      const resp = await fetchWithTimeout(sm);
      if (!resp.ok) continue;
      const xml = await resp.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const childSitemaps: string[] = [];
      $('sitemap > loc').each((_: number, el: any) => {
        childSitemaps.push($(el).text().trim());
      });
      if (childSitemaps.length > 0) {
        for (const child of childSitemaps.slice(0, 5)) {
          try {
            const cResp = await fetchWithTimeout(child);
            if (cResp.ok) {
              const cXml = await cResp.text();
              const $c = cheerio.load(cXml, { xmlMode: true });
              $c('url > loc').each((_: number, el: any) => {
                const u = $c(el).text().trim();
                if (u && sameDomain(u, base)) urls.add(u);
              });
            }
          } catch {
            // skip
          }
        }
      } else {
        $('url > loc').each((_: number, el: any) => {
          const u = $(el).text().trim();
          if (u && sameDomain(u, base)) urls.add(u);
        });
      }
      if (urls.size > 0) break; // first sitemap with content wins
    } catch {
      // try next candidate
    }
  }

  return Array.from(urls);
}

async function crawlSameDomain(base: URL): Promise<string[]> {
  const found = new Set<string>();
  try {
    const resp = await fetchWithTimeout(base.toString());
    if (!resp.ok) return [];
    const html = await resp.text();
    const $ = cheerio.load(html);
    $('a[href]').each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const abs = new URL(href, base).toString();
        if (sameDomain(abs, base)) found.add(abs.split('#')[0]);
      } catch {
        // skip invalid hrefs
      }
    });
  } catch {
    // ignore
  }
  return Array.from(found);
}

async function fetchAndParse(
  url: string,
): Promise<{ title: string | null; content: string; wordCount: number } | null> {
  const resp = await fetchWithTimeout(url);
  if (!resp.ok) return null;
  const html = await resp.text();
  const $ = cheerio.load(html);
  // Strip non-content elements
  $(
    'script, style, noscript, iframe, nav, footer, header, [role="navigation"], .nav, .footer, .header, .menu',
  ).remove();
  const title = ($('title').first().text() || $('h1').first().text() || '').trim() || null;
  let text = $('main, article, [role="main"]').first().text();
  if (!text || text.length < 100) text = $('body').text();
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > MAX_CONTENT_LEN) text = text.slice(0, MAX_CONTENT_LEN);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { title, content: text, wordCount };
}

function rankUrls(urls: string[], _base: URL): string[] {
  const score = (u: string): number => {
    const path = (() => {
      try {
        return new URL(u).pathname.toLowerCase();
      } catch {
        return '';
      }
    })();
    if (path === '/' || path === '') return 100;
    if (/^\/(about|about-us|company)/.test(path)) return 80;
    if (/^\/(services|service|what-we-do|products)/.test(path)) return 75;
    if (/^\/(pricing|plans|book|contact)/.test(path)) return 70;
    if (/^\/(locations|location|find-us)/.test(path)) return 65;
    if (/^\/(blog|news|posts)/.test(path)) return 20;
    return 50;
  };
  return urls
    .map((u) => ({ u, s: score(u) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.u);
}

function sameDomain(u: string, base: URL): boolean {
  try {
    return new URL(u).hostname === base.hostname;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Design-signal extraction (palette, fonts, logo)
// ---------------------------------------------------------------------------

interface DesignSignals {
  palette: string[];
  fonts: Array<{ family: string; source: 'google-fonts' | 'css' }>;
  logoUrl: string | null;
}

// Generic CSS font keywords that aren't brand fonts.
const GENERIC_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'inherit', 'initial', 'unset', '-apple-system', 'blinkmacsystemfont',
  'segoe ui', 'arial', 'helvetica', 'helvetica neue', 'times new roman',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'var(--font-family)',
]);

/** Re-fetch the homepage unstripped (fetchAndParse removes header/nav —
 * exactly where logos live) and mine it + up to 3 same-origin
 * stylesheets for colors, font families, and a logo URL. */
async function extractDesignSignals(base: URL): Promise<DesignSignals> {
  const resp = await fetchWithTimeout(base.toString());
  if (!resp.ok) return { palette: [], fonts: [], logoUrl: null };
  const html = await resp.text();
  const $ = cheerio.load(html);

  // -- CSS sources: inline <style> blocks + first 3 same-origin sheets --
  let css = '';
  $('style').each((_: number, el: any) => {
    css += $(el).text() + '\n';
  });
  const sheetUrls: string[] = [];
  $('link[rel="stylesheet"][href]').each((_: number, el: any) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, base);
      if (abs.hostname === base.hostname) sheetUrls.push(abs.toString());
    } catch {
      // skip
    }
  });
  for (const sheet of sheetUrls.slice(0, 3)) {
    try {
      const cssResp = await fetchWithTimeout(sheet, 6000);
      if (cssResp.ok) css += (await cssResp.text()) + '\n';
    } catch {
      // skip slow/broken sheets
    }
  }

  // -- Palette: hex color frequency, ignoring pure black/white/greys --
  const counts = new Map<string, number>();
  const themeColor = $('meta[name="theme-color"]').attr('content')?.trim();
  const addColor = (raw: string, weight = 1) => {
    let hex = raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(hex)) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    if (!/^#[0-9a-f]{6}$/.test(hex)) return;
    const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((h) =>
      parseInt(h, 16),
    );
    const isGrey = Math.max(r, g, b) - Math.min(r, g, b) < 16;
    if (isGrey) return;
    counts.set(hex, (counts.get(hex) ?? 0) + weight);
  };
  if (themeColor?.startsWith('#')) addColor(themeColor, 20);
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) addColor(`#${m[1]}`);
  const palette = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);

  // -- Fonts: Google Fonts links (high confidence) + font-family decls --
  const fonts: DesignSignals['fonts'] = [];
  const seenFamilies = new Set<string>();
  $('link[href*="fonts.googleapis.com"]').each((_: number, el: any) => {
    const href = $(el).attr('href') ?? '';
    for (const m of href.matchAll(/family=([^&:;]+)/g)) {
      const family = decodeURIComponent(m[1]).replace(/\+/g, ' ').split(':')[0].trim();
      const key = family.toLowerCase();
      if (family && !seenFamilies.has(key)) {
        seenFamilies.add(key);
        fonts.push({ family, source: 'google-fonts' });
      }
    }
  });
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(',')[0].replace(/["']/g, '').trim();
    const key = first.toLowerCase();
    if (first && !GENERIC_FONTS.has(key) && !seenFamilies.has(key) && fonts.length < 6) {
      seenFamilies.add(key);
      fonts.push({ family: first, source: 'css' });
    }
  }

  // -- Logo: common selectors, header-first (donor assets.js approach) --
  const logoSelectors = [
    'img[class*="logo" i]', 'img[id*="logo" i]', 'img[alt*="logo" i]',
    '.logo img', '#logo img', 'header a[href="/"] img', 'a[href="/"] img',
    'header img', 'nav img',
  ];
  let logoUrl: string | null = null;
  for (const sel of logoSelectors) {
    const src = $(sel).first().attr('src') ?? $(sel).first().attr('data-src');
    if (src) {
      try {
        logoUrl = new URL(src, base).toString();
        break;
      } catch {
        // keep looking
      }
    }
  }
  if (!logoUrl) {
    const icon = $('link[rel*="icon"]').first().attr('href');
    if (icon) {
      try {
        logoUrl = new URL(icon, base).toString();
      } catch {
        // fine — no logo
      }
    }
  }

  return { palette, fonts: fonts.slice(0, 5), logoUrl };
}

async function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
