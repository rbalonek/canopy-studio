/**
 * Build-time feature flags.
 *
 * `META_WRITE_ENABLED` gates every surface that WRITES to Meta — publishing
 * organic posts, native + cron scheduling, publishing ads, and the write-only
 * Approvals / Publishing Queue routes. It is OFF unless `VITE_META_WRITE` is
 * explicitly set, so the production `/app` build (and Meta App Review) sees a
 * read-only app that matches the read-only Facebook Login configuration.
 *
 * The read-only OAuth Login config (`FB_LOGIN_CONFIG_ID`) is the real,
 * server-side guarantee — a token minted through it simply can't post. This
 * flag keeps the UI coherent with that guarantee and keeps write features out
 * of the reviewer's sight.
 *
 * To test writing locally, set `VITE_META_WRITE=1` in `.env.local` (which is
 * gitignored, so it never ships to production) and connect a System-User token
 * with write scopes. Nothing about the deployed code changes between the
 * read-only and write builds — only this env var.
 */
export const META_WRITE_ENABLED =
  import.meta.env.VITE_META_WRITE === '1' ||
  import.meta.env.VITE_META_WRITE === 'true';
