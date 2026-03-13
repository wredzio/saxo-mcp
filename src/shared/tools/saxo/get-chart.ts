import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import {
  INTERVAL_TO_HORIZON,
  VALID_INTERVALS,
  handleSaxoError,
  success,
  error,
  fmt,
  type Pagination,
} from './helpers.js';

export const getChartTool = defineTool({
  name: 'get_chart',
  title: 'Get Chart',
  description: `Get historical OHLC candle data for an instrument. Supports intervals from 1 minute to 1 month.

Available intervals: 1m, 5m, 10m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 1d, 1w, 1M.
Use for technical analysis, price history, and trend visualization.`,
  inputSchema: z.object({
    uic: z.number().int().describe('Instrument UIC'),
    asset_type: z.string().describe('Asset type, e.g. "Stock", "FxSpot"'),
    interval: z
      .enum(VALID_INTERVALS as [string, ...string[]])
      .default('1d')
      .describe('Candle interval: 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M'),
    count: z.number().int().min(1).max(1200).default(100).describe('Number of candles'),
    from: z.string().optional().describe('ISO 8601 start time — candles from this time forward'),
    to: z.string().optional().describe('ISO 8601 end time — candles up to this time'),
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },

  handler: async (args, context) => {
    try {
      const saxo = createSaxoClient();

      const horizon = INTERVAL_TO_HORIZON[args.interval];
      if (!horizon) {
        return error(
          `Invalid interval "${args.interval}".`,
          'INVALID_INTERVAL',
          [`Available intervals: ${VALID_INTERVALS.join(', ')}`],
        );
      }

      const params: Record<string, unknown> = {
        Uic: args.uic,
        AssetType: args.asset_type,
        Horizon: horizon,
        Count: args.count,
        FieldGroups: 'ChartInfo,Data,DisplayAndFormat',
      };

      if (args.from) {
        params.Mode = 'From';
        params.Time = args.from;
      } else if (args.to) {
        params.Mode = 'UpTo';
        params.Time = args.to;
      }

      const res = await saxo.get<{
        ChartInfo?: Record<string, unknown>;
        Data?: Record<string, unknown>[];
        DisplayAndFormat?: Record<string, unknown>;
      }>('/chart/v3/charts', params);

      const display = res.DisplayAndFormat ?? {};
      const rawCandles = res.Data ?? [];

      // Normalize candles — FX has bid/ask OHLC, stocks have simple OHLC
      const candles = rawCandles.map((c) => {
        const isFx = c.OpenBid !== undefined;
        return {
          time: c.Time,
          open: isFx
            ? avg(c.OpenBid as number, c.OpenAsk as number)
            : (c.Open as number),
          high: isFx
            ? avg(c.HighBid as number, c.HighAsk as number)
            : (c.High as number),
          low: isFx
            ? avg(c.LowBid as number, c.LowAsk as number)
            : (c.Low as number),
          close: isFx
            ? avg(c.CloseBid as number, c.CloseAsk as number)
            : (c.Close as number),
          volume: (c.Volume as number) ?? null,
        };
      });

      const pagination: Pagination = {
        total: candles.length,
        returned: candles.length,
        offset: 0,
        hasMore: candles.length >= args.count,
      };

      const hints: string[] = [];
      if (candles.length === 0) {
        hints.push(
          `No data for this instrument at ${args.interval} interval. Market may be closed. Try a larger interval like 1d.`,
        );
      } else {
        const highs = candles.map((c) => c.high);
        const lows = candles.map((c) => c.low);
        const rangeHigh = Math.max(...highs);
        const rangeLow = Math.min(...lows);
        hints.push(
          `${candles.length} ${args.interval} candles for ${display.Symbol ?? 'instrument'}. Range: ${fmt(rangeLow, (display.Decimals as number) ?? 2)}–${fmt(rangeHigh, (display.Decimals as number) ?? 2)}.`,
        );
        if (candles[0]?.volume === null) {
          hints.push("FX pairs don't have volume data — only stocks and futures do.");
        }
      }

      return success(
        `${candles.length} candles (${args.interval})`,
        {
          instrument: {
            uic: args.uic,
            symbol: display.Symbol,
            description: display.Description,
            assetType: args.asset_type,
          },
          interval: args.interval,
          candles,
        },
        hints,
        pagination,
      );
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});

function avg(a: number, b: number): number {
  return Math.round(((a + b) / 2) * 1e6) / 1e6;
}
