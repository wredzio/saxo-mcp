import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import { fmt, handleSaxoError, success, type Pagination } from './helpers.js';

export const myOrdersTool = defineTool({
  name: 'my_orders',
  title: 'My Orders',
  description: `Lists your active (pending) orders — limits, stops, and other working orders. Shows order details including status, type, price, and amount. Use trade() to modify or cancel.`,
  inputSchema: z.object({
    status: z
      .enum(['all', 'working', 'filled', 'cancelled'])
      .default('working')
      .describe('Filter by status'),
    limit: z.number().int().min(1).max(200).default(50).describe('Max items'),
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

      const params: Record<string, unknown> = {
        $top: args.limit,
        $skip: args.offset,
        $inlinecount: 'AllPages',
        FieldGroups: 'DisplayAndFormat,ExchangeInfo',
      };
      if (args.status !== 'all') {
        params.Status = args.status === 'working' ? 'Working' : args.status;
      }

      const res = await saxo.get<{
        Data?: Record<string, unknown>[];
        __count?: number;
      }>('/port/v1/orders/me', params);

      const items = res.Data ?? [];
      const total = res.__count ?? items.length;

      const orders = items.map((o) => {
        const display = (o.DisplayAndFormat ?? {}) as Record<string, unknown>;
        return {
          orderId: String(o.OrderId),
          instrument: {
            uic: o.Uic,
            symbol: display.Symbol,
            description: display.Description,
            assetType: o.AssetType,
          },
          type: o.OrderType,
          side: o.BuySell,
          amount: o.Amount,
          filledAmount: o.FilledAmount,
          price: o.Price,
          duration: o.Duration?.DurationType ?? o.Duration,
          status: o.Status,
          accountId: o.AccountId,
          placedAt: o.CreationTime,
          relatedPositionId: o.RelatedPositionId ?? null,
        };
      });

      const pagination: Pagination = {
        total,
        returned: orders.length,
        offset: args.offset,
        hasMore: args.offset + orders.length < total,
      };

      const hints: string[] = [];
      if (orders.length === 0) {
        hints.push("No working orders found. Use trade(action: 'place') to create one.");
      } else {
        const summaries = orders.slice(0, 3).map(
          (o) => `${o.side} ${o.amount} ${o.instrument.symbol} ${o.type} @ ${o.price ?? 'market'}`,
        );
        hints.push(`${total} order(s): ${summaries.join('; ')}${total > 3 ? '...' : ''}`);
        hints.push(
          `Use trade(action: 'modify', order_id: '<id>') to change or trade(action: 'cancel', order_id: '<id>') to cancel.`,
        );
      }

      return success(
        `${args.status} orders: ${orders.length} item(s)`,
        { orders },
        hints,
        pagination,
      );
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});
