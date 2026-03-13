import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import { handleSaxoError, success, error } from './helpers.js';

export const priceAlertTool = defineTool({
  name: 'price_alert',
  title: 'Price Alert',
  description: `Manage price alerts — get notified when an instrument hits a target price.

Actions:
- "list": show existing alerts (filter by state: active, triggered, all)
- "create": create a new alert (requires uic, asset_type, target_price, direction)
- "delete": remove an alert (requires alert_id)`,
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'delete']).describe('What to do'),
    uic: z.number().int().optional().describe('Instrument UIC (create)'),
    asset_type: z.string().optional().describe('Asset type (create)'),
    target_price: z.number().optional().describe('Price to trigger alert (create)'),
    direction: z
      .enum(['above', 'below'])
      .optional()
      .describe('Trigger when price goes above or below target (create)'),
    alert_id: z.string().optional().describe('Alert ID (delete)'),
    state: z
      .enum(['active', 'triggered', 'all'])
      .default('active')
      .describe('Filter for list action'),
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  },

  handler: async (args, context) => {
    try {
      const saxo = createSaxoClient();

      switch (args.action) {
        case 'list':
          return await handleList(saxo, args.state);
        case 'create':
          return await handleCreate(saxo, args);
        case 'delete':
          return await handleDelete(saxo, args.alert_id);
        default:
          return error('Invalid action.', 'INVALID_ACTION', [
            'Valid actions: list, create, delete.',
          ]);
      }
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});

async function handleList(
  saxo: ReturnType<typeof createSaxoClient>,
  state: string,
) {
  const stateMap: Record<string, string> = {
    active: 'Enabled',
    triggered: 'RecentlyTriggered',
    all: 'All',
  };

  const res = await saxo.get<{
    Data?: Record<string, unknown>[];
    __count?: number;
  }>('/vas/v1/pricealerts/definitions', {
    State: stateMap[state] ?? 'Enabled',
    $inlinecount: 'AllPages',
  });

  const items = res.Data ?? [];

  const alerts = items.map((a) => ({
    alertId: String(a.AlertDefinitionId),
    instrument: {
      uic: a.Uic,
      assetType: a.AssetType,
    },
    targetPrice: a.TargetPrice ?? a.PriceTarget,
    direction: (a.Operator as string)?.includes('Greater') ? 'above' : 'below',
    state: a.State,
    createdAt: a.CreatedDateTime,
  }));

  const hints: string[] = [];
  if (alerts.length === 0) {
    hints.push("No alerts found. Use price_alert(action: 'create', ...) to set one up.");
  } else {
    hints.push(`${alerts.length} alert(s). Use price_alert(action: 'delete', alert_id: '<id>') to remove.`);
  }

  return success(
    `${alerts.length} alert(s)`,
    { alerts },
    hints,
  );
}

async function handleCreate(
  saxo: ReturnType<typeof createSaxoClient>,
  args: {
    uic?: number;
    asset_type?: string;
    target_price?: number;
    direction?: string;
  },
) {
  if (!args.uic || !args.asset_type || args.target_price == null || !args.direction) {
    return error(
      'Missing required parameters for create.',
      'MISSING_PARAMS',
      ['Provide: uic, asset_type, target_price, direction (above/below).'],
    );
  }

  const body = {
    Uic: args.uic,
    AssetType: args.asset_type,
    PriceTarget: args.target_price,
    Operator: args.direction === 'above' ? 'GreaterOrEqual' : 'LessOrEqual',
    IsRecurring: false,
  };

  const res = await saxo.post<Record<string, unknown>>(
    '/vas/v1/pricealerts/definitions',
    body,
  );

  return success(
    `Alert created (${args.direction} ${args.target_price})`,
    {
      action: 'create',
      alertId: String(res.AlertDefinitionId),
      instrument: { uic: args.uic, assetType: args.asset_type },
      targetPrice: args.target_price,
      direction: args.direction,
      state: 'Active',
    },
    [`Alert created. Use price_alert(action: 'list') to see all alerts.`],
  );
}

async function handleDelete(
  saxo: ReturnType<typeof createSaxoClient>,
  alertId?: string,
) {
  if (!alertId) {
    return error(
      'alert_id is required for delete.',
      'MISSING_ALERT_ID',
      ["Use price_alert(action: 'list') to find alert IDs."],
    );
  }

  await saxo.delete(`/vas/v1/pricealerts/definitions/${alertId}`);

  return success(
    `Alert ${alertId} deleted`,
    { action: 'delete', alertId, status: 'deleted' },
    [`Alert ${alertId} deleted.`],
  );
}
