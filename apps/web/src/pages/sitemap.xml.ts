import type { APIRoute } from 'astro';
import { withSiteBase } from '../lib/site-path';

const paths = ['/', '/method', '/products', '/faq', '/privacy', '/terms', '/disclaimer'];

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://yangbokeumbok.example');
  const urls = paths
    .map((path) => `<url><loc>${new URL(withSiteBase(path), origin).toString()}</loc></url>`)
    .join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
