import {
  AnalysisDataQuerySchema,
  AnalysisDataResponseSchema,
  ApiErrorSchema,
  BackfillQuerySchema,
  HealthResponseSchema,
  LatestProductResponseSchema,
  ProductSchema,
  ProductsResponseSchema,
  assessStaleness,
} from '@yangbok/contracts';

import { buildCachedBundle } from './bundle';
import { dateInSeoul } from './time';
import type { AppDependencies, CatalogScope } from './types';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' } as const;
const PUBLIC_METHODS = 'GET, OPTIONS';
const ADMIN_METHODS = 'POST, OPTIONS';

function json(value: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, 'cache-control': cacheControl, vary: 'Origin' },
  });
}

function error(code: string, message: string, status: number): Response {
  return json(ApiErrorSchema.parse({ error: { code, message } }), status, 'no-store');
}

function withCors(
  response: Response,
  origin: string | null,
  allowedOrigins: ReadonlySet<string>,
): Response {
  if (origin === null || !allowedOrigins.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parseUniqueQuery(url: URL): Record<string, string> | null {
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(query, key)) return null;
    query[key] = value;
  }
  return query;
}

function hasBody(request: Request): boolean {
  const contentLength = request.headers.get('content-length');
  return contentLength !== null && contentLength !== '0';
}

function scopeForMode(mode: AppDependencies['mode']): CatalogScope {
  return mode === 'fixture' ? 'fixture' : 'production';
}

function isAuthorized(request: Request, token: string | undefined): boolean {
  return (
    token !== undefined &&
    token.length >= 16 &&
    request.headers.get('authorization') === `Bearer ${token}`
  );
}

function dateSpanDays(from: string, to: string): number {
  return Math.floor(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000,
  );
}

export function createApp(dependencies: AppDependencies): {
  fetch(request: Request): Promise<Response>;
} {
  return {
    async fetch(request: Request): Promise<Response> {
      const origin = request.headers.get('origin');
      if (origin !== null && !dependencies.allowedOrigins.has(origin)) {
        return error('ORIGIN_NOT_ALLOWED', '허용되지 않은 요청 출처입니다.', 403);
      }

      const url = new URL(request.url);
      const isAdmin = url.pathname === '/api/v1/admin/backfill';
      if (request.method === 'OPTIONS') {
        if (origin === null)
          return error('ORIGIN_REQUIRED', '사전 요청에는 Origin이 필요합니다.', 400);
        const response = new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-methods': isAdmin ? ADMIN_METHODS : PUBLIC_METHODS,
            'access-control-allow-headers': isAdmin ? 'Authorization' : 'Content-Type',
            'access-control-max-age': '600',
            'cache-control': 'no-store',
            vary: 'Origin',
          },
        });
        return withCors(response, origin, dependencies.allowedOrigins);
      }

      let response: Response;
      try {
        response = await handleRequest(request, url, dependencies);
      } catch {
        response = error('INTERNAL_ERROR', '요청을 처리하지 못했습니다.', 500);
      }
      return withCors(response, origin, dependencies.allowedOrigins);
    },
  };
}

async function handleRequest(
  request: Request,
  url: URL,
  dependencies: AppDependencies,
): Promise<Response> {
  const scope = scopeForMode(dependencies.mode);
  const generatedAt = dependencies.now().toISOString();
  const meta = { mode: dependencies.mode, generatedAt };

  if (url.pathname === '/api/v1/health') {
    if (request.method !== 'GET') return error('METHOD_NOT_ALLOWED', 'GET 요청만 허용됩니다.', 405);
    if (url.search !== '') return error('INVALID_QUERY', '지원하지 않는 쿼리입니다.', 400);
    const health = await dependencies.repository.health(scope);
    const checkedAt = dependencies.now();
    const stale =
      health.latestTradeDate === null ||
      assessStaleness(health.latestTradeDate, dateInSeoul(checkedAt)).isStale;
    return json(
      HealthResponseSchema.parse({
        status: health.database === 'ok' && !stale ? 'ok' : 'degraded',
        mode: dependencies.mode,
        database: health.database,
        latestTradeDate: health.latestTradeDate,
        stale,
        checkedAt: checkedAt.toISOString(),
      }),
      200,
      'no-store',
    );
  }

  if (url.pathname === '/api/v1/products') {
    if (request.method !== 'GET') return error('METHOD_NOT_ALLOWED', 'GET 요청만 허용됩니다.', 405);
    if (url.search !== '') return error('INVALID_QUERY', '지원하지 않는 쿼리입니다.', 400);
    return json(
      ProductsResponseSchema.parse({
        data: await dependencies.repository.listProducts(scope),
        meta,
      }),
      200,
      'public, max-age=300, stale-while-revalidate=3600',
    );
  }

  const latestMatch = /^\/api\/v1\/products\/([0-9A-Z]{6})\/latest$/.exec(url.pathname);
  if (latestMatch !== null) {
    if (request.method !== 'GET') return error('METHOD_NOT_ALLOWED', 'GET 요청만 허용됩니다.', 405);
    if (url.search !== '') return error('INVALID_QUERY', '지원하지 않는 쿼리입니다.', 400);
    const code = ProductSchema.shape.code.parse(latestMatch[1]);
    const data = await dependencies.repository.getLatestProductData(code, scope);
    if (data === null)
      return error('PRODUCT_OR_PRICE_NOT_FOUND', '상품 또는 가격 데이터를 찾을 수 없습니다.', 404);
    return json(
      LatestProductResponseSchema.parse({
        data: {
          ...data,
          stale: assessStaleness(data.latest.date, dateInSeoul(dependencies.now())),
        },
        meta,
      }),
      200,
      'public, max-age=60, stale-while-revalidate=600',
    );
  }

  if (url.pathname === '/api/v1/analysis-data') {
    if (request.method !== 'GET') return error('METHOD_NOT_ALLOWED', 'GET 요청만 허용됩니다.', 405);
    const rawQuery = parseUniqueQuery(url);
    const query = rawQuery === null ? null : AnalysisDataQuerySchema.safeParse(rawQuery);
    if (query === null || !query.success) {
      return error('INVALID_QUERY', 'productCode와 from만 올바른 형식으로 전달해야 합니다.', 400);
    }
    const cached = await dependencies.repository.getCachedProductData(
      query.data.productCode,
      query.data.from,
      scope,
    );
    if (cached === null) return error('PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.', 404);
    const bundle = buildCachedBundle(cached, dependencies.now());
    if (bundle === null)
      return error('PRICE_DATA_NOT_AVAILABLE', '요청 구간의 가격 데이터가 없습니다.', 404);
    return json(
      AnalysisDataResponseSchema.parse({ data: bundle, meta }),
      200,
      'public, max-age=300, stale-while-revalidate=3600',
    );
  }

  if (url.pathname === '/api/v1/admin/backfill') {
    if (request.method !== 'POST')
      return error('METHOD_NOT_ALLOWED', 'POST 요청만 허용됩니다.', 405);
    if (hasBody(request)) return error('BODY_NOT_ALLOWED', '이 요청은 본문을 받지 않습니다.', 400);
    if (!isAuthorized(request, dependencies.backfillToken)) {
      return error('UNAUTHORIZED', '관리자 인증이 필요합니다.', 401);
    }
    if (dependencies.runBackfill === undefined) {
      return error('BACKFILL_UNAVAILABLE', '백필 기능을 사용할 수 없습니다.', 503);
    }
    const rawQuery = parseUniqueQuery(url);
    const query = rawQuery === null ? null : BackfillQuerySchema.safeParse(rawQuery);
    if (query === null || !query.success || dateSpanDays(query.data.from, query.data.to) > 3_660) {
      return error('INVALID_QUERY', '유효한 from/to 범위를 전달해야 합니다.', 400);
    }
    const outcome = await dependencies.runBackfill(query.data);
    return json({ data: outcome, meta }, 202, 'no-store');
  }

  return error('NOT_FOUND', '요청한 경로를 찾을 수 없습니다.', 404);
}
