import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import { fmt, fmtMoney, fmtPct, handleSaxoError, success, type Pagination } from './helpers.js';

const viewEnum = z.enum(['open', 'net', 'closed', 'exposure']).default('open');

export const myPortfolioTool = defineTool({
  name: 'my_portfolio',
  title: 'My Portfolio',
  description: `Shows your positions, net exposures, and closed trades. Use view parameter to switch:
- "open" (default): individual open positions with P&L
- "net": aggregated net positions
- "closed": recently closed positions
- "exposure": currency exposure breakdown`,
  inputSchema: z.object({
    view: viewEnum.describe('What to show: open, net, closed, or exposure'),
    asset_type: z.string().optional().describe('Filter by asset type, e.g. "Stock", "FxSpot"'),
    limit: z.number().int().min(1).max(200).default(50).describe('Max items to return'),
    offset: z.number().int().min(0).default(0).describe('Skip N items for pagination'),
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },

  handler: async (args, context) => {
    try {
      const saxo = createSaxoClient();
      const { view, asset_type, limit, offset } = args;

      if (view === 'exposure') {
        return await handleExposure(saxo);
      }

      const pathMap = {
        open: '/port/v1/positions/me',
        net: '/port/v1/netpositions/me',
        closed: '/port/v1/closedpositions/me',
      } as const;

      const params: Record<string, unknown> = {
        $top: limit,
        $skip: offset,
        $inlinecount: 'AllPages',
        FieldGroups: 'PositionBase,PositionView,DisplayAndFormat,ExchangeInfo',
      };
      if (asset_type) params.AssetType = asset_type;

      const res = await saxo.get<{
        Data?: Record<string, unknown>[];
        __count?: number;
      }>(pathMap[view as 'open' | 'net' | 'closed'], params);

      const items = res.Data ?? [];
      const total = res.__count ?? items.length;

      const positions = items.map((p) => {
        const base = (p.PositionBase ?? p.NetPositionBase ?? p.ClosedPosition ?? {}) as Record<string, unknown>;
        const display = (p.DisplayAndFormat ?? {}) as Record<string, unknown>;
        const pv = (p.PositionView ?? p.NetPositionView ?? p.ClosedPositionView ?? {}) as Record<string, unknown>;
        const exchange = (p.Exchange ?? {}) as Record<string, unknown>;

        return {
          positionId: p.PositionId ?? p.NetPositionId ?? p.ClosedPositionId,
          instrument: {
            uic: base.Uic,
            symbol: display.Symbol,
            description: display.Description,
            assetType: base.AssetType,
            currency: display.Currency,
          },
          amount: base.Amount,
          side: (base.Amount as number) >= 0 ? 'long' : 'short',
          openPrice: base.OpenPrice,
          currentPrice: pv.CurrentPrice ?? pv.MarketPrice,
          pnl: pv.ProfitLossOnTrade,
          pnlBase: pv.ProfitLossOnTradeInBaseCurrency,
          marketState: pv.MarketState ?? exchange.IsOpen === true ? 'Open' : 'Closed',
          canBeClosed: base.CanBeClosed,
          openedAt: base.ExecutionTimeOpen,
        };
      });

      const pagination: Pagination = {
        total,
        returned: positions.length,
        offset,
        hasMore: offset + positions.length < total,
      };

      const hints: string[] = [];
      if (positions.length === 0) {
        hints.push('Portfolio is empty. Use search_instrument to find opportunities.');
      } else {
        const totalPnl = positions.reduce(
          (sum, p) => sum + ((p.pnlBase as number) ?? 0),
          0,
        );
        hints.push(
          `${total} ${view} position(s), total P&L: ${fmt(totalPnl)} (base currency).`,
        );
      }
      if (pagination.hasMore) {
        hints.push(
          `Showing ${pagination.returned} of ${total}. Use offset: ${offset + limit} to see more.`,
        );
      }

      return success(
        `${view} positions: ${positions.length} item(s)`,
        { positions },
        hints,
        pagination,
      );
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});

async function handleExposure(saxo: ReturnType<typeof createSaxoClient>) {
  const res = await saxo.get<{ Data?: Record<string, unknown>[] }>(
    '/port/v1/exposure/currency/me',
  );

  const items = res.Data ?? [];
  const totalAmount = items.reduce(
    (s, e) => s + ((e.Amount as number) ?? 0),
    0,
  );

  const exposures = items.map((e) => ({
    currency: e.Currency,
    amount: e.Amount,
    pct: totalAmount > 0 ? Math.round(((e.Amount as number) / totalAmount) * 1000) / 10 : 0,
  }));

  const hints: string[] = [];
  if (exposures.length > 0) {
    const largest = exposures.reduce((a, b) => ((a.pct ?? 0) > (b.pct ?? 0) ? a : b));
    hints.push(`Largest exposure: ${largest.currency} at ${largest.pct}%.`);
  } else {
    hints.push('No currency exposure — portfolio is empty.');
  }

  return success(
    `Currency exposure: ${exposures.length} currencies`,
    { exposures },
    hints,
  );
}
