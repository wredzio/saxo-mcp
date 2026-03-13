import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import { fmt, fmtMoney, fmtPct, handleSaxoError, success, type Pagination } from './helpers.js';

export const myHistoryTool = defineTool({
  name: 'my_history',
  title: 'My History',
  description: `View your account history — transactions, trading performance, or account value over time.

Views:
- "transactions" (default): list of trades, fees, deposits
- "performance": aggregated P&L, win rate, best/worst trade
- "values": account value timeseries`,
  inputSchema: z.object({
    view: z
      .enum(['transactions', 'performance', 'values'])
      .default('transactions')
      .describe('What to show'),
    from: z.string().optional().describe('Start date (ISO 8601). Default: 30 days ago.'),
    to: z.string().optional().describe('End date (ISO 8601). Default: today.'),
    asset_type: z.string().optional().describe('Filter transactions by asset type'),
    limit: z.number().int().min(1).max(200).default(50).describe('Max items (transactions view)'),
    offset: z.number().int().min(0).default(0).describe('Skip N items'),
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },

  handler: async (args, context) => {
    try {
      const saxo = createSaxoClient();

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      const fromDate = args.from ?? thirtyDaysAgo.toISOString().split('T')[0];
      const toDate = args.to ?? now.toISOString().split('T')[0];

      switch (args.view) {
        case 'transactions':
          return await handleTransactions(saxo, args, fromDate, toDate);
        case 'performance':
          return await handlePerformance(saxo, fromDate, toDate);
        case 'values':
          return await handleValues(saxo, context);
        default:
          return handleTransactions(saxo, args, fromDate, toDate);
      }
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});

async function handleTransactions(
  saxo: ReturnType<typeof createSaxoClient>,
  args: { limit: number; offset: number; asset_type?: string },
  fromDate: string,
  toDate: string,
) {
  const params: Record<string, unknown> = {
    $top: args.limit,
    $skip: args.offset,
    FromDate: fromDate,
    ToDate: toDate,
  };
  if (args.asset_type) params.AssetTypes = args.asset_type;

  const res = await saxo.get<{
    Data?: Record<string, unknown>[];
    __count?: number;
  }>('/hist/v1/transactions', params);

  const items = res.Data ?? [];
  const total = res.__count ?? items.length;

  const transactions = items.map((t) => ({
    id: t.TransactionId ?? t.BookingId,
    type: t.TransactionType,
    instrument: {
      uic: t.Uic,
      symbol: t.Symbol ?? t.InstrumentDescription,
      assetType: t.AssetType,
    },
    side: t.TradeEventType ?? t.BuySell,
    amount: t.Amount,
    price: t.Price,
    totalValue: t.BookedAmount ?? t.Amount,
    commission: t.Commission,
    currency: t.Currency,
    bookedAt: t.BookingDate ?? t.ExecutionTime,
  }));

  const pagination: Pagination = {
    total,
    returned: transactions.length,
    offset: args.offset,
    hasMore: args.offset + transactions.length < total,
  };

  const hints: string[] = [];
  if (transactions.length === 0) {
    hints.push(
      `No transactions found between ${fromDate} and ${toDate}. Try extending the date range.`,
    );
  } else {
    hints.push(`${total} transaction(s) from ${fromDate} to ${toDate}.`);
  }

  return success(
    `${transactions.length} transaction(s)`,
    { transactions },
    hints,
    pagination,
  );
}

async function handlePerformance(
  saxo: ReturnType<typeof createSaxoClient>,
  fromDate: string,
  toDate: string,
) {
  // Need ClientKey for performance endpoint
  const clientRes = await saxo.get<{ ClientKey: string }>('/port/v1/clients/me');

  const res = await saxo.get<Record<string, unknown>>('/hist/v4/performance/summary', {
    ClientKey: clientRes.ClientKey,
    StandardPeriod: 'Month',
    FieldGroups: 'All',
  });

  const data = {
    performance: {
      period: { from: fromDate, to: toDate },
      totalReturn: res.TotalProfitLoss ?? res.AccountValueChange ?? 0,
      totalReturnPct: res.TotalProfitLossPercentage ?? 0,
      currency: res.Currency ?? '',
      tradesCount: res.NumberOfTrades ?? 0,
    },
  };

  const hints: string[] = [];
  const p = data.performance;
  if (p.tradesCount === 0) {
    hints.push('No trades in this period. Extend the date range or check a different period.');
  } else {
    hints.push(
      `Return: ${fmtPct(p.totalReturnPct as number)} (${fmt(p.totalReturn as number)}) over period. ${p.tradesCount} trades.`,
    );
  }

  return success(
    `Performance: ${fmtPct(p.totalReturnPct as number)}`,
    data,
    hints,
  );
}

async function handleValues(
  saxo: ReturnType<typeof createSaxoClient>,
  context: { provider?: { accessToken?: string } },
) {
  const clientRes = await saxo.get<{ ClientKey: string }>('/port/v1/clients/me');

  const res = await saxo.get<Record<string, unknown>>(
    `/hist/v3/accountvalues/${clientRes.ClientKey}`,
  );

  const data = {
    accountValues: res,
    currency: (res as Record<string, unknown>).Currency ?? '',
  };

  return success(
    'Account values retrieved',
    data,
    ['Use view: "performance" for P&L analysis or view: "transactions" for trade details.'],
  );
}
