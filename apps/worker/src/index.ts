import { D1MarketRepository } from './repository';
import { createApp } from './app';
import { createRuntimeServices, dataMode, runIngestion } from './ingestion';
import { dateInSeoul, shiftDate } from './time';
import type { Env } from './types';

function allowedOrigins(env: Env): ReadonlySet<string> {
  return new Set(
    [env.PUBLIC_SITE_URL, ...(env.ALLOWED_ORIGINS?.split(',') ?? [])]
      .map((origin) => origin?.trim())
      .filter((origin): origin is string => origin !== undefined && origin !== ''),
  );
}

function appForEnv(env: Env, now: () => Date = () => new Date()) {
  return createApp({
    repository: new D1MarketRepository(env.DB),
    mode: dataMode(env),
    allowedOrigins: allowedOrigins(env),
    now,
    ...(env.BACKFILL_TOKEN === undefined ? {} : { backfillToken: env.BACKFILL_TOKEN }),
    runBackfill: async (range) => {
      const services = createRuntimeServices(env);
      return runIngestion(services.repository, services.provider, services.targets, range, now);
    },
  });
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return appForEnv(env).fetch(request);
  },

  scheduled(controller: ScheduledController, env: Env, context: ExecutionContext): void {
    const now = () => new Date(controller.scheduledTime);
    const to = dateInSeoul(now());
    const from = shiftDate(to, -9);
    const services = createRuntimeServices(env);
    context.waitUntil(
      runIngestion(services.repository, services.provider, services.targets, { from, to }, now),
    );
  },
};
