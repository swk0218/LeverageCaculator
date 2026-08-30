import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parse as parseJsoncText, printParseErrorCode } from 'jsonc-parser';

const root = process.cwd();
const webDist = resolve(root, 'apps/web/dist');
const workerRoot = resolve(root, 'apps/worker');
const pagesStaticData = resolve(webDist, 'data', 'analysis');
const releaseCheckSite = 'https://release-check.invalid';
const releaseCheckApi = 'https://api.release-check.invalid';
const releaseTarget = process.env.RELEASE_TARGET?.trim() || 'worker';
const pagesStaticRelease = releaseTarget === 'pages-static';
const failures = [];
const externalBlockers = [];
const passes = [];

const samsungSpotExpectation = Object.freeze({
  underlyingId: '005930',
  analysisBasis: 'underlying-stock',
  baseIndexName: 'KRX 삼성전자 지수(PR)',
  baseIndexType: 'price-return-index',
});
const samsungFuturesExpectation = Object.freeze({
  underlyingId: '005930',
  analysisBasis: 'reference-stock-proxy',
  baseIndexName: 'KRX 삼성전자 선물 지수',
  baseIndexType: 'futures-index',
});
const samsungTrExpectation = Object.freeze({
  underlyingId: '005930',
  analysisBasis: 'reference-stock-proxy',
  baseIndexName: 'KRX 삼성전자 TR 지수',
  baseIndexType: 'total-return-index',
});
const hynixSpotExpectation = Object.freeze({
  underlyingId: '000660',
  analysisBasis: 'underlying-stock',
  baseIndexName: 'KRX SK하이닉스 지수(PR)',
  baseIndexType: 'price-return-index',
});
const hynixFuturesExpectation = Object.freeze({
  underlyingId: '000660',
  analysisBasis: 'reference-stock-proxy',
  baseIndexName: 'KRX SK하이닉스 선물 지수',
  baseIndexType: 'futures-index',
});
const hynixTrExpectation = Object.freeze({
  underlyingId: '000660',
  analysisBasis: 'reference-stock-proxy',
  baseIndexName: 'KRX SK하이닉스 TR 지수',
  baseIndexType: 'total-return-index',
});

export const PAGES_STATIC_PRODUCT_EXPECTATIONS = Object.freeze({
  '0198B0': samsungFuturesExpectation,
  '0194N0': samsungFuturesExpectation,
  '0193W0': samsungSpotExpectation,
  '0195R0': samsungSpotExpectation,
  '0194M0': samsungSpotExpectation,
  '0192M0': samsungSpotExpectation,
  '0193K0': samsungSpotExpectation,
  520100: samsungTrExpectation,
  '0193L0': samsungFuturesExpectation,
  '0194R0': hynixFuturesExpectation,
  '0198D0': hynixFuturesExpectation,
  '0193T0': hynixSpotExpectation,
  '0195S0': hynixSpotExpectation,
  '0197W0': hynixSpotExpectation,
  '0194T0': hynixSpotExpectation,
  '0192L0': hynixSpotExpectation,
  520101: hynixTrExpectation,
  '0197X0': hynixFuturesExpectation,
});

const textArtifactExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.xml',
]);
const sourceExtensions = new Set([
  '.astro',
  '.cjs',
  '.js',
  '.json',
  '.jsonc',
  '.mjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function block(message) {
  externalBlockers.push(message);
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const generatedSourceDirectories = new Set([
  '.astro',
  '.turbo',
  '.wrangler',
  'coverage',
  'dist',
  'node_modules',
]);

function walkReleaseSourceFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && generatedSourceDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkReleaseSourceFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function isCredentialPlaceholder(value) {
  if (!value) return true;
  return /(?:placeholder|dummy|(?:^|[-_])(?:sample|test|testing)(?:[-_]|$)|not[-_]?a[-_]?real|YOUR[_-]|SET_IN_THIS_PROCESS_ONLY|REAL_D1_UUID|replace[-_]?me|change[-_]?me)/iu.test(
    value.trim(),
  );
}

function productionOrigin(value) {
  if (!value) return null;
  try {
    const normalized = value.trim();
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    const reservedHostname =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === 'example.com' ||
      hostname.endsWith('.example.com') ||
      hostname === 'example.net' ||
      hostname.endsWith('.example.net') ||
      hostname === 'example.org' ||
      hostname.endsWith('.example.org') ||
      hostname.endsWith('.invalid') ||
      /(?:^|[.-])(?:placeholder|replace-me|your-site|your-worker|dummy|test)(?:[.-]|$)/iu.test(
        hostname,
      );
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.origin !== normalized ||
      reservedHostname
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isStrongCredential(value, minimumLength = 16) {
  if (!value) return false;
  const normalized = value.trim();
  return (
    normalized.length >= minimumLength &&
    !isCredentialPlaceholder(normalized) &&
    new Set(normalized).size >= 8
  );
}

function isNonNilUuid(value) {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value) &&
    value.toLowerCase() !== '00000000-0000-0000-0000-000000000000',
  );
}

function parseJsonc(path) {
  const errors = [];
  const parsed = parseJsoncText(readText(path), errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0) {
    throw new Error(
      errors
        .map(({ error, offset }) => `${printParseErrorCode(error)} at offset ${String(offset)}`)
        .join(', '),
    );
  }
  return parsed;
}

function runProductionBuild() {
  const pnpmCli = process.env.npm_execpath;
  const executable =
    pnpmCli && existsSync(pnpmCli)
      ? process.execPath
      : process.platform === 'win32'
        ? 'pnpm.cmd'
        : 'pnpm';
  const args = pnpmCli && existsSync(pnpmCli) ? [pnpmCli, 'build'] : ['build'];
  console.log('[RUN] pnpm build');
  const result = spawnSync(executable, args, {
    cwd: root,
    env: {
      ...process.env,
      CI: '1',
      NODE_ENV: 'production',
      PUBLIC_DATA_MODE: 'live',
      PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL || releaseCheckSite,
      PUBLIC_API_BASE_URL: pagesStaticRelease
        ? ''
        : process.env.PUBLIC_API_BASE_URL || releaseCheckApi,
      ...(process.env.PUBLIC_BASE_PATH ? { PUBLIC_BASE_PATH: process.env.PUBLIC_BASE_PATH } : {}),
      PUBLIC_CONSENT_READY: process.env.PUBLIC_CONSENT_READY || 'false',
    },
    stdio: 'inherit',
  });
  if (result.error) {
    fail(`Production build could not start: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    fail(`Production build failed with exit code ${String(result.status)}.`);
    return;
  }
  pass('Production build completed successfully.');
}

function checkReleaseEnvironment() {
  if (!['worker', 'pages-static'].includes(releaseTarget)) {
    fail('RELEASE_TARGET must be exactly worker or pages-static.');
  } else {
    pass(`Release target is explicitly ${releaseTarget}.`);
  }

  if (process.env.PUBLIC_DATA_MODE === 'live') {
    pass('PUBLIC_DATA_MODE is explicitly set to live.');
  } else if (process.env.PUBLIC_DATA_MODE === 'fixture') {
    fail('PUBLIC_DATA_MODE=fixture is active; a production release must fail closed.');
  } else if (process.env.PUBLIC_DATA_MODE) {
    fail('PUBLIC_DATA_MODE must be exactly live for a production release.');
  } else {
    block(
      'Set PUBLIC_DATA_MODE=live in the production environment; the local artifact check uses an isolated live-mode build.',
    );
  }

  if (productionOrigin(process.env.PUBLIC_SITE_URL)) {
    pass('PUBLIC_SITE_URL is a canonical, non-placeholder HTTPS origin.');
  } else {
    block('PUBLIC_SITE_URL needs the final canonical, non-placeholder HTTPS origin.');
  }

  if (pagesStaticRelease) {
    if (process.env.PUBLIC_API_BASE_URL) {
      fail('Pages-static releases must leave PUBLIC_API_BASE_URL empty.');
    } else {
      pass('Pages-static release has no runtime API or browser-exposed credential dependency.');
    }
    pass('Cloudflare, D1, and backfill credentials are not required for the Pages-static target.');
  } else {
    if (productionOrigin(process.env.PUBLIC_API_BASE_URL)) {
      pass('PUBLIC_API_BASE_URL is a canonical, non-placeholder HTTPS origin.');
    } else {
      block('PUBLIC_API_BASE_URL needs the deployed Worker canonical HTTPS origin.');
    }

    if (isStrongCredential(process.env.DATA_GO_KR_SERVICE_KEY)) {
      pass('The public-data service credential is present in the release environment.');
    } else {
      block(
        'DATA_GO_KR_SERVICE_KEY is absent, too short, or placeholder; live FSC ingestion cannot be verified or deployed.',
      );
    }

    if (isStrongCredential(process.env.BACKFILL_TOKEN)) {
      pass('BACKFILL_TOKEN is present, non-placeholder, and at least 16 characters.');
    } else {
      block('BACKFILL_TOKEN is absent, shorter than 16 characters, or placeholder.');
    }

    if (isNonNilUuid(process.env.D1_DATABASE_ID)) {
      pass('D1_DATABASE_ID is a non-placeholder UUID.');
    } else {
      block(
        'D1_DATABASE_ID is absent, placeholder, or not a UUID; the production database cannot be targeted.',
      );
    }

    const cloudflareTokens = [process.env.CLOUDFLARE_API_TOKEN, process.env.CF_API_TOKEN];
    if (cloudflareTokens.some((token) => isStrongCredential(token))) {
      pass('Cloudflare token-based authentication is present.');
    } else {
      block(
        'Cloudflare authentication is not proven. Provide CLOUDFLARE_API_TOKEN/CF_API_TOKEN or verify an interactive Wrangler login before deployment.',
      );
    }
  }
}

function checkAdConsentConfiguration() {
  const consent = process.env.PUBLIC_CONSENT_READY;
  if (consent !== undefined && consent !== 'true' && consent !== 'false') {
    fail('PUBLIC_CONSENT_READY must be exactly true or false when set.');
  }

  const adValues = [
    process.env.PUBLIC_ADSENSE_CLIENT,
    process.env.PUBLIC_AD_SLOT_RESULT,
    process.env.PUBLIC_AD_SLOT_CONTENT,
  ];
  const configuredCount = adValues.filter(Boolean).length;
  if (configuredCount > 0 && configuredCount < adValues.length) {
    fail('AdSense client and both manual slot IDs must be configured together.');
  } else if (consent === 'true' && configuredCount !== adValues.length) {
    fail(
      'Consent cannot be marked ready while the explicit AdSense client/slot configuration is incomplete.',
    );
  } else if (configuredCount === adValues.length && consent === 'true') {
    pass('Advertising is explicitly configured with consent readiness.');
  } else {
    pass(
      'Advertising remains disabled because consent and a complete explicit configuration are not both present.',
    );
  }

  const baseLayoutPath = resolve(root, 'apps/web/src/layouts/BaseLayout.astro');
  const adSlotPath = resolve(root, 'apps/web/src/components/AdSlot.astro');
  if (!existsSync(baseLayoutPath) || !existsSync(adSlotPath)) {
    fail('BaseLayout.astro and AdSlot.astro are required to verify the advertising gate.');
    return;
  }
  const gateSource = `${readText(baseLayoutPath)}\n${readText(adSlotPath)}`;
  const gateRequirements = [
    ['PUBLIC_ADSENSE_CLIENT', 'AdSense client environment gate'],
    ['PUBLIC_CONSENT_READY', 'consent readiness gate'],
    ['PUBLIC_DATA_MODE', 'live-data/fixture gate'],
  ];
  for (const [needle, description] of gateRequirements) {
    if (!gateSource.includes(needle)) fail(`Advertising source is missing the ${description}.`);
  }
  if (gateRequirements.every(([needle]) => gateSource.includes(needle))) {
    pass('Advertising source requires client configuration, consent, and a non-fixture data mode.');
  }
}

function findBuiltPage(route) {
  const normalized = route.replace(/^\//u, '');
  const candidates = normalized
    ? [resolve(webDist, normalized, 'index.html'), resolve(webDist, `${normalized}.html`)]
    : [resolve(webDist, 'index.html')];
  return candidates.find((path) => existsSync(path));
}

function checkBuildArtifacts() {
  if (!existsSync(webDist) || !statSync(webDist).isDirectory()) {
    fail('apps/web/dist is missing after the production build.');
    return;
  }

  const requiredRoutes = ['/', '/method', '/products', '/faq', '/privacy', '/terms', '/disclaimer'];
  for (const route of requiredRoutes) {
    const builtPage = findBuiltPage(route);
    if (!builtPage || statSync(builtPage).size < 200) {
      fail(`Built page for ${route} is missing or unexpectedly small.`);
    }
  }
  const requiredArtifacts = ['404.html', 'robots.txt', 'sitemap.xml', '_headers'];
  for (const artifact of requiredArtifacts) {
    const path = resolve(webDist, artifact);
    if (!existsSync(path) || statSync(path).size === 0)
      fail(`Built artifact ${artifact} is missing or empty.`);
  }

  const headersPath = resolve(webDist, '_headers');
  if (existsSync(headersPath)) {
    const headers = readText(headersPath);
    const requiredHeaders = [
      'X-Content-Type-Options',
      'Referrer-Policy',
      'X-Frame-Options',
      'Permissions-Policy',
      'Strict-Transport-Security',
      'Content-Security-Policy',
    ];
    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(`${header}:`));
    if (missingHeaders.length > 0) {
      fail(`Static security headers are incomplete: ${missingHeaders.join(', ')}`);
    } else {
      pass(
        pagesStaticRelease
          ? 'The static header policy file is complete; GitHub Pages response-header support is not claimed.'
          : 'Static Pages responses declare the required baseline security headers.',
      );
    }
  }

  if (pagesStaticRelease) checkPagesStaticData();

  const artifactFiles = walkFiles(webDist).filter((path) =>
    textArtifactExtensions.has(extname(path)),
  );
  const artifactText = artifactFiles
    .map((path) => `\n/* ${relative(webDist, path)} */\n${readText(path)}`)
    .join('\n');
  const fixtureMarkers = [
    'Fixture 데이터로 확인 중',
    '체험용 데이터 사용 중',
    '[체험용]',
    'F2UP01',
    'F2DN01',
    'FPOS01',
    'FSTL01',
    'FMIS01',
    'FACT01',
  ];
  const leakedFixtureMarkers = fixtureMarkers.filter((marker) => artifactText.includes(marker));
  if (leakedFixtureMarkers.length > 0) {
    fail(
      `Fixture/placeholder data leaked into the production bundle: ${leakedFixtureMarkers.join(', ')}`,
    );
  } else {
    pass('No known fixture products or fixture banner copy exist in the production bundle.');
  }

  if (
    /yangbokeumbok\.example/i.test(artifactText) ||
    /database_id.{0,120}00000000-0000-0000-0000-000000000000/is.test(artifactText)
  ) {
    fail('A configured placeholder site/database identifier leaked into production artifacts.');
  }

  const indexableHtml = artifactFiles.filter(
    (path) => extname(path) === '.html' && !/(?:^|[\\/])404\.html$/u.test(path),
  );
  const noindexPages = indexableHtml
    .filter((path) =>
      /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(readText(path)),
    )
    .map((path) => relative(webDist, path));
  if (noindexPages.length > 0) {
    fail(`Production noindex leakage found in: ${noindexPages.join(', ')}`);
  } else {
    pass('Production HTML pages are not marked noindex.');
  }

  const robotsPath = resolve(webDist, 'robots.txt');
  if (existsSync(robotsPath)) {
    const robots = readText(robotsPath);
    if (!/^Allow:\s*\/$/imu.test(robots) || /^Disallow:\s*\/$/imu.test(robots)) {
      fail('Production robots.txt must allow crawling and must not disallow the entire site.');
    } else {
      pass('Production robots.txt is crawlable.');
    }
  }

  const adNetworkPresent = /pagead2\.googlesyndication\.com|adsbygoogle/i.test(artifactText);
  const adsExpected =
    process.env.PUBLIC_CONSENT_READY === 'true' &&
    Boolean(process.env.PUBLIC_ADSENSE_CLIENT) &&
    Boolean(process.env.PUBLIC_AD_SLOT_RESULT) &&
    Boolean(process.env.PUBLIC_AD_SLOT_CONTENT) &&
    process.env.PUBLIC_DATA_MODE === 'live';
  if (adNetworkPresent && !adsExpected) {
    fail(
      'An external advertising script/initializer exists without the complete consent-enabled release gate.',
    );
  } else {
    pass('Built advertising behavior matches the explicit consent configuration.');
  }

  const secretNames = [
    'DATA_GO_KR_SERVICE_KEY',
    'BACKFILL_TOKEN',
    'D1_DATABASE_ID',
    'CLOUDFLARE_API_TOKEN',
    'CF_API_TOKEN',
  ];
  for (const secretName of secretNames) {
    if (artifactText.includes(secretName))
      fail(`Client artifacts contain the server-only name ${secretName}.`);
    const value = process.env[secretName];
    if (value && value.length >= 8 && artifactText.includes(value)) {
      fail(`Client artifacts contain the value of server-only ${secretName}.`);
    }
  }
  if (!failures.some((message) => message.includes('server-only'))) {
    pass('No configured server-only credential values or names were found in client artifacts.');
  }
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(instant.valueOf()) && instant.toISOString().slice(0, 10) === value;
}

function isValidPriceSeries(series) {
  if (!Array.isArray(series) || series.length === 0) return false;
  let previousDate;
  for (const point of series) {
    if (
      point === null ||
      typeof point !== 'object' ||
      !isIsoDate(point.date) ||
      typeof point.close !== 'number' ||
      !Number.isFinite(point.close) ||
      point.close <= 0 ||
      (previousDate !== undefined && point.date <= previousDate)
    ) {
      return false;
    }
    previousDate = point.date;
  }
  return true;
}

function samePricePoint(left, right) {
  return (
    left !== undefined &&
    right !== undefined &&
    left.date === right.date &&
    left.close === right.close
  );
}

export function validatePagesStaticProductExport(fileName, payload) {
  const issues = [];
  const fileCode = /^[0-9A-Z]{6}\.json$/u.test(fileName) ? fileName.slice(0, -5) : undefined;
  const expected = fileCode === undefined ? undefined : PAGES_STATIC_PRODUCT_EXPECTATIONS[fileCode];
  const product = payload?.data?.product;
  const productSeries = payload?.data?.productSeries;
  const underlyingSeries = payload?.data?.underlyingSeries;
  const latest = payload?.data?.latest;

  if (expected === undefined) issues.push('UNEXPECTED_PRODUCT_CODE');
  if (payload?.meta?.mode !== 'live' || payload?.data?.source !== 'static-export') {
    issues.push('NON_LIVE_STATIC_SOURCE');
  }
  if (
    product?.code !== fileCode ||
    product?.analysisCapability !== 'full' ||
    product?.underlyingId !== expected?.underlyingId ||
    product?.underlyingType !== 'stock' ||
    product?.analysisBasis !== expected?.analysisBasis ||
    product?.baseIndexName !== expected?.baseIndexName ||
    product?.baseIndexType !== expected?.baseIndexType
  ) {
    issues.push('PRODUCT_METADATA_MISMATCH');
  }

  const productSeriesValid = isValidPriceSeries(productSeries);
  const underlyingSeriesValid = isValidPriceSeries(underlyingSeries);
  if (!productSeriesValid) issues.push('PRODUCT_SERIES_INVALID');
  if (!underlyingSeriesValid) issues.push('UNDERLYING_SERIES_INVALID');

  if (productSeriesValid && !samePricePoint(latest?.product, productSeries.at(-1))) {
    issues.push('LATEST_PRODUCT_MISMATCH');
  }
  if (underlyingSeriesValid && !samePricePoint(latest?.underlying, underlyingSeries.at(-1))) {
    issues.push('LATEST_UNDERLYING_MISMATCH');
  }
  if (productSeriesValid && underlyingSeriesValid) {
    const underlyingDates = new Set(underlyingSeries.map(({ date }) => date));
    const latestCommonDate = productSeries
      .map(({ date }) => date)
      .filter((date) => underlyingDates.has(date))
      .at(-1);
    if (latestCommonDate === undefined) issues.push('NO_COMMON_TRADE_DATE');
    else if (latest?.analysisDate !== latestCommonDate) issues.push('ANALYSIS_DATE_MISMATCH');
  }

  return issues;
}

function checkPagesStaticData() {
  const failureCountBefore = failures.length;
  if (!existsSync(pagesStaticData) || !statSync(pagesStaticData).isDirectory()) {
    fail('Pages-static data directory is missing from the built artifact.');
    return;
  }

  const files = readdirSync(pagesStaticData)
    .filter((name) => /^[0-9A-Z]{6}\.json$/u.test(name))
    .sort();
  const expectedFiles = Object.keys(PAGES_STATIC_PRODUCT_EXPECTATIONS)
    .map((code) => `${code}.json`)
    .sort();
  if (
    files.length !== expectedFiles.length ||
    expectedFiles.some((name, index) => name !== files[index])
  ) {
    fail(
      `Pages-static release requires the exact 18-product export set; found ${String(files.length)} recognized files.`,
    );
  }

  const codes = new Set();
  for (const name of files) {
    const path = resolve(pagesStaticData, name);
    try {
      const payload = JSON.parse(readText(path));
      const code = payload?.data?.product?.code;
      const issues = validatePagesStaticProductExport(name, payload);
      if (issues.length > 0) {
        fail(
          `Pages-static product export ${name} is incomplete or internally inconsistent: ${issues.join(', ')}.`,
        );
      }
      if (typeof code === 'string') codes.add(code);
    } catch (error) {
      fail(`Pages-static product export ${name} is not valid JSON: ${String(error)}`);
    }
  }

  if (codes.size !== 18) {
    fail(`Pages-static product exports must contain 18 unique product codes; found ${codes.size}.`);
  }
  if (failures.length === failureCountBefore) {
    pass(
      'All 18 Pages-static product and underlying series are present, mapped, and internally consistent.',
    );
  }
}

function checkPreviewIndexingGate() {
  const layoutPath = resolve(root, 'apps/web/src/layouts/BaseLayout.astro');
  const robotsPath = resolve(root, 'apps/web/src/pages/robots.txt.ts');
  if (!existsSync(layoutPath) || !existsSync(robotsPath)) {
    fail('Preview indexing gates require BaseLayout.astro and robots.txt.ts.');
    return;
  }
  const layout = readText(layoutPath);
  const robots = readText(robotsPath);
  if (
    !layout.includes('PUBLIC_DATA_MODE') ||
    !layout.includes('noindex,nofollow') ||
    !robots.includes('PUBLIC_DATA_MODE') ||
    !robots.includes('Disallow: /')
  ) {
    fail('Fixture/preview mode must emit noindex,nofollow and a site-wide robots disallow rule.');
  } else {
    pass('Fixture/preview indexing is explicitly blocked in layout metadata and robots.txt.');
  }
}

function checkPolicySources() {
  const requiredPolicies = [
    ['privacy', '개인정보처리방침'],
    ['terms', '이용약관'],
    ['disclaimer', '투자 관련 고지'],
  ];
  for (const [route, requiredCopy] of requiredPolicies) {
    const path = resolve(root, `apps/web/src/pages/${route}.astro`);
    if (!existsSync(path)) {
      fail(`Policy source /${route} is missing.`);
      continue;
    }
    if (!readText(path).includes(requiredCopy))
      fail(`Policy source /${route} lacks its required title/copy.`);
  }
  if (
    requiredPolicies.every(([route]) =>
      existsSync(resolve(root, `apps/web/src/pages/${route}.astro`)),
    )
  ) {
    pass('Privacy, terms, and investment-disclaimer policy sources are present.');
  }
}

function checkTodoAndFixme() {
  const reviewMarker = new RegExp(`\\b(?:${'TO' + 'DO'}|${'FIX' + 'ME'})\\b`, 'i');
  const rootsToScan = ['apps', 'packages', '.github']
    .map((directory) => resolve(root, directory))
    .filter(existsSync);
  const findings = rootsToScan.flatMap((directory) =>
    walkReleaseSourceFiles(directory)
      .filter((path) => sourceExtensions.has(extname(path)))
      .filter((path) => reviewMarker.test(readText(path)))
      .map((path) => relative(root, path)),
  );
  if (findings.length > 0)
    fail(`Unreviewed TODO/FIXME markers remain in release source: ${findings.join(', ')}`);
  else pass('No TODO/FIXME markers remain in release source.');
}

function checkMigrations() {
  const migrationsDirectory = resolve(workerRoot, 'migrations');
  const migrationFiles = walkFiles(migrationsDirectory)
    .filter((path) => extname(path) === '.sql')
    .sort();
  if (migrationFiles.length === 0) {
    fail('No Worker D1 migrations were found.');
    return;
  }

  const prefixes = migrationFiles.map(
    (path) => /^([0-9]+)_/u.exec(relative(migrationsDirectory, path))?.[1],
  );
  if (
    prefixes.some((prefix) => prefix === undefined) ||
    new Set(prefixes).size !== prefixes.length
  ) {
    fail('Migration filenames need unique numeric prefixes.');
  }

  const migrationSql = migrationFiles.map(readText).join('\n');
  for (const table of ['assets', 'products', 'prices', 'sync_runs']) {
    if (
      !new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${table}\\b`, 'i').test(
        migrationSql,
      )
    ) {
      fail(`D1 migrations do not create the required ${table} table.`);
    }
  }
  if (
    !/(?:PRIMARY\s+KEY|UNIQUE(?:\s+INDEX)?)\s*(?:IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+prices\s*)?\(\s*asset_id\s*,\s*trade_date\s*\)/i.test(
      migrationSql,
    )
  ) {
    fail('D1 migrations must enforce uniqueness for prices(asset_id, trade_date).');
  }

  const wranglerCandidates = [
    resolve(workerRoot, 'wrangler.jsonc'),
    resolve(workerRoot, 'wrangler.toml'),
  ];
  const wranglerPath = wranglerCandidates.find(existsSync);
  if (!wranglerPath) {
    fail('Worker Wrangler configuration is missing.');
  } else {
    const wrangler = readText(wranglerPath);
    if (!/migrations_dir["']?\s*[:=]\s*["']migrations["']/i.test(wrangler)) {
      fail('Wrangler configuration does not point at the migrations directory.');
    }
    if (extname(wranglerPath) !== '.jsonc') {
      fail('The release gate requires the checked-in Wrangler JSONC configuration.');
    } else {
      try {
        const config = parseJsonc(wranglerPath);
        const production = config.env?.production;
        if (!config.name || !production?.name || config.name === production.name) {
          fail('Fixture/default and production Worker names must be present and distinct.');
        } else {
          pass('Fixture/default and production Worker names are distinct.');
        }
        if (config.vars?.DATA_MODE !== 'fixture') {
          fail('Wrangler default environment must remain explicitly fixture-only.');
        } else {
          pass('Wrangler default environment is explicitly fixture-only.');
        }
        if (production?.vars?.DATA_MODE !== 'live') {
          fail('Wrangler production must set DATA_MODE to live.');
        } else {
          pass('Wrangler production explicitly sets DATA_MODE to live.');
        }
        const requiredSecrets = production?.secrets?.required;
        if (
          !Array.isArray(requiredSecrets) ||
          !['DATA_GO_KR_SERVICE_KEY', 'BACKFILL_TOKEN'].every((secret) =>
            requiredSecrets.includes(secret),
          )
        ) {
          fail('Wrangler production must require the data service key and backfill token.');
        } else {
          pass('Wrangler production declares both required Worker secrets.');
        }
        const defaultDatabaseId = config.d1_databases?.[0]?.database_id;
        const productionDatabaseId = production?.d1_databases?.[0]?.database_id;
        if (isNonNilUuid(defaultDatabaseId)) {
          if (defaultDatabaseId === productionDatabaseId) {
            fail('The default fixture Worker must not share the production D1 database.');
          } else {
            pass('The default fixture Worker uses a D1 database distinct from production.');
          }
        } else if (
          defaultDatabaseId === '00000000-0000-0000-0000-000000000000' ||
          defaultDatabaseId === undefined
        ) {
          pass('The default fixture Worker has no deployable remote D1 binding.');
        } else {
          fail('The default fixture D1 ID must be a UUID or the inert nil placeholder.');
        }
        if (!isNonNilUuid(productionDatabaseId)) {
          block('Wrangler production still contains an absent, invalid, or placeholder D1 ID.');
        } else {
          pass('Wrangler production D1 ID is a non-placeholder UUID.');
          if (
            isNonNilUuid(process.env.D1_DATABASE_ID) &&
            process.env.D1_DATABASE_ID !== productionDatabaseId
          ) {
            fail('D1_DATABASE_ID does not match the Wrangler production database ID.');
          }
        }
        const productionSite = production?.vars?.PUBLIC_SITE_URL;
        const productionSiteOrigin = productionOrigin(productionSite);
        if (!productionSiteOrigin) {
          block(
            'Wrangler production PUBLIC_SITE_URL still needs the final canonical HTTPS origin.',
          );
        } else {
          pass('Wrangler production PUBLIC_SITE_URL is a final canonical HTTPS origin.');
          const releaseSiteOrigin = productionOrigin(process.env.PUBLIC_SITE_URL);
          if (releaseSiteOrigin && releaseSiteOrigin !== productionSiteOrigin) {
            fail('Release PUBLIC_SITE_URL must equal Wrangler production PUBLIC_SITE_URL.');
          }
        }
        const productionOrigins = String(production?.vars?.ALLOWED_ORIGINS ?? '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);
        if (
          productionOrigins.length === 0 ||
          !productionOrigins.every((origin) => productionOrigin(origin) === origin)
        ) {
          block('Wrangler production ALLOWED_ORIGINS still needs canonical final HTTPS origin(s).');
        } else {
          pass('Wrangler production ALLOWED_ORIGINS contains canonical final HTTPS origin(s).');
          if (productionSiteOrigin && !productionOrigins.includes(productionSiteOrigin)) {
            fail('Wrangler production ALLOWED_ORIGINS must include PUBLIC_SITE_URL exactly.');
          }
        }
        const effectiveCrons = production?.triggers?.crons ?? config.triggers?.crons;
        if (!Array.isArray(effectiveCrons) || !effectiveCrons.includes('40 6 * * 1-5')) {
          fail('Wrangler production must retain the 06:40 UTC weekday ingestion schedule.');
        } else {
          pass('Wrangler production retains the 06:40 UTC weekday ingestion schedule.');
        }
      } catch (error) {
        fail(`Wrangler JSONC could not be parsed for release safety: ${String(error)}`);
      }
    }
  }

  const migrationFailures = failures.filter((message) => /migration|D1|Wrangler/i.test(message));
  if (migrationFailures.length === 0)
    pass(`${migrationFiles.length} D1 migration file(s) satisfy the release schema gate.`);
}

function checkTrackedSecretFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    fail('git ls-files failed; tracked secret-file policy could not be verified.');
    return;
  }
  const tracked = result.stdout.split('\0').filter(Boolean);
  const forbidden = tracked.filter((path) => {
    const name = path.replaceAll('\\', '/').split('/').at(-1) ?? '';
    const forbiddenDevVars = name.startsWith('.dev.vars') && name !== '.dev.vars.example';
    return forbiddenDevVars || (name.startsWith('.env') && name !== '.env.example');
  });
  if (forbidden.length > 0)
    fail(`Tracked secret-bearing files are forbidden: ${forbidden.join(', ')}`);
  else pass('No .env or .dev.vars secret files are tracked.');
}

function checkPagesWorkflow() {
  const failureCountBefore = failures.length;
  const workflowPath = resolve(root, '.github', 'workflows', 'pages.yml');
  if (!existsSync(workflowPath)) {
    fail('GitHub Pages workflow is missing.');
    return;
  }
  const workflow = readText(workflowPath);
  const requirements = [
    ["cron: '40 6 * * 1-5'", '15:40 KST weekday schedule'],
    ['RELEASE_TARGET: pages-static', 'Pages-static release target'],
    ['PUBLIC_DATA_MODE: live', 'live data mode'],
    ["PUBLIC_API_BASE_URL: ''", 'empty runtime API URL'],
    ['run: pnpm data:generate:pages', 'official-data generation step'],
    ['run: pnpm release:check', 'Pages-static release gate'],
  ];
  for (const [needle, description] of requirements) {
    if (!workflow.includes(needle)) fail(`Pages workflow is missing the ${description}.`);
  }
  const secretReferences = workflow.match(/\$\{\{\s*secrets\.DATA_GO_KR_SERVICE_KEY\s*\}\}/gu);
  if (secretReferences?.length !== 1) {
    fail('Pages workflow must reference DATA_GO_KR_SERVICE_KEY exactly once.');
  } else if (
    !/Generate validated official market data[\s\S]*?env:[\s\S]*?DATA_GO_KR_SERVICE_KEY:/u.test(
      workflow,
    )
  ) {
    fail('The public-data key must be scoped to the generation step.');
  }

  if (failures.length === failureCountBefore) {
    pass('Pages workflow keeps one step-scoped Secret and runs at 15:40 KST on weekdays.');
  }
}

function runReleaseCheck() {
  console.log('Yangbok Eumbok production release check');
  checkReleaseEnvironment();
  checkAdConsentConfiguration();
  checkPreviewIndexingGate();
  checkPolicySources();
  checkTodoAndFixme();
  checkPagesWorkflow();
  if (pagesStaticRelease) pass('Worker/D1 release gates are not applicable to Pages-static.');
  else checkMigrations();
  checkTrackedSecretFiles();
  runProductionBuild();
  checkBuildArtifacts();

  console.log('\nLocal release gates');
  for (const message of passes) console.log(`[PASS] ${message}`);
  for (const message of failures) console.error(`[FAIL] ${message}`);

  console.log('\nExternal deployment prerequisites');
  if (externalBlockers.length === 0)
    console.log('[PASS] No unverified external prerequisites remain.');
  else for (const message of externalBlockers) console.warn(`[BLOCKED] ${message}`);

  if (failures.length > 0) {
    console.error(`\nRESULT: FAIL (${failures.length} local release gate(s) failed).`);
    console.error('Deployment was not attempted and must not be reported as complete.');
    process.exitCode = 1;
  } else if (externalBlockers.length > 0) {
    console.warn(
      `\nRESULT: LOCAL PASS / EXTERNAL BLOCKED (${externalBlockers.length} prerequisite(s) remain).`,
    );
    console.warn(
      'The command passed all local release gates. Deployment was not attempted and must not be reported as complete.',
    );
    process.exitCode = 2;
  } else {
    console.log(
      '\nRESULT: PASS. Production artifacts and deployment prerequisites are ready for deployment.',
    );
  }
}

const entryPoint = process.argv[1];
const isMain =
  entryPoint !== undefined && pathToFileURL(resolve(entryPoint)).href === import.meta.url;
if (isMain) runReleaseCheck();
