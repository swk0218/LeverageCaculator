const configuredBase = import.meta.env.BASE_URL || '/';

/**
 * Returns an internal URL that works both at the domain root and under the
 * GitHub Pages project path (`/LeverageCaculator/`).
 */
export function withSiteBase(path: string): string {
  const base = configuredBase === '/' ? '' : configuredBase.replace(/\/$/, '');
  const normalizedPath = path === '/' ? '/' : `/${path.replace(/^\/+/, '')}`;
  return `${base}${normalizedPath}`;
}

/** Strip the configured base path before comparing the current route. */
export function withoutSiteBase(pathname: string): string {
  const base = configuredBase === '/' ? '' : configuredBase.replace(/\/$/, '');
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  const withoutBase =
    !base || normalizedPath === base
      ? normalizedPath === base
        ? '/'
        : normalizedPath
      : normalizedPath.startsWith(`${base}/`)
        ? normalizedPath.slice(base.length)
        : normalizedPath;
  return withoutBase === '/' ? '/' : withoutBase.replace(/\/+$/u, '') || '/';
}
