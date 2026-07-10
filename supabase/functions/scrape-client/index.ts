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
  /** Explicit pages to add/refresh. When present, discovery + ranking are
   * skipped and exactly these same-domain URLs are (re)scraped — existing
   * pages are left untouched, so a member can add a few individual pages
   * without re-crawling. Re-scraping a URL this way re-activates it (clears
   * any prior exclusion / manual-edit flag). Own-site scrapes only. */
  urls?: string[];
  /** When set, this is a competitor scrape: pages/domain rows are tagged
   * with the competitor and replaced wholesale on each run. */
  competitor_id?: string;
  /** Tag the scraped pages with a location of this client (add-mode only —
   * a full discovery crawl is site-wide, not location-scoped). Used when a
   * confirmed location's own pages (/asheville, /asheville/birthdays) are
   * pulled in so location-scoped AI jobs can read them. */
  location_id?: string;
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
    // Explicit add-pages list (own-site only). Ignored for competitor scrapes.
    const addUrls = !body.competitor_id && Array.isArray(body.urls)
      ? body.urls.map((u) => String(u).trim()).filter(Boolean)
      : [];
    // Location tagging: add-mode + own-site only, and the location must
    // belong to this client.
    let locationId: string | null = null;
    if (body.location_id && !body.competitor_id && addUrls.length > 0) {
      const { data: loc } = await service
        .from('locations')
        .select('id')
        .eq('id', body.location_id)
        .eq('client_id', body.client_id)
        .maybeSingle();
      if (!loc) {
        return json({ ok: false, error: 'Location not found for this client' }, 404);
      }
      locationId = body.location_id;
    }
    const result = await scrape(
      body.client_id,
      body.url,
      maxPages,
      service,
      body.competitor_id ?? null,
      addUrls,
      locationId,
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
  addUrls: string[] = [],
  locationId: string | null = null,
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

  // Own-site page controls (exclusions + manual edits) so a re-crawl can
  // leave excluded/hand-edited pages alone. Competitor scrapes ignore these.
  const controls = new Map<string, { excluded: string; contentEdited: boolean }>();
  let existingDomainDiscovered = 0;
  let existingSitemapStatus: 'Discovered' | 'Partial' | 'Failed' | null = null;
  if (!competitorId) {
    const [{ data: ctrlRows }, { data: domRow }] = await Promise.all([
      service
        .from('scraped_pages')
        .select('url, excluded, content_edited')
        .eq('client_id', clientId)
        .is('competitor_id', null),
      service
        .from('scraped_domains')
        .select('pages_discovered, sitemap_status')
        .eq('client_id', clientId)
        .is('competitor_id', null)
        .eq('domain', domain)
        .maybeSingle(),
    ]);
    for (const r of (ctrlRows ?? []) as any[]) {
      controls.set(r.url as string, {
        excluded: (r.excluded as string) ?? 'none',
        contentEdited: !!r.content_edited,
      });
    }
    existingDomainDiscovered = (domRow?.pages_discovered as number) ?? 0;
    existingSitemapStatus = (domRow?.sitemap_status as typeof existingSitemapStatus) ?? null;
  }

  // Add-mode: explicit same-site URLs, no discovery/ranking. Own-site only.
  // Same-site is www-insensitive, and we normalize each URL's host + protocol
  // to the client's canonical domain (`base`) — discovery-mode pages all use
  // base.hostname, so this keeps an added page grouped + counted with the rest
  // of the site instead of stranding it under a separate www/non-www host.
  const explicitUrls = competitorId
    ? []
    : Array.from(
        new Set(
          addUrls
            .map((u) => {
              try {
                const parsed = new URL(u.startsWith('http') ? u : `https://${u}`);
                if (!sameSite(parsed.toString(), base)) return '';
                parsed.protocol = base.protocol;
                parsed.hostname = base.hostname;
                return parsed.toString();
              } catch {
                return '';
              }
            })
            .filter(Boolean),
        ),
      );
  const isAddMode = explicitUrls.length > 0;

  // --- 1. Discover URLs ---
  const discovered = new Set<string>();
  let sitemapStatus: 'Discovered' | 'Partial' | 'Failed' = 'Failed';
  let toScrape: string[];

  if (isAddMode) {
    // Skip discovery; the requested pages ARE the work list. Keep the domain's
    // prior sitemap status rather than downgrading it to Failed.
    explicitUrls.forEach((u) => discovered.add(u));
    sitemapStatus = existingSitemapStatus ?? 'Partial';
    toScrape = explicitUrls;
  } else {
    discovered.add(base.toString());
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

    // Rank + cap, then drop pages the member has excluded from scraping or
    // hand-edited — those are preserved as-is (their content still lives in
    // scraped_pages; 'all'-excluded ones are withheld from the AI downstream).
    const ranked = rankUrls(Array.from(discovered), base);
    toScrape = ranked.slice(0, maxPages).filter((u) => {
      const ctrl = controls.get(u);
      return !(ctrl && (ctrl.excluded !== 'none' || ctrl.contentEdited));
    });
  }

  // --- 2. Scrape each ---
  // Both client and competitor pages upsert on (client_id, url, competitor_id)
  // — non-destructive, so a failed re-scrape never wipes prior content. (The
  // constraint now carries competitor_id, so a URL shared by two competitors,
  // or by a competitor and the client's own site, no longer collides.)
  let scrapedCount = 0;
  for (const u of toScrape) {
    try {
      const page = await fetchAndParse(u);
      if (!page) continue;
      const row: Record<string, unknown> = {
        client_id: clientId,
        competitor_id: competitorId,
        url: u,
        title: page.title,
        content: page.content,
        word_count: page.wordCount,
        status: 'analyzed',
        scraped_at: new Date().toISOString(),
      };
      // Explicitly re-scraping a page (add-mode) re-activates it: clear any
      // prior exclusion + manual-edit flag so its fresh content is used. In
      // discovery mode these columns are omitted, so upsert preserves them.
      if (isAddMode) {
        row.excluded = 'none';
        row.content_edited = false;
        // Location-tagged add-mode: claim the page for the location. Only
        // written when a location was requested, so a plain add-pages run
        // never strips an existing tag.
        if (locationId) row.location_id = locationId;
      }
      const { error: writeErr } = await service
        .from('scraped_pages')
        .upsert(row, { onConflict: 'client_id,url,competitor_id' });
      if (writeErr) {
        errors.push(`write ${u}: ${writeErr.message}`);
        continue;
      }
      scrapedCount++;
    } catch (e) {
      errors.push(`${u}: ${(e as Error).message}`);
    }
  }

  // Prune a competitor's stale pages (URLs gone since the last scrape) — but
  // only when this run produced fresh content, so a fully failed scrape
  // (competitor site down/blocked/rate-limited) preserves what we already had
  // instead of leaving the competitor with zero pages. Fresh rows carry a
  // scraped_at at or after startedAt; anything older is stale.
  if (competitorId && scrapedCount > 0) {
    const { error: pruneErr } = await service
      .from('scraped_pages')
      .delete()
      .eq('competitor_id', competitorId)
      .lt('scraped_at', startedAt);
    if (pruneErr) errors.push(`prune stale pages: ${pruneErr.message}`);
  }

  // --- 3. Design signals (palette / fonts / logo) from the homepage ---
  // Heuristic by nature — staged on the domain row for the
  // website_analysis job to fold into brand_profiles as "detected". Skipped in
  // add-mode: adding a subpage shouldn't re-mine (or clobber) the homepage's
  // brand look, so the domain row keeps its existing palette/fonts/logo.
  // The same unstripped homepage fetch also yields nav_links (anchor text +
  // URL, nav/header/footer included — where "Select a Park"-style location
  // pickers live), the raw material for the location_detection job.
  let design: DesignSignals = { palette: [], fonts: [], logoUrl: null, navLinks: [] };
  if (!isAddMode) {
    try {
      design = await extractDesignSignals(base);
    } catch (e) {
      errors.push(`design signals: ${(e as Error).message}`);
    }
  }

  // For own-site scrapes, pages_indexed reflects the domain's true total (adds
  // accumulate), not just this run's count; pages_discovered never shrinks.
  let indexedTotal = scrapedCount;
  let discoveredTotal = discovered.size;
  if (!competitorId) {
    const { data: allRows } = await service
      .from('scraped_pages')
      .select('url')
      .eq('client_id', clientId)
      .is('competitor_id', null);
    indexedTotal = ((allRows ?? []) as { url: string }[]).filter(
      (r) => sameDomain(r.url, base),
    ).length;
    discoveredTotal = Math.max(discovered.size, existingDomainDiscovered, indexedTotal);
  }

  // --- 4. Roll up domain stats ---
  const domainRow: Record<string, unknown> = {
    client_id: clientId,
    competitor_id: competitorId,
    domain,
    health: (competitorId ? scrapedCount : indexedTotal) > 0 ? 'Healthy' : 'Error',
    sitemap_status: sitemapStatus,
    pages_discovered: competitorId ? discovered.size : discoveredTotal,
    pages_indexed: competitorId ? scrapedCount : indexedTotal,
    last_crawled_at: new Date().toISOString(),
  };
  // Only write design signals when we actually mined them, so an add-mode run
  // (or a run where extraction failed) preserves the prior palette/fonts/logo.
  if (!isAddMode) {
    domainRow.raw_palette = design.palette.length ? design.palette : null;
    domainRow.raw_fonts = design.fonts.length ? design.fonts : null;
    domainRow.logo_url = design.logoUrl;
    // Detection material for own-site discovery runs: homepage nav links +
    // the full discovery set (capped) so location_detection sees pages far
    // beyond the few actually scraped.
    if (!competitorId) {
      domainRow.nav_links = design.navLinks.length ? design.navLinks : null;
      const discoveredList = Array.from(discovered).slice(0, 300);
      domainRow.discovered_urls = discoveredList.length ? discoveredList : null;
    }
  }
  if (competitorId) {
    if (scrapedCount > 0) {
      // Fresh content — replace the domain summary in place.
      await service
        .from('scraped_domains')
        .upsert(domainRow, { onConflict: 'client_id,domain,competitor_id' });
    } else {
      // Failed scrape: record the health/attempt without destroying the
      // palette/fonts/logo captured on a previous successful run. Only insert
      // a fresh row if there was none (first-ever scrape had nothing to lose).
      const { data: updated } = await service
        .from('scraped_domains')
        .update({
          health: 'Error',
          sitemap_status: sitemapStatus,
          pages_discovered: discovered.size,
          last_crawled_at: new Date().toISOString(),
        })
        .eq('competitor_id', competitorId)
        .eq('domain', domain)
        .select('id');
      if (!updated || updated.length === 0) {
        await service.from('scraped_domains').insert(domainRow);
      }
    }
    await service
      .from('competitors')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', competitorId);
  } else {
    await service
      .from('scraped_domains')
      .upsert(domainRow, { onConflict: 'client_id,domain,competitor_id' });
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

/** Like sameDomain but treats www.example.com and example.com as one site.
 * Used for the add-pages list so a leading-www mismatch doesn't drop URLs. */
function sameSite(u: string, base: URL): boolean {
  const strip = (h: string) => h.replace(/^www\./i, '');
  try {
    return strip(new URL(u).hostname) === strip(base.hostname);
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
  /** Same-site anchors (href + visible text) from the unstripped homepage.
   * Raw material for the location_detection job. */
  navLinks: Array<{ url: string; text: string }>;
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
  if (!resp.ok) return { palette: [], fonts: [], logoUrl: null, navLinks: [] };
  const html = await resp.text();
  const $ = cheerio.load(html);

  // -- Nav links: every same-site anchor with its visible text, deduped by
  //    URL, capped. Location pickers ("Select a Park" → /anderson, /asheville)
  //    live in exactly the nav/header markup fetchAndParse strips, so this is
  //    the one place they're reliably visible. --
  const navLinks: DesignSignals['navLinks'] = [];
  const seenNav = new Set<string>();
  $('a[href]').each((_: number, el: any) => {
    if (navLinks.length >= 150) return;
    const href = $(el).attr('href');
    if (!href || href.startsWith('#')) return;
    try {
      const abs = new URL(href, base);
      if (!sameSite(abs.toString(), base)) return;
      abs.hash = '';
      const url = abs.toString();
      if (seenNav.has(url)) return;
      seenNav.add(url);
      const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
      navLinks.push({ url, text });
    } catch {
      // skip invalid hrefs
    }
  });

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

  // -- Logo: try in descending order of reliability — real logo markup,
  //    then structured data, header imagery, the social-card image, and
  //    finally icons. Resolves relative URLs against the page. --
  // deno-lint-ignore no-explicit-any
  const firstSrcset = (ss: string): string | null => ss.split(',')[0]?.trim().split(/\s+/)[0] || null;
  // deno-lint-ignore no-explicit-any
  const imgSrc = (el: any): string | null =>
    el.attr('src') || el.attr('data-src') || (el.attr('srcset') ? firstSrcset(el.attr('srcset')) : null);
  // Walk a JSON-LD node (Organization/WebSite/@graph) for a `logo` field.
  // deno-lint-ignore no-explicit-any
  const digLogo = (node: any): string | null => {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const r = digLogo(n);
        if (r) return r;
      }
      return null;
    }
    if (typeof node === 'object') {
      const g = node['@graph'] ? digLogo(node['@graph']) : null;
      if (g) return g;
      const logo = node.logo;
      if (typeof logo === 'string') return logo;
      if (logo && typeof logo === 'object' && typeof logo.url === 'string') return logo.url;
    }
    return null;
  };

  let logoUrl: string | null = null;
  const resolve = (raw: string | null | undefined) => {
    if (logoUrl || !raw) return;
    try {
      logoUrl = new URL(raw, base).toString();
    } catch {
      // ignore unparseable URL; keep looking
    }
  };

  // 1. An <img> whose class/id/alt actually says "logo".
  for (const sel of ['img[class*="logo" i]', 'img[id*="logo" i]', 'img[alt*="logo" i]', '.logo img', '#logo img']) {
    if (logoUrl) break;
    resolve(imgSrc($(sel).first()));
  }
  // 2. schema.org structured data (Organization/WebSite logo).
  if (!logoUrl) {
    $('script[type="application/ld+json"]').each((_i, el) => {
      if (logoUrl) return;
      try {
        resolve(digLogo(JSON.parse($(el).text() || '')));
      } catch {
        // malformed JSON-LD — skip
      }
    });
  }
  if (!logoUrl) resolve($('meta[itemprop="logo"]').attr('content') || $('meta[property="og:logo"]').attr('content'));
  // 3. Header / home-link imagery (structural guess).
  for (const sel of ['header a[href="/"] img', 'a[href="/"] img', 'header img', 'nav img']) {
    if (logoUrl) break;
    resolve(imgSrc($(sel).first()));
  }
  // 4. Social-card image — a brand image, though not always a strict logo.
  if (!logoUrl) resolve($('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content'));
  // 5. Clean square app icon, then favicon, as last resorts.
  if (!logoUrl) {
    resolve(
      $('link[rel="apple-touch-icon"]').first().attr('href') ||
        $('link[rel="apple-touch-icon-precomposed"]').first().attr('href'),
    );
  }
  if (!logoUrl) resolve($('link[rel*="icon"]').first().attr('href'));

  return { palette, fonts: fonts.slice(0, 5), logoUrl, navLinks };
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
