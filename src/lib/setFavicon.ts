/**
 * Swap the browser-tab favicon at runtime. Used to apply a workspace's own
 * logo while inside /app/<slug>; passing null restores the CanopyStudio
 * default. index.html ships a single `<link rel="icon" href="/favicon.svg">`
 * — we reuse that element (or create one) and just repoint its href.
 */
const DEFAULT_FAVICON = '/favicon.svg';

export function setFavicon(url: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  const next = url && url.trim() ? url.trim() : DEFAULT_FAVICON;
  // A custom logo is an arbitrary image; drop the SVG type hint so the
  // browser sniffs it (PNG/JPG/ICO). Keep it for the default SVG.
  if (next === DEFAULT_FAVICON) link.type = 'image/svg+xml';
  else link.removeAttribute('type');
  if (link.href !== next) link.href = next;
}
