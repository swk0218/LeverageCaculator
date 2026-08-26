import type { APIRoute } from 'astro';
import { withSiteBase } from '../lib/site-path';

export const GET: APIRoute = ({ site }) => {
  const isFixture = (import.meta.env.PUBLIC_DATA_MODE ?? 'fixture') === 'fixture';
  const origin = site ?? new URL('https://yangbokeumbok.example');
  const body = isFixture
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${new URL(withSiteBase('/sitemap.xml'), origin).toString()}\n`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
