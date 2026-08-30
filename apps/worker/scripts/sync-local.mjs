const url = new URL(
  '/cdn-cgi/handler/scheduled',
  process.env.WORKER_URL ?? 'http://127.0.0.1:8787',
);
url.searchParams.set('cron', '40 6 * * 1-5');

const response = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
if (!response.ok) {
  throw new Error(`Local scheduled sync failed with HTTP ${response.status}.`);
}
console.log(`Local scheduled sync accepted (${response.status}).`);
