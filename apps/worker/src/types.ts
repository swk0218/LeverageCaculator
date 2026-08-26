import type {
  DataRange,
  MarketDataProvider,
  Product,
  ProductDataBundle,
  ProductMasterEntry,
  ProviderProductData,
} from '@yangbok/contracts';

export interface Env {
  DB: D1Database;
  DATA_MODE?: string;
  PUBLIC_DATA_MODE?: string;
  DATA_GO_KR_SERVICE_KEY?: string;
  PUBLIC_SITE_URL?: string;
  ALLOWED_ORIGINS?: string;
  BACKFILL_TOKEN?: string;
  UPSTREAM_TIMEOUT_MS?: string;
  UPSTREAM_MAX_RETRIES?: string;
}

export type CatalogScope = 'production' | 'fixture';

export interface CatalogMetadata {
  scope: CatalogScope;
  verificationStatus: 'verified' | 'fixture';
  verifiedAt?: string;
  evidenceUrl?: string;
}

export interface CachedProductData {
  product: Product;
  productSeries: ProductDataBundle['productSeries'];
  underlyingSeries: ProductDataBundle['underlyingSeries'];
  fetchedAt: string;
}

export interface LatestProductData {
  product: Product;
  latest: ProductDataBundle['latest']['product'];
}

export interface RepositoryHealth {
  database: 'ok' | 'unavailable';
  latestTradeDate: string | null;
}

export interface ReadRepository {
  health(scope: CatalogScope): Promise<RepositoryHealth>;
  listProducts(scope: CatalogScope): Promise<Product[]>;
  getLatestProductData(code: string, scope: CatalogScope): Promise<LatestProductData | null>;
  getCachedProductData(
    code: string,
    from: string,
    scope: CatalogScope,
  ): Promise<CachedProductData | null>;
}

export interface IngestionRepository extends ReadRepository {
  startSyncRun(id: string, source: string, startedAt: string): Promise<void>;
  finishSyncRun(
    id: string,
    result: {
      finishedAt: string;
      status: 'success' | 'empty' | 'failed';
      latestTradeDate: string | null;
      recordCount: number;
      errorSummary?: string;
    },
  ): Promise<void>;
  upsertProductData(
    entries: readonly { data: ProviderProductData; metadata: CatalogMetadata }[],
    fetchedAt: string,
  ): Promise<number>;
}

export interface IngestionTarget {
  product: Product;
  metadata: CatalogMetadata;
}

export interface AppDependencies {
  repository: ReadRepository;
  mode: 'fixture' | 'live';
  allowedOrigins: ReadonlySet<string>;
  now: () => Date;
  backfillToken?: string;
  runBackfill?: (range: DataRange) => Promise<SyncOutcome>;
}

export interface SyncOutcome {
  id: string;
  status: 'success' | 'empty';
  latestTradeDate: string | null;
  recordCount: number;
}

export interface RuntimeServices {
  repository: IngestionRepository;
  provider: MarketDataProvider;
  targets: readonly IngestionTarget[];
}

export type ProductionEntry = ProductMasterEntry;
