const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [name, value] = argument.split('=', 2);
    return [name?.replace(/^--/, ''), value];
  }),
);

if (!datePattern.test(options.from ?? '') || !datePattern.test(options.to ?? '')) {
  throw new Error(
    'Usage: pnpm --filter @yangbok/worker data:backfill:local -- --from=YYYY-MM-DD --to=YYYY-MM-DD',
  );
}
if (!process.env.BACKFILL_TOKEN) {
  throw new Error('BACKFILL_TOKEN must be set in the command environment.');
}

const url = new URL('/api/v1/admin/backfill', process.env.WORKER_URL ?? 'http://127.0.0.1:8787');
url.searchParams.set('from', options.from);
url.searchParams.set('to', options.to);
const response = await fetch(url, {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.BACKFILL_TOKEN}`, accept: 'application/json' },
});
if (!response.ok) throw new Error(`Local backfill failed with HTTP ${response.status}.`);
console.log(`Local backfill completed (${response.status}).`);
