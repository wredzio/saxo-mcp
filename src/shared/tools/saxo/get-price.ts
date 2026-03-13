import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import { fmt, fmtPct, handleSaxoError, success, error } from './helpers.js';

export const getPriceTool = defineTool({
  name: 'get_price',
  title: 'Get Price',
  description: `Get current live prices (bid, ask, spread, daily change) for one or more instruments. For historical candles use get_chart instead.

Provide either uic (single instrument) or uics (batch, max 25).`,
  inputSchema: z
    .object({
      uic: z.number().int().optional().describe('Instrument UIC (single)'),
      uics: z
        .array(z.number().int())
        .max(25)
        .optional()
        .describe('Multiple UICs (batch, max 25)'),
      asset_type: z.string().describe('Asset type, e.g. "Stock", "FxSpot"'),
    })
    .refine((d) => d.uic !== undefined || (d.uics && d.uics.length > 0), {
      message: 'Provide either uic or uics',
    }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },

  handler: async (args, context) => {
    try {
      const saxo = createSaxoClient();
      const fieldGroups = 'DisplayAndFormat,InstrumentPriceDetails,MarketDepth,PriceInfo,PriceInfoDetails,Quote';

      let rawPrices: Record<string, unknown>[];

      if (args.uics && args.uics.length > 0) {
        // Batch
        const res = await saxo.get<{ Data?: Record<string, unknown>[] }>(
          '/trade/v1/infoprices/list',
          {
            Uics: args.uics.join(','),
            AssetType: args.asset_type,
            FieldGroups: fieldGroups,
          },
        );
        rawPrices = res.Data ?? [];
      } else if (args.uic !== undefined) {
        // Single
        const res = await saxo.get<Record<string, unknown>>('/trade/v1/infoprices', {
          Uic: args.uic,
          AssetType: args.asset_type,
          FieldGroups: fieldGroups,
        });
        rawPrices = [res];
      } else {
        return error('Provide either uic or uics.', 'INVALID_INPUT', [
          'Use uic for a single instrument or uics for batch (max 25).',
        ]);
      }

      const prices = rawPrices.map((p) => {
        const display = (p.DisplayAndFormat ?? {}) as Record<string, unknown>;
        const quote = (p.Quote ?? {}) as Record<string, unknown>;
        const info = (p.PriceInfo ?? {}) as Record<string, unknown>;
        const details = (p.PriceInfoDetails ?? {}) as Record<string, unknown>;
        const instDetails = (p.InstrumentPriceDetails ?? {}) as Record<string, unknown>;

        return {
          uic: p.Uic,
          symbol: display.Symbol,
          description: display.Description,
          assetType: p.AssetType,
          bid: quote.Bid,
          ask: quote.Ask,
          mid: quote.Mid,
          spread: (quote.Ask as number) && (quote.Bid as number)
            ? Math.round(((quote.Ask as number) - (quote.Bid as number)) * 1e6) / 1e6
            : null,
          high: info.High,
          low: info.Low,
          netChange: info.NetChange,
          pctChange: info.PercentChange,
          lastClose: details.LastClose,
          marketState: quote.MarketState ?? (instDetails.IsMarketOpen ? 'Open' : 'Closed'),
          isDelayed: (quote.DelayedByMinutes as number) > 0,
          updatedAt: p.LastUpdated,
        };
      });

      const hints: string[] = [];
      if (prices.length === 1) {
        const p = prices[0];
        const changeStr = p.pctChange != null ? ` ${fmtPct(p.pctChange as number)} today` : '';
        hints.push(`${p.symbol}: ${p.bid}/${p.ask}${changeStr}.`);
        if (p.marketState === 'Closed') {
          hints.push('Market is closed. Price may be stale.');
        }
        if (p.isDelayed) {
          hints.push('Price is delayed (not real-time).');
        }
      } else {
        const summary = prices
          .slice(0, 5)
          .map((p) => `${p.symbol} ${fmtPct((p.pctChange as number) ?? 0)}`)
          .join(', ');
        hints.push(`${prices.length} prices: ${summary}${prices.length > 5 ? '...' : ''}`);
      }
      hints.push('Use get_chart for historical data.');

      return success(
        `${prices.length} price(s) returned`,
        { prices },
        hints,
      );
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});
