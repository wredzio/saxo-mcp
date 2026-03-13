/**
 * Saxo Bank OpenAPI client.
 * Thin wrapper over fetch that handles base URL, auth headers, and error parsing.
 */

import { createHttpClient, type HttpClient } from '../shared/services/http-client.js';

const SIM_BASE = 'https://gateway.saxobank.com/sim/openapi';
const PROD_BASE = 'https://gateway.saxobank.com/openapi';

export interface SaxoClientOptions {
  baseUrl?: string;
  accessToken: string;
}

export class SaxoApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`Saxo API ${status}: ${statusText}`);
    this.name = 'SaxoApiError';
  }
}

export class SaxoClient {
  private http: HttpClient;
  private baseUrl: string;

  constructor(options: SaxoClientOptions) {
    this.baseUrl = options.baseUrl ?? SIM_BASE;
    this.http = createHttpClient({
      baseHeaders: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      retries: 2,
      retryDelay: 500,
      rateLimit: { rps: 20, burst: 40 },
      concurrency: 10,
    });
  }

  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }
    const res = await this.http(url.toString());
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new SaxoApiError(res.status, res.statusText, body);
    }
    return (await res.json()) as T;
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await this.http(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new SaxoApiError(res.status, res.statusText, text);
    }
    return (await res.json()) as T;
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await this.http(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new SaxoApiError(res.status, res.statusText, text);
    }
    // PATCH may return 204 No Content
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      return (await res.json()) as T;
    }
    return {} as T;
  }

  async delete<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }
    const res = await this.http(url.toString(), { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new SaxoApiError(res.status, res.statusText, text);
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      return (await res.json()) as T;
    }
    return {} as T;
  }
}

/**
 * Create a SaxoClient from environment variables.
 * Requires SAXO_TOKEN. SAXO_ENV defaults to "sim".
 */
export function createSaxoClient(): SaxoClient {
  const token = process.env.SAXO_TOKEN;
  if (!token) {
    throw new Error('NO_AUTH');
  }
  const env = (process.env.SAXO_ENV ?? 'sim') as 'sim' | 'live';
  const baseUrl = env === 'live' ? PROD_BASE : SIM_BASE;
  return new SaxoClient({ baseUrl, accessToken: token });
}
