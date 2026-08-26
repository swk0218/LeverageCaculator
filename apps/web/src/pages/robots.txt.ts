import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const isFixture = (import.meta.env.PUBLIC_DATA_MODE ?? 'fixture') === 'fixture';
  const origin = (site ?? new URL('https://yangbokeumbok.example')).origin;
  const body = isFixture
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
