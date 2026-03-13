import { z } from 'zod';
import { createSaxoClient } from '../../../services/saxo-client.js';
import { defineTool } from '../types.js';
import { fmt, fmtMoney, handleSaxoError, success } from './helpers.js';

export const myAccountTool = defineTool({
  name: 'my_account',
  title: 'My Account',
  description: `Returns your account overview — who you are, what accounts you have, your balances, and margin status. Start here to understand the trading context. No parameters needed.`,
  inputSchema: z.object({}),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },

  handler: async (_args, context) => {
    try {
      const saxo = createSaxoClient();

      const [clientRes, accountsRes, balanceRes] = await Promise.all([
        saxo.get<Record<string, unknown>>('/port/v1/clients/me'),
        saxo.get<{ Data: Record<string, unknown>[] }>('/port/v1/accounts/me'),
        saxo.get<Record<string, unknown>>('/port/v1/balances/me'),
      ]);

      const accounts = (accountsRes.Data ?? []).map((a) => ({
        accountId: a.AccountId,
        accountKey: a.AccountKey,
        currency: a.Currency,
        accountType: a.AccountType,
        isTrialAccount: a.IsTrialAccount ?? false,
        active: a.Active ?? true,
        isMarginTradingAllowed: a.IsMarginTradingAllowed ?? false,
      }));

      const data = {
        client: {
          clientId: clientRes.ClientId,
          clientKey: clientRes.ClientKey,
          name: clientRes.Name,
          defaultCurrency: clientRes.DefaultCurrency,
          isMarginTradingAllowed: clientRes.IsMarginTradingAllowed ?? false,
          positionNettingMethod: clientRes.PositionNettingMethod,
          legalAssetTypes: clientRes.LegalAssetTypes ?? [],
        },
        accounts,
        balance: {
          cashBalance: balanceRes.CashBalance ?? 0,
          totalValue: balanceRes.TotalValue ?? 0,
          currency: (balanceRes.Currency as string) ?? '',
          unrealizedPnL: balanceRes.UnrealizedPositionsValue ?? 0,
          openPositionsCount: balanceRes.OpenPositionsCount ?? 0,
          ordersCount: balanceRes.OrdersCount ?? 0,
          marginAvailable: balanceRes.MarginAvailableForTrading ?? 0,
          marginUsed: balanceRes.MarginUsedByCurrentPositions ?? 0,
          marginUtilizationPct: balanceRes.MarginUtilizationPct ?? 0,
        },
      };

      const cur = data.balance.currency;
      const hints: string[] = [];

      if (data.balance.openPositionsCount > 0) {
        hints.push(
          `You have ${data.balance.openPositionsCount} open position(s). Use my_portfolio to see details.`,
        );
      }
      if (accounts.some((a) => a.isTrialAccount)) {
        hints.push('Trial account — prices are real but trades are simulated.');
      }
      if (data.client.isMarginTradingAllowed) {
        hints.push(
          `Margin trading enabled. ${fmtMoney(data.balance.marginAvailable, cur)} available.`,
        );
      }
      if (data.balance.ordersCount === 0) {
        hints.push("No open orders. Use trade(action: 'place') to create one.");
      }

      return success(
        `Account: ${data.client.clientId}, Balance: ${fmtMoney(data.balance.totalValue, cur)} (cash: ${fmtMoney(data.balance.cashBalance, cur)})`,
        data,
        hints,
      );
    } catch (err) {
      return handleSaxoError(err);
    }
  },
});
