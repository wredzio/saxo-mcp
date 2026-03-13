# Saxo MCP — Tool Schemas Design

> Input/output contracts for 9 MCP tools. Each tool maps to a user intent, not an API endpoint.
> All outputs include `hints` (next-step guidance) and error responses include `recoveryHints`.

---

## Common Output Envelope

Every tool returns this structure. `structuredContent` varies per tool.

```typescript
// Success
{
  content: [{ type: "text", text: "Human-readable summary" }],
  structuredContent: {
    data: { ... },            // Tool-specific payload
    hints: string[],          // Dynamic guidance for the LLM
    pagination?: {            // Only for list responses
      total: number,
      returned: number,
      offset: number,
      hasMore: boolean,
    },
  },
}

// Error
{
  content: [{ type: "text", text: "Error description" }],
  isError: true,
  structuredContent: {
    error: string,            // Machine-readable error type
    message: string,          // Human-readable explanation
    recoveryHints: string[],  // What to do next
  },
}
```

---

## 1. `my_account`

**Description:** Returns your account overview — who you are, what accounts you have, your balances, and margin status. Start here to understand the trading context.

**Endpoints:** `GET /port/v1/clients/me` + `GET /port/v1/accounts/me` + `GET /port/v1/balances/me`

### Input

*No parameters — uses authenticated user context.*

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| — | — | — | — | No input needed |

### Output

```json
{
  "data": {
    "client": {
      "clientId": "20768936",
      "clientKey": "pLnap1BPrJGM7u1YHsgBsA==",
      "name": "Jan Kowalski",
      "defaultCurrency": "EUR",
      "isMarginTradingAllowed": true,
      "positionNettingMethod": "FIFO",
      "legalAssetTypes": ["FxSpot", "Stock", "CfdOnStock", "Etf", "Bond"]
    },
    "accounts": [
      {
        "accountId": "20768936",
        "accountKey": "pLnap1BPrJGM7u1YHsgBsA==",
        "currency": "EUR",
        "accountType": "Normal",
        "isTrialAccount": true,
        "active": true,
        "isMarginTradingAllowed": true
      }
    ],
    "balance": {
      "cashBalance": 760564.12,
      "totalValue": 988144.49,
      "currency": "EUR",
      "unrealizedPnL": 226897.62,
      "openPositionsCount": 3,
      "ordersCount": 0,
      "marginAvailable": 760564.12,
      "marginUsed": 0.0,
      "marginUtilizationPct": 0.0
    }
  },
  "hints": [
    "You have 3 open positions. Use my_portfolio to see details.",
    "Trial account — prices are real but trades are simulated.",
    "Margin trading enabled. 760,564 EUR available for new positions."
  ]
}
```

### Hints examples
- `"You have 3 open positions. Use my_portfolio to see details."`
- `"Trial account — prices are real but trades are simulated."`
- `"No open orders. Use trade(action: 'place') to create one."`

### Recovery hints examples
- `"Authentication failed. The user needs to re-authorize via OAuth."`
- `"Session expired. Initialize a new MCP session."`

### Edge cases
- OAuth token expired → return auth error with recovery hint
- Multiple accounts → list all, mark default
- Zero balance → still return full structure, hint about funding

---

## 2. `my_portfolio`

**Description:** Shows your positions, net exposures, and closed trades. Use `view` to switch between open positions, net aggregated positions, recently closed positions, or currency exposure breakdown.

**Endpoints:** `GET /port/v1/positions/me` · `GET /port/v1/netpositions/me` · `GET /port/v1/closedpositions/me` · `GET /port/v1/exposure/currency/me`

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `view` | `"open" \| "net" \| "closed" \| "exposure"` | No | `"open"` | What to show |
| `asset_type` | `string` | No | — | Filter by asset type (e.g. `"Stock"`, `"FxSpot"`) |
| `limit` | `number` | No | `50` | Max items to return |
| `offset` | `number` | No | `0` | Skip N items (pagination) |

### Output (view: "open")

```json
{
  "data": {
    "positions": [
      {
        "positionId": "5025735079",
        "netPositionId": "56214__Share",
        "instrument": {
          "uic": 56214,
          "symbol": "ENA:xwar",
          "description": "Enea SA",
          "assetType": "Stock",
          "currency": "PLN"
        },
        "amount": 11541.0,
        "side": "long",
        "openPrice": 23.12,
        "currentPrice": 21.50,
        "pnl": -24697.74,
        "pnlBase": -5815.08,
        "pnlPct": -7.0,
        "marketState": "Closed",
        "canBeClosed": true,
        "openedAt": "2026-03-10T08:29:15Z"
      }
    ]
  },
  "pagination": {
    "total": 3,
    "returned": 3,
    "offset": 0,
    "hasMore": false
  },
  "hints": [
    "3 open positions, total unrealized P&L: -5,815 EUR.",
    "ENA:xwar market is closed. Warsaw Stock Exchange opens at 09:00 CET.",
    "Use get_price(uic: 56214) for live quotes when market opens."
  ]
}
```

### Output (view: "exposure")

```json
{
  "data": {
    "exposures": [
      { "currency": "PLN", "amount": 248194.32, "pct": 25.1 },
      { "currency": "USD", "amount": 512340.00, "pct": 51.8 },
      { "currency": "EUR", "amount": 227610.17, "pct": 23.1 }
    ],
    "baseCurrency": "EUR"
  },
  "hints": [
    "Largest exposure: USD at 51.8%. Consider hedging if unintended.",
    "PLN exposure comes from ENA:xwar position."
  ]
}
```

### Recovery hints examples
- `"No closed positions in default period. Try view: 'open' or extend date range."`
- `"Asset type 'Crypto' not found. Available: Stock, FxSpot, CfdOnStock, Etf, Bond."`

### Edge cases
- No positions → empty array + hint "Portfolio is empty. Use search_instrument to find opportunities."
- Market closed → `currentPrice` may be stale, include `marketState` and `currentPriceDelayMinutes`
- Multi-currency positions → P&L in both instrument currency and base currency

---

## 3. `my_orders`

**Description:** Lists your active (pending) orders — limits, stops, and other working orders. Shows order details including status, type, and related positions.

**Endpoints:** `GET /port/v1/orders/me` · `GET /cs/v1/audit/orderactivities` (for history)

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `status` | `"all" \| "working" \| "filled" \| "cancelled"` | No | `"working"` | Filter by status |
| `limit` | `number` | No | `50` | Max items |
| `offset` | `number` | No | `0` | Skip N items |

### Output

```json
{
  "data": {
    "orders": [
      {
        "orderId": "12345678",
        "instrument": {
          "uic": 211,
          "symbol": "AAPL:xnas",
          "description": "Apple Inc.",
          "assetType": "Stock"
        },
        "type": "Limit",
        "side": "Buy",
        "amount": 100,
        "price": 185.00,
        "duration": "GoodTillCancel",
        "status": "Working",
        "accountId": "20768936",
        "placedAt": "2026-03-12T14:30:00Z",
        "relatedPositionId": null
      }
    ]
  },
  "pagination": {
    "total": 1,
    "returned": 1,
    "offset": 0,
    "hasMore": false
  },
  "hints": [
    "1 working order: Buy 100 AAPL at limit 185.00 USD.",
    "AAPL last price 192.34 — your limit is 3.8% below market.",
    "Use trade(action: 'modify', orderId: '12345678') to change or trade(action: 'cancel', orderId: '12345678') to cancel."
  ]
}
```

### Recovery hints examples
- `"No working orders found. Use trade(action: 'place') to create one."`
- `"Order ID '99999' not found. Use my_orders to list current orders."`

### Edge cases
- No orders → empty array + hint
- Order partially filled → show `filledAmount` vs `amount`
- Order rejected → include `rejectionReason`

---

## 4. `search_instrument`

**Description:** Search for instruments by keyword, symbol, or asset type. Returns matching instruments with trading details — UIC codes, exchanges, trading hours, tick sizes, and available order types. Use the returned `uic` and `assetType` in other tools.

**Endpoints:** `GET /ref/v1/instruments` · `GET /ref/v1/instruments/details/{Uic}/{AssetType}` · `GET /ref/v1/instruments/tradingschedule/{Uic}/{AssetType}` · `GET /cs/v1/tradingconditions/instrument/...`

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | `string` | Yes | — | Search keyword (e.g. `"Apple"`, `"AAPL"`, `"EURUSD"`) |
| `asset_type` | `string` | No | — | Filter: `"Stock"`, `"FxSpot"`, `"CfdOnStock"`, `"Etf"`, etc. |
| `exchange` | `string` | No | — | Filter by exchange ID (e.g. `"NASDAQ"`, `"WSE"`) |
| `limit` | `number` | No | `10` | Max results |
| `details` | `boolean` | No | `false` | Include full details (trading conditions, schedule, tick size). Slower — use for single instrument deep-dive. |

### Output (details: false — search mode)

```json
{
  "data": {
    "instruments": [
      {
        "uic": 211,
        "symbol": "AAPL:xnas",
        "description": "Apple Inc.",
        "assetType": "Stock",
        "currency": "USD",
        "exchangeId": "NASDAQ",
        "isTradable": true,
        "country": "US"
      },
      {
        "uic": 70693,
        "symbol": "AAPL:xmil",
        "description": "Apple Inc.",
        "assetType": "Stock",
        "currency": "EUR",
        "exchangeId": "MIL",
        "isTradable": true,
        "country": "US"
      }
    ]
  },
  "pagination": {
    "total": 5,
    "returned": 2,
    "offset": 0,
    "hasMore": true
  },
  "hints": [
    "Found 5 results for 'AAPL'. Showing top 2.",
    "AAPL trades on NASDAQ (USD) and Milan (EUR). Use uic: 211 for the primary US listing.",
    "Use search_instrument(query: 'AAPL', details: true, limit: 1) for full trading conditions."
  ]
}
```

### Output (details: true — single instrument deep-dive)

```json
{
  "data": {
    "instruments": [
      {
        "uic": 211,
        "symbol": "AAPL:xnas",
        "description": "Apple Inc.",
        "assetType": "Stock",
        "currency": "USD",
        "exchangeId": "NASDAQ",
        "isTradable": true,
        "country": "US",
        "minTradeSize": 1.0,
        "tickSize": 0.01,
        "orderTypes": ["Market", "Limit", "StopIfTraded", "StopLimit", "TrailingStopIfTraded"],
        "durations": {
          "Market": ["DayOrder"],
          "Limit": ["GoodTillCancel", "DayOrder", "GoodTillDate"],
          "StopIfTraded": ["GoodTillCancel", "DayOrder", "GoodTillDate"]
        },
        "tradingSchedule": {
          "timeZone": "America/New_York",
          "sessions": [
            { "state": "PreMarket", "start": "07:00", "end": "09:30" },
            { "state": "Open", "start": "09:30", "end": "16:00" },
            { "state": "PostMarket", "start": "16:00", "end": "20:00" }
          ]
        },
        "tradingConditions": {
          "commission": { "perUnit": 0.02, "min": 15.00, "currency": "USD" },
          "marginRequired": false,
          "currentSpread": 0.01,
          "rating": 1.0
        },
        "relatedInstruments": [
          { "uic": 211, "assetType": "CfdOnStock" }
        ]
      }
    ]
  },
  "hints": [
    "AAPL trades 09:30–16:00 ET. Extended hours available (pre-market 07:00, post-market 20:00).",
    "Commission: $0.02/share, min $15. For 100 shares: $15.00.",
    "Use get_price(uic: 211) for live bid/ask or get_chart(uic: 211, interval: '1d') for history."
  ]
}
```

### Recovery hints examples
- `"No instruments found for 'XYZABC'. Try a different keyword or check spelling."`
- `"Asset type 'Crypto' is not available on Saxo. Available types: Stock, FxSpot, CfdOnStock, Etf, Bond, ContractFutures."`
- `"Exchange 'NYSE' returned 0 results for this query. Try without exchange filter."`

### Edge cases
- Ambiguous query (e.g. "Apple") → multiple results, hint to narrow with `asset_type` or `exchange`
- Non-tradable instrument → include `isTradable: false` + hint why
- Multiple listings same stock → flag primary listing

---

## 5. `get_price`

**Description:** Get current live prices (bid, ask, spread, daily change) for one or more instruments. For historical candles use `get_chart` instead.

**Endpoints:** `GET /trade/v1/infoprices` (single) · `GET /trade/v1/infoprices/list` (batch)

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `uic` | `number` | Yes* | — | Instrument UIC (single). *Either `uic` or `uics` required. |
| `uics` | `number[]` | Yes* | — | Multiple UICs (batch, max 25). *Either `uic` or `uics` required. |
| `asset_type` | `string` | Yes | — | Asset type (e.g. `"Stock"`, `"FxSpot"`) |

### Output (single)

```json
{
  "data": {
    "prices": [
      {
        "uic": 21,
        "symbol": "EURUSD",
        "description": "Euro/US Dollar",
        "assetType": "FxSpot",
        "bid": 1.14745,
        "ask": 1.14765,
        "mid": 1.14755,
        "spread": 0.0002,
        "high": 1.15287,
        "low": 1.14749,
        "netChange": -0.00348,
        "pctChange": -0.3,
        "lastClose": 1.15103,
        "marketState": "Open",
        "isDelayed": false,
        "updatedAt": "2026-03-13T07:16:01Z"
      }
    ]
  },
  "hints": [
    "EURUSD is down 0.3% today. Currently 1.14745/1.14765, spread 2 pips.",
    "Market is open. Prices are real-time (not delayed)."
  ]
}
```

### Output (batch — uics)

```json
{
  "data": {
    "prices": [
      {
        "uic": 211,
        "symbol": "AAPL:xnas",
        "assetType": "Stock",
        "bid": 192.30,
        "ask": 192.34,
        "mid": 192.32,
        "netChange": 1.45,
        "pctChange": 0.76,
        "marketState": "Open"
      },
      {
        "uic": 1311,
        "symbol": "MSFT:xnas",
        "assetType": "Stock",
        "bid": 415.10,
        "ask": 415.20,
        "mid": 415.15,
        "netChange": -2.30,
        "pctChange": -0.55,
        "marketState": "Open"
      }
    ]
  },
  "hints": [
    "2 of 2 prices returned. AAPL +0.76%, MSFT -0.55%.",
    "Both markets open. Use get_chart for historical data."
  ]
}
```

### Recovery hints examples
- `"UIC 99999 not found. Use search_instrument to find the correct UIC."`
- `"AssetType mismatch: UIC 21 is FxSpot, not Stock. Use asset_type: 'FxSpot'."`
- `"Too many UICs (32). Maximum is 25 per request. Split into two calls."`

### Edge cases
- Market closed → return last known price with `marketState: "Closed"` and delay info
- Instrument not tradable → still return price, flag in hints
- FX vs Stock price shape differs (bid/ask size, depth) → normalize to same structure

---

## 6. `get_chart`

**Description:** Get historical OHLC candle data for an instrument. Supports intervals from 1 minute to 1 month. Use this for technical analysis, price history, and trend visualization.

**Endpoints:** `GET /chart/v3/charts`

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `uic` | `number` | Yes | — | Instrument UIC |
| `asset_type` | `string` | Yes | — | Asset type |
| `interval` | `"1m" \| "5m" \| "10m" \| "15m" \| "30m" \| "1h" \| "2h" \| "4h" \| "6h" \| "8h" \| "1d" \| "1w" \| "1M"` | No | `"1d"` | Candle interval |
| `count` | `number` | No | `100` | Number of candles (max ~1200) |
| `from` | `string` | No | — | ISO 8601 start time. If set, returns candles from this time forward. |
| `to` | `string` | No | — | ISO 8601 end time. If set, returns candles up to this time. |

**Interval mapping to Saxo `Horizon` (minutes):**

| Param value | Horizon |
|-------------|---------|
| `1m` | 1 |
| `5m` | 5 |
| `10m` | 10 |
| `15m` | 15 |
| `30m` | 30 |
| `1h` | 60 |
| `2h` | 120 |
| `4h` | 240 |
| `6h` | 360 |
| `8h` | 480 |
| `1d` | 1440 |
| `1w` | 10080 |
| `1M` | 43200 |

### Output

```json
{
  "data": {
    "instrument": {
      "uic": 21,
      "symbol": "EURUSD",
      "description": "Euro/US Dollar",
      "assetType": "FxSpot"
    },
    "interval": "1d",
    "candles": [
      {
        "time": "2026-03-11T00:00:00Z",
        "open": 1.16076,
        "high": 1.16446,
        "low": 1.15599,
        "close": 1.15660,
        "volume": null
      },
      {
        "time": "2026-03-12T00:00:00Z",
        "open": 1.15680,
        "high": 1.15800,
        "low": 1.14900,
        "close": 1.15103,
        "volume": null
      }
    ]
  },
  "pagination": {
    "total": 2,
    "returned": 2,
    "offset": 0,
    "hasMore": false
  },
  "hints": [
    "2 daily candles for EURUSD. Range: 1.149–1.164.",
    "FX pairs don't have volume data — only stocks and futures do.",
    "Use interval: '1m' for intraday or '1w' for weekly candles."
  ]
}
```

### Recovery hints examples
- `"Invalid interval '2h'. Available intervals: 1m, 5m, 10m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 1d, 1w, 1M."`
- `"No data for UIC 56214 at 1m interval — market is closed. Try 1d interval for daily history."`
- `"Count 5000 exceeds maximum (~1200). Reduce count or use pagination with from/to."`

### Edge cases
- FX instruments → bid/ask OHLC (use mid as normalized open/high/low/close)
- Stocks → standard OHLC + volume
- Market closed / no data for interval → empty candles array + hint
- `volume` is `null` for FX, present for stocks/futures

---

## 7. `trade`

**Description:** Place, modify, cancel, or pre-validate trading orders. Always use `precheck` first to see costs and margin impact before placing. Requires explicit `orderId` for modify/cancel — no guessing.

**Endpoints:** `POST /trade/v2/orders` · `PATCH /trade/v2/orders` · `DELETE /trade/v2/orders/{OrderIds}` · `POST /trade/v2/orders/precheck`

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"precheck" \| "place" \| "modify" \| "cancel"` | Yes | — | What to do |
| `uic` | `number` | Yes (precheck, place) | — | Instrument UIC |
| `asset_type` | `string` | Yes (precheck, place) | — | Asset type |
| `side` | `"buy" \| "sell"` | Yes (precheck, place) | — | Direction |
| `amount` | `number` | Yes (precheck, place) | — | Quantity (shares, lots, units) |
| `type` | `"market" \| "limit" \| "stop" \| "stop_limit" \| "trailing_stop"` | No | `"market"` | Order type |
| `price` | `number` | No | — | Limit/stop price. Required for `limit`, `stop`, `stop_limit`. |
| `stop_loss` | `number` | No | — | Stop-loss price (creates related order) |
| `take_profit` | `number` | No | — | Take-profit price (creates related order) |
| `duration` | `"day" \| "gtc" \| "gtd"` | No | `"day"` | Order duration. `gtc` = good till cancel, `gtd` = good till date. |
| `gtd_date` | `string` | No | — | Expiry date for `gtd` duration. ISO 8601. |
| `order_id` | `string` | Yes (modify, cancel) | — | Order ID to modify or cancel |
| `account_key` | `string` | No | — | Account key. Uses default if omitted. |

### Output (action: "precheck")

```json
{
  "data": {
    "action": "precheck",
    "status": "ok",
    "instrument": {
      "uic": 211,
      "symbol": "AAPL:xnas",
      "assetType": "Stock"
    },
    "order": {
      "side": "buy",
      "amount": 100,
      "type": "limit",
      "price": 190.00,
      "duration": "gtc"
    },
    "estimate": {
      "commission": 15.00,
      "commissionCurrency": "USD",
      "marginImpact": 0.0,
      "estimatedCashRequired": 19015.00,
      "estimatedCashCurrency": "USD",
      "conversionRate": 0.87
    },
    "warnings": [],
    "canProceed": true
  },
  "hints": [
    "Precheck passed. Estimated cost: $19,015 (100 × $190 + $15 commission).",
    "No margin required — this is a cash stock purchase.",
    "Use trade(action: 'place', ...) with the same parameters to submit."
  ]
}
```

### Output (action: "place")

```json
{
  "data": {
    "action": "place",
    "status": "placed",
    "orderId": "87654321",
    "instrument": {
      "uic": 211,
      "symbol": "AAPL:xnas",
      "assetType": "Stock"
    },
    "order": {
      "side": "buy",
      "amount": 100,
      "type": "limit",
      "price": 190.00,
      "duration": "gtc",
      "status": "Working"
    }
  },
  "hints": [
    "Order placed: Buy 100 AAPL at limit $190.00 GTC. Order ID: 87654321.",
    "Use my_orders to track status or trade(action: 'cancel', order_id: '87654321') to cancel."
  ]
}
```

### Output (action: "modify")

```json
{
  "data": {
    "action": "modify",
    "status": "modified",
    "orderId": "87654321",
    "changes": {
      "price": { "from": 190.00, "to": 188.00 },
      "amount": { "from": 100, "to": 150 }
    }
  },
  "hints": [
    "Order 87654321 modified: price $190→$188, amount 100→150 shares.",
    "New estimated cost: $28,215 (150 × $188 + $15 commission)."
  ]
}
```

### Output (action: "cancel")

```json
{
  "data": {
    "action": "cancel",
    "status": "cancelled",
    "orderId": "87654321",
    "instrument": {
      "symbol": "AAPL:xnas"
    }
  },
  "hints": [
    "Order 87654321 cancelled (Buy 100 AAPL at limit $190.00).",
    "You have 0 remaining working orders."
  ]
}
```

### Recovery hints examples
- `"Insufficient margin. Available: 760,564 EUR, required: 850,000 EUR. Reduce amount or close existing positions."`
- `"Instrument not tradable during current session. AAPL opens at 09:30 ET (15:30 CET). Use duration: 'day' to queue."`
- `"Order type 'trailing_stop' not supported for this instrument. Available: Market, Limit, StopIfTraded, StopLimit."`
- `"Order ID required for modify/cancel. Use my_orders to find order IDs."`
- `"Price 0.001 is below minimum tick size 0.01. Round to nearest tick."`
- `"Amount 0.5 invalid — minimum trade size is 1, increment is 1."`

### Edge cases
- Market order outside trading hours → reject with session schedule in recovery hint
- Limit order far from market → warn in precheck hints (e.g. "Limit is 15% below market price")
- Stop loss/take profit → creates related orders, return their IDs too
- Partial fill possible → note in hints
- Duration `gtd` without `gtd_date` → validation error with recovery hint

---

## 8. `my_history`

**Description:** View your account history — transactions, trading performance, or closed positions. Use `view` to switch between different perspectives.

**Endpoints:** `GET /hist/v1/transactions` · `GET /hist/v4/performance/summary` · `GET /hist/v3/accountvalues/{ClientKey}`

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `view` | `"transactions" \| "performance" \| "values"` | No | `"transactions"` | What to show |
| `from` | `string` | No | 30 days ago | Start date (ISO 8601) |
| `to` | `string` | No | today | End date (ISO 8601) |
| `asset_type` | `string` | No | — | Filter transactions by asset type |
| `limit` | `number` | No | `50` | Max items (transactions view) |
| `offset` | `number` | No | `0` | Skip N items |

### Output (view: "transactions")

```json
{
  "data": {
    "transactions": [
      {
        "id": "TX-001",
        "type": "Trade",
        "instrument": {
          "uic": 211,
          "symbol": "AAPL:xnas",
          "assetType": "Stock"
        },
        "side": "Buy",
        "amount": 100,
        "price": 189.50,
        "totalValue": 18950.00,
        "commission": 15.00,
        "currency": "USD",
        "bookedAt": "2026-03-10T15:30:00Z"
      }
    ]
  },
  "pagination": {
    "total": 12,
    "returned": 12,
    "offset": 0,
    "hasMore": false
  },
  "hints": [
    "12 transactions in last 30 days. Total commissions paid: $87.50.",
    "Most traded: AAPL (4 trades), EURUSD (3 trades)."
  ]
}
```

### Output (view: "performance")

```json
{
  "data": {
    "performance": {
      "period": { "from": "2026-02-11", "to": "2026-03-13" },
      "totalReturn": 12450.30,
      "totalReturnPct": 1.26,
      "currency": "EUR",
      "tradesCount": 12,
      "winRate": 0.67,
      "profitFactor": 2.1,
      "bestTrade": { "symbol": "MSFT:xnas", "pnl": 5200.00 },
      "worstTrade": { "symbol": "ENA:xwar", "pnl": -2100.00 }
    }
  },
  "hints": [
    "Return: +1.26% (€12,450) over 30 days. Win rate: 67%.",
    "Best trade: MSFT +€5,200. Worst: ENA -€2,100."
  ]
}
```

### Output (view: "values")

```json
{
  "data": {
    "accountValues": [
      { "date": "2026-03-01", "totalValue": 975000.00, "cashBalance": 750000.00 },
      { "date": "2026-03-13", "totalValue": 988144.49, "cashBalance": 760564.12 }
    ],
    "currency": "EUR"
  },
  "hints": [
    "Account value grew from €975,000 to €988,144 (+1.35%) this month.",
    "Cash balance increased by €10,564 — realized gains or deposits."
  ]
}
```

### Recovery hints examples
- `"No transactions found for this period. Try extending the date range with from/to."`
- `"Performance data requires at least 1 closed trade in the period."`

### Edge cases
- No trades in period → empty data + hint to extend range
- Performance with only open positions → limited data available
- Very long period → API may paginate, use `hasMore` indicator

---

## 9. `price_alert` (optional)

**Description:** Manage price alerts — get notified when an instrument hits a target price. Create, list, or delete alerts.

**Endpoints:** `GET /vas/v1/pricealerts/definitions` · `POST /vas/v1/pricealerts/definitions` · `DELETE /vas/v1/pricealerts/definitions/{Ids}`

### Input

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"list" \| "create" \| "delete"` | Yes | — | What to do |
| `uic` | `number` | Yes (create) | — | Instrument UIC |
| `asset_type` | `string` | Yes (create) | — | Asset type |
| `target_price` | `number` | Yes (create) | — | Price to trigger alert |
| `direction` | `"above" \| "below"` | Yes (create) | — | Trigger when price goes above or below target |
| `alert_id` | `string` | Yes (delete) | — | Alert ID to delete |
| `state` | `"active" \| "triggered" \| "all"` | No | `"active"` | Filter for list action |

### Output (action: "list")

```json
{
  "data": {
    "alerts": [
      {
        "alertId": "AL-001",
        "instrument": {
          "uic": 211,
          "symbol": "AAPL:xnas",
          "assetType": "Stock"
        },
        "targetPrice": 200.00,
        "direction": "above",
        "state": "Active",
        "createdAt": "2026-03-10T12:00:00Z",
        "currentPrice": 192.34
      }
    ]
  },
  "hints": [
    "1 active alert: AAPL above $200 (currently $192.34, 4.0% away).",
    "Use price_alert(action: 'delete', alert_id: 'AL-001') to remove."
  ]
}
```

### Output (action: "create")

```json
{
  "data": {
    "action": "create",
    "alertId": "AL-002",
    "instrument": {
      "uic": 21,
      "symbol": "EURUSD",
      "assetType": "FxSpot"
    },
    "targetPrice": 1.1500,
    "direction": "above",
    "state": "Active",
    "currentPrice": 1.1475
  },
  "hints": [
    "Alert created: EURUSD above 1.1500 (currently 1.1475, 0.2% away).",
    "You now have 2 active alerts."
  ]
}
```

### Output (action: "delete")

```json
{
  "data": {
    "action": "delete",
    "alertId": "AL-001",
    "status": "deleted"
  },
  "hints": [
    "Alert AL-001 deleted (AAPL above $200).",
    "You have 1 remaining active alert."
  ]
}
```

### Recovery hints examples
- `"Alert ID 'AL-999' not found. Use price_alert(action: 'list') to see your alerts."`
- `"Target price 192.34 is the current market price. Set a target above or below current level."`
- `"Maximum alerts reached. Delete existing alerts before creating new ones."`

### Edge cases
- Alert on closed market → still creates, triggers on next open
- Target very close to current price → warn it may trigger immediately
- Duplicate alert (same uic + direction + price) → warn but allow

---

## Tool Flow Diagram

```
User: "What do I have?"
  → my_account → my_portfolio(view: open)

User: "Find me Apple stock"
  → search_instrument(query: "Apple", asset_type: "Stock")

User: "What's the price?"
  → get_price(uic: 211, asset_type: "Stock")

User: "Show me the 1-minute chart"
  → get_chart(uic: 211, asset_type: "Stock", interval: "1m", count: 60)

User: "Buy 100 shares at $190"
  → trade(action: "precheck", uic: 211, ..., price: 190)
  → trade(action: "place", uic: 211, ..., price: 190)

User: "Change my order to $188"
  → trade(action: "modify", order_id: "87654321", price: 188)

User: "How did I do this month?"
  → my_history(view: "performance")

User: "Alert me if AAPL hits $200"
  → price_alert(action: "create", uic: 211, target_price: 200, direction: "above")
```

---

## Cross-tool ID Flow

```
search_instrument  →  uic, assetType
        ↓
    get_price      ←  uic, assetType
    get_chart      ←  uic, assetType
    trade          ←  uic, assetType
    price_alert    ←  uic, assetType
        ↓
    trade(place)   →  orderId
        ↓
    trade(modify)  ←  orderId
    trade(cancel)  ←  orderId
    my_orders      →  orderId (for discovery)
```

The `uic` + `assetType` pair is the universal instrument identifier across all tools. `search_instrument` is always the entry point for discovering these IDs.
