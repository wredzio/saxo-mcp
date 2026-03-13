import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import {
  ORDER_TYPE_MAP,
  DURATION_MAP,
  handleSaxoError,
  success,
  error,
  fmt,
} from './helpers.js';

export const tradeTool = defineTool({
  name: 'trade',
  title: 'Trade',
  description: `Place, modify, cancel, or pre-validate trading orders.

Actions:
- "precheck": Validate order and see costs/margin impact WITHOUT placing it. Always do this first.
- "place": Submit the order for execution.
- "modify": Change an existing order (requires order_id).
- "cancel": Cancel an existing order (requires order_id).

For precheck/place: provide uic, asset_type, side, amount, and optionally type/price/duration.
For modify/cancel: provide order_id.`,
  inputSchema: z.object({
    action: z
      .enum(['precheck', 'place', 'modify', 'cancel'])
      .describe('What to do'),
    uic: z.number().int().optional().describe('Instrument UIC (precheck/place)'),
    asset_type: z.string().optional().describe('Asset type (precheck/place)'),
    side: z.enum(['buy', 'sell']).optional().describe('Direction (precheck/place)'),
    amount: z.number().positive().optional().describe('Quantity (precheck/place)'),
    type: z
      .enum(['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'])
      .default('market')
      .describe('Order type'),
    price: z.number().optional().describe('Limit/stop price'),
    stop_loss: z.number().optional().describe('Stop-loss price'),
    take_profit: z.number().optional().describe('Take-profit price'),
    duration: z.enum(['day', 'gtc', 'gtd']).default('day').describe('Order duration'),
    gtd_date: z.string().optional().describe('Expiry date for gtd duration (ISO 8601)'),
    order_id: z.string().optional().describe('Order ID (modify/cancel)'),
    account_key: z.string().optional().describe('Account key, uses default if omitted'),
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },

  handler: async (args, context) => {
    try {
      const saxo = createSaxoClient();

      switch (args.action) {
        case 'precheck':
          return await handlePrecheck(saxo, args);
        case 'place':
          return await handlePlace(saxo, args);
        case 'modify':
          return await handleModify(saxo, args);
        case 'cancel':
          return await handleCancel(saxo, args);
        default:
          return error('Invalid action.', 'INVALID_ACTION', [
            'Valid actions: precheck, place, modify, cancel.',
          ]);
      }
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});

function buildOrderBody(args: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    Uic: args.uic,
    AssetType: args.asset_type,
    BuySell: (args.side as string) === 'buy' ? 'Buy' : 'Sell',
    Amount: args.amount,
    OrderType: ORDER_TYPE_MAP[(args.type as string) ?? 'market'] ?? 'Market',
    OrderDuration: {
      DurationType: DURATION_MAP[(args.duration as string) ?? 'day'] ?? 'DayOrder',
      ...(args.gtd_date ? { ExpirationDateTime: args.gtd_date } : {}),
    },
    ManualOrder: true,
  };

  if (args.price != null) body.OrderPrice = args.price;
  if (args.account_key) body.AccountKey = args.account_key;

  // Related orders (stop loss / take profit)
  const orders: Record<string, unknown>[] = [];
  if (args.stop_loss != null) {
    orders.push({
      OrderType: 'StopIfTraded',
      OrderPrice: args.stop_loss,
      BuySell: (args.side as string) === 'buy' ? 'Sell' : 'Buy',
      OrderDuration: { DurationType: 'GoodTillCancel' },
    });
  }
  if (args.take_profit != null) {
    orders.push({
      OrderType: 'Limit',
      OrderPrice: args.take_profit,
      BuySell: (args.side as string) === 'buy' ? 'Sell' : 'Buy',
      OrderDuration: { DurationType: 'GoodTillCancel' },
    });
  }
  if (orders.length > 0) body.Orders = orders;

  return body;
}

async function handlePrecheck(
  saxo: ReturnType<typeof createSaxoClient>,
  args: Record<string, unknown>,
) {
  const missing = validateOrderParams(args);
  if (missing) return missing;

  const body = buildOrderBody(args);
  const res = await saxo.post<Record<string, unknown>>('/trade/v2/orders/precheck', body);

  const estimate = (res.EstimatedCashRequired as Record<string, unknown>) ?? {};
  const preTradeMargin = (res.PreTradeMarginImpact as Record<string, unknown>) ?? {};

  const data = {
    action: 'precheck',
    status: res.ErrorInfo ? 'failed' : 'ok',
    instrument: { uic: args.uic, assetType: args.asset_type },
    order: {
      side: args.side,
      amount: args.amount,
      type: args.type,
      price: args.price,
      duration: args.duration,
    },
    estimate: {
      commission: estimate.Commission ?? 0,
      commissionCurrency: estimate.Currency,
      marginImpact: preTradeMargin.MarginUsed ?? 0,
      estimatedCashRequired: estimate.Value ?? estimate.Amount ?? 0,
      estimatedCashCurrency: estimate.Currency,
    },
    warnings: (res.PreCheckResult as string) === 'Ok' ? [] : [res.PreCheckResult],
    canProceed: !res.ErrorInfo,
  };

  const hints: string[] = [];
  if (data.canProceed) {
    hints.push(
      `Precheck passed. Use trade(action: 'place', ...) with the same parameters to submit.`,
    );
  } else {
    hints.push(`Precheck failed: ${JSON.stringify(res.ErrorInfo)}`);
  }

  return success(
    `Precheck: ${data.status}`,
    data,
    hints,
  );
}

async function handlePlace(
  saxo: ReturnType<typeof createSaxoClient>,
  args: Record<string, unknown>,
) {
  const missing = validateOrderParams(args);
  if (missing) return missing;

  const body = buildOrderBody(args);
  const res = await saxo.post<Record<string, unknown>>('/trade/v2/orders', body);

  const orderId = String(res.OrderId);
  const data = {
    action: 'place',
    status: 'placed',
    orderId,
    instrument: { uic: args.uic, assetType: args.asset_type },
    order: {
      side: args.side,
      amount: args.amount,
      type: args.type,
      price: args.price,
      duration: args.duration,
      status: 'Working',
    },
  };

  return success(
    `Order placed: ${args.side} ${args.amount} (ID: ${orderId})`,
    data,
    [
      `Order placed. ID: ${orderId}.`,
      `Use my_orders to track or trade(action: 'cancel', order_id: '${orderId}') to cancel.`,
    ],
  );
}

async function handleModify(
  saxo: ReturnType<typeof createSaxoClient>,
  args: Record<string, unknown>,
) {
  if (!args.order_id) {
    return error(
      'order_id is required for modify.',
      'MISSING_ORDER_ID',
      ['Use my_orders to find order IDs.'],
    );
  }

  const body: Record<string, unknown> = { OrderId: args.order_id };
  if (args.price != null) body.OrderPrice = args.price;
  if (args.amount != null) body.Amount = args.amount;
  if (args.duration) {
    body.OrderDuration = {
      DurationType: DURATION_MAP[args.duration as string] ?? 'DayOrder',
      ...(args.gtd_date ? { ExpirationDateTime: args.gtd_date } : {}),
    };
  }
  if (args.account_key) body.AccountKey = args.account_key;

  await saxo.patch('/trade/v2/orders', body);

  const changes: Record<string, unknown> = {};
  if (args.price != null) changes.price = args.price;
  if (args.amount != null) changes.amount = args.amount;

  return success(
    `Order ${args.order_id} modified`,
    {
      action: 'modify',
      status: 'modified',
      orderId: args.order_id,
      changes,
    },
    [`Order ${args.order_id} modified.`],
  );
}

async function handleCancel(
  saxo: ReturnType<typeof createSaxoClient>,
  args: Record<string, unknown>,
) {
  if (!args.order_id) {
    return error(
      'order_id is required for cancel.',
      'MISSING_ORDER_ID',
      ['Use my_orders to find order IDs.'],
    );
  }

  const params: Record<string, unknown> = {};
  if (args.account_key) params.AccountKey = args.account_key;

  await saxo.delete(`/trade/v2/orders/${args.order_id}`, params);

  return success(
    `Order ${args.order_id} cancelled`,
    {
      action: 'cancel',
      status: 'cancelled',
      orderId: args.order_id,
    },
    [`Order ${args.order_id} cancelled.`],
  );
}

function validateOrderParams(args: Record<string, unknown>) {
  const required = ['uic', 'asset_type', 'side', 'amount'] as const;
  const missing = required.filter((k) => args[k] == null);
  if (missing.length > 0) {
    return error(
      `Missing required parameters: ${missing.join(', ')}`,
      'MISSING_PARAMS',
      [`Provide: ${missing.join(', ')} for precheck/place actions.`],
    );
  }

  const orderType = (args.type as string) ?? 'market';
  if (['limit', 'stop', 'stop_limit'].includes(orderType) && args.price == null) {
    return error(
      `Price is required for ${orderType} orders.`,
      'MISSING_PRICE',
      [`Add price parameter for ${orderType} order type.`],
    );
  }

  return null;
}
