/**
 * Shared helpers for Saxo tools — response builders, error handling, common types.
 */

import { SaxoApiError } from '../../../services/saxo-client.js';
import type { ToolResult } from '../types.js';

// ─── Response builders ───────────────────────────────────────────────────────

export interface Pagination {
  total: number;
  returned: number;
  offset: number;
  hasMore: boolean;
}

export function success(
  summary: string,
  data: Record<string, unknown>,
  hints: string[],
  pagination?: Pagination,
): ToolResult {
  const structured: Record<string, unknown> = { data, hints };
  if (pagination) structured.pagination = pagination;
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: structured,
  };
}

export function error(
  message: string,
  errorCode: string,
  recoveryHints: string[],
): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
    structuredContent: { error: errorCode, message, recoveryHints },
  };
}

export function authError(): ToolResult {
  return error(
    'No SAXO_TOKEN configured.',
    'AUTH_REQUIRED',
    ['Set SAXO_TOKEN environment variable in your MCP client config (.mcp.json).'],
  );
}

/**
 * Wrap a Saxo API error into a user-friendly ToolResult.
 */
export function handleSaxoError(err: unknown): ToolResult {
  if (err instanceof SaxoApiError) {
    if (err.status === 401) {
      return error(
        'Saxo session expired or token invalid.',
        'AUTH_EXPIRED',
        ['Update SAXO_TOKEN in .mcp.json with a fresh token and restart.'],
      );
    }
    if (err.status === 403) {
      return error(
        'Insufficient permissions for this operation.',
        'FORBIDDEN',
        ['Check that the OAuth scopes include the required permissions.'],
      );
    }
    if (err.status === 404) {
      return error(
        'Resource not found.',
        'NOT_FOUND',
        ['Verify IDs (UIC, orderId, etc.) are correct. Use search_instrument to look up UICs.'],
      );
    }
    if (err.status === 429) {
      return error(
        'Rate limit exceeded. Try again shortly.',
        'RATE_LIMIT',
        ['Wait a few seconds and retry.'],
      );
    }
    return error(
      `Saxo API error: ${err.status} ${err.statusText}`,
      'API_ERROR',
      [`Raw error: ${typeof err.body === 'string' ? err.body.slice(0, 200) : JSON.stringify(err.body).slice(0, 200)}`],
    );
  }

  if (err instanceof Error && err.message === 'NO_AUTH') {
    return authError();
  }

  return error(
    `Unexpected error: ${(err as Error).message}`,
    'INTERNAL_ERROR',
    ['This may be a temporary issue. Try again.'],
  );
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function fmtMoney(amount: number, currency: string): string {
  return `${fmt(amount)} ${currency}`;
}

// ─── Interval mapping ────────────────────────────────────────────────────────

export const INTERVAL_TO_HORIZON: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '10m': 10,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  '6h': 360,
  '8h': 480,
  '1d': 1440,
  '1w': 10080,
  '1M': 43200,
};

export const VALID_INTERVALS = Object.keys(INTERVAL_TO_HORIZON);

// ─── Order type mapping ──────────────────────────────────────────────────────

export const ORDER_TYPE_MAP: Record<string, string> = {
  market: 'Market',
  limit: 'Limit',
  stop: 'StopIfTraded',
  stop_limit: 'StopLimit',
  trailing_stop: 'TrailingStopIfTraded',
};

export const DURATION_MAP: Record<string, string> = {
  day: 'DayOrder',
  gtc: 'GoodTillCancel',
  gtd: 'GoodTillDate',
};
