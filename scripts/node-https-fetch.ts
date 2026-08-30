import type { IncomingHttpHeaders } from 'node:http';
import { request as requestHttps } from 'node:https';

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

class NodeHttpsFetchError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'NodeHttpsFetchError';
  }
}

function requestUrl(input: string | URL | Request): URL {
  return new URL(input instanceof Request ? input.url : input);
}

function requestMethod(input: string | URL | Request, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

function requestHeaders(input: string | URL | Request, init?: RequestInit): Headers {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  if (!headers.has('user-agent')) headers.set('user-agent', 'YangbokEumbok-Pages/0.1');
  return headers;
}

function responseHeaders(source: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

/**
 * Minimal GET-only HTTPS transport for the Node-hosted static exporter.
 *
 * It deliberately avoids logging the URL because the service key is a query
 * parameter, enforces TLS, pins DNS lookup to IPv4 for the provider's A-only
 * host, and bounds the buffered response. Worker/browser code keeps using the
 * platform fetch implementation.
 */
export function nodeHttpsFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url = requestUrl(input);
  if (url.protocol !== 'https:') {
    return Promise.reject(new NodeHttpsFetchError('UPSTREAM_HTTPS_REQUIRED'));
  }
  if (requestMethod(input, init) !== 'GET') {
    return Promise.reject(new NodeHttpsFetchError('UPSTREAM_GET_REQUIRED'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new NodeHttpsFetchError('UPSTREAM_TRANSPORT_ERROR'));
    };

    const request = requestHttps(
      url,
      {
        method: 'GET',
        headers: Object.fromEntries(requestHeaders(input, init).entries()),
        family: 4,
        signal: init?.signal ?? undefined,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        let receivedBytes = 0;

        incoming.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          receivedBytes += buffer.length;
          if (receivedBytes > MAX_RESPONSE_BYTES) {
            incoming.destroy(new NodeHttpsFetchError('UPSTREAM_RESPONSE_TOO_LARGE'));
            return;
          }
          chunks.push(buffer);
        });
        incoming.once('error', fail);
        incoming.once('end', () => {
          if (settled) return;
          settled = true;
          resolve(
            new Response(Buffer.concat(chunks), {
              status: incoming.statusCode ?? 502,
              ...(incoming.statusMessage === undefined
                ? {}
                : { statusText: incoming.statusMessage }),
              headers: responseHeaders(incoming.headers),
            }),
          );
        });
      },
    );
    request.once('error', fail);
    request.end();
  });
}
