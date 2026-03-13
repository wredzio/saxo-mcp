import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import { handleSaxoError, success, type Pagination } from './helpers.js';

export const searchInstrumentTool = defineTool({
  name: 'search_instrument',
  title: 'Search Instrument',
  description: `Search for instruments by keyword, symbol, or asset type. Returns matching instruments with UIC codes, exchanges, and tradability. Use the returned uic and assetType in other tools (get_price, get_chart, trade).

Set details: true for a single instrument deep-dive with trading conditions, schedule, tick size, and commission info.`,
  inputSchema: z.object({
    query: z.string().min(1).describe('Search keyword, e.g. "Apple", "AAPL", "EURUSD"'),
    asset_type: z
      .string()
      .optional()
      .describe('Filter: "Stock", "FxSpot", "CfdOnStock", "Etf", etc.'),
    exchange: z.string().optional().describe('Filter by exchange ID, e.g. "NASDAQ", "WSE"'),
    limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
    details: z
      .boolean()
      .default(false)
      .describe('Include full details (trading conditions, schedule, tick size). Slower.'),
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },

  handler: async (args, context) => {
    try {
      const saxo = createSaxoClient();

      // Step 1: Search
      const searchParams: Record<string, unknown> = {
        Keywords: args.query,
        $top: args.limit,
        IncludeNonTradable: false,
      };
      if (args.asset_type) searchParams.AssetTypes = args.asset_type;
      if (args.exchange) searchParams.ExchangeId = args.exchange;

      const searchRes = await saxo.get<{
        Data?: Record<string, unknown>[];
        __count?: number;
      }>('/ref/v1/instruments', searchParams);

      const items = searchRes.Data ?? [];
      const total = searchRes.__count ?? items.length;

      if (items.length === 0) {
        return success(
          `No instruments found for "${args.query}".`,
          { instruments: [] },
          [
            `No instruments found for "${args.query}". Try a different keyword or check spelling.`,
            args.asset_type
              ? `Remove asset_type filter to broaden search.`
              : 'Try narrowing with asset_type: "Stock" or "FxSpot".',
          ],
          { total: 0, returned: 0, offset: 0, hasMore: false },
        );
      }

      // Basic search results
      let instruments = items.map((i) => ({
        uic: i.Identifier,
        symbol: i.Symbol,
        description: i.Description,
        assetType: i.AssetType,
        currency: i.CurrencyCode,
        exchangeId: i.ExchangeId,
        isTradable: i.IsTradable !== false,
        country: i.IssuerCountry,
      }));

      // Step 2: If details requested and we have results, enrich first result
      if (args.details && instruments.length > 0) {
        const first = instruments[0];
        try {
          const [detailRes, conditionsRes] = await Promise.all([
            saxo.get<Record<string, unknown>>(
              `/ref/v1/instruments/details/${first.uic}/${first.assetType}`,
              { FieldGroups: 'OrderSetting,SupportedOrderTypeSettings,TradingSessions,TickSizeScheme' },
            ),
            saxo.get<Record<string, unknown>>(
              `/cs/v1/tradingconditions/instrument/${context.provider?.accessToken ? '' : 'me'}/${first.uic}/${first.assetType}`,
            ).catch(() => null), // trading conditions may fail without account key
          ]);

          const orderSettings = detailRes.SupportedOrderTypeSettings as
            | { OrderType: string; DurationTypes?: string[] }[]
            | undefined;
          const sessions = (detailRes.TradingSessions as Record<string, unknown>) ?? {};
          const tickScheme = (detailRes.TickSizeScheme as Record<string, unknown>) ?? {};

          instruments[0] = {
            ...first,
            minTradeSize: detailRes.MinimumTradeSize,
            tickSize: tickScheme.DefaultTickSize ?? detailRes.TickSize,
            orderTypes: (detailRes.SupportedOrderTypes as string[]) ?? [],
            durations: Object.fromEntries(
              (orderSettings ?? []).map((s) => [s.OrderType, s.DurationTypes ?? []]),
            ),
            tradingSchedule: {
              timeZone: sessions.TimeZoneAbbreviation ?? sessions.TimeZone,
              sessions: ((sessions.Sessions as Record<string, unknown>[]) ?? []).map(
                (s) => ({
                  state: s.State,
                  start: s.StartTime,
                  end: s.EndTime,
                }),
              ),
            },
            tradingConditions: conditionsRes
              ? {
                  commission: extractCommission(conditionsRes),
                  marginRequired: (conditionsRes.Rating as number) < 1.0,
                  currentSpread: conditionsRes.CurrentSpread,
                  rating: conditionsRes.Rating,
                }
              : null,
            relatedInstruments: (detailRes.RelatedInstruments as { Uic: number; AssetType: string }[])?.map(
              (r) => ({ uic: r.Uic, assetType: r.AssetType }),
            ) ?? [],
          } as any;
        } catch {
          // Continue with basic data if details fail
        }
      }

      const pagination: Pagination = {
        total,
        returned: instruments.length,
        offset: 0,
        hasMore: instruments.length < total,
      };

      const hints: string[] = [];
      hints.push(
        `Found ${total} result(s) for "${args.query}". Showing ${instruments.length}.`,
      );
      if (instruments.length > 1) {
        const exchanges = [...new Set(instruments.map((i) => `${i.exchangeId} (${i.currency})`))];
        if (exchanges.length > 1) {
          hints.push(`Available on: ${exchanges.join(', ')}. Use uic for the listing you want.`);
        }
      }
      if (!args.details && instruments.length > 0) {
        const first = instruments[0];
        hints.push(
          `Use search_instrument(query: "${args.query}", details: true, limit: 1) for full trading conditions.`,
        );
      }
      if (instruments.length > 0) {
        hints.push(
          `Use get_price(uic: ${instruments[0].uic}, asset_type: "${instruments[0].assetType}") for live quotes.`,
        );
      }

      return success(
        `${instruments.length} instrument(s) found for "${args.query}"`,
        { instruments },
        hints,
        pagination,
      );
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});

function extractCommission(conditions: Record<string, unknown>) {
  const limits = conditions.CommissionLimits as
    | { PerUnitRate?: number; MinCommission?: number; Currency?: string }[]
    | undefined;
  if (!limits || limits.length === 0) return null;
  const first = limits[0];
  return {
    perUnit: first.PerUnitRate,
    min: first.MinCommission,
    currency: first.Currency,
  };
}
