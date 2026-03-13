# Saxo Bank OpenAPI — Complete Reference

> Full endpoint inventory for building a Saxo MCP server.
> Base URL: `https://gateway.saxobank.com/sim/openapi` (simulation) / `https://gateway.saxobank.com/openapi` (production)
> Auth: OAuth2 Bearer Token on all endpoints.

---

## Table of Contents

1. [Account History](#1-account-history)
2. [Asset Transfers](#2-asset-transfers)
3. [Chart](#3-chart)
4. [Client Management](#4-client-management)
5. [Client Reporting](#5-client-reporting)
6. [Client Services](#6-client-services)
7. [Corporate Actions](#7-corporate-actions)
8. [Disclaimer Management](#8-disclaimer-management)
9. [ENS (Event Notification Services)](#9-ens-event-notification-services)
10. [Market Overview](#10-market-overview)
11. [Partner Integration](#11-partner-integration)
12. [Portfolio](#12-portfolio)
13. [Reference Data](#13-reference-data)
14. [Regulatory Services](#14-regulatory-services)
15. [Root Services](#15-root-services)
16. [Trading](#16-trading)
17. [Value Add](#17-value-add)

---

## 1. Account History

Historical and performance data about clients and accounts. All endpoints are GET-only.

### 1.1 Account Values (v3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hist/v3/accountvalues/{ClientKey}` | Aggregated performance metrics (converted to client base currency). Params: `MockDataId` |

### 1.2 Historical Positions (v3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hist/v3/positions/{ClientKey}` | Closed positions for a time period. Params: `$inlinecount`, `$skip`, `$skiptoken`, `$top`, `AccountGroupKey`, `AccountKey`, `AssetType`, `FromDate`, `ToDate`, `StandardPeriod`, `Symbol`, `MockDataId` |

> Either `StandardPeriod` OR `FromDate`/`ToDate` required.

### 1.3 Performance (v3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hist/v3/perf/{ClientKey}` | Performance metrics for an account. Params: `AccountGroupKey`, `AccountKey`, `FieldGroups`, `StandardPeriod`, `FromDate`, `ToDate`, `MockDataId` |

### 1.4 Performance (v4)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hist/v4/performance/summary` | Aggregated trade results and performance. Params: `ClientKey` (req), `AccountGroupKey`, `AccountKey`, `FieldGroups`, `StandardPeriod`, `FromDate`, `ToDate`, `MockDataId` |
| GET | `/hist/v4/performance/timeseries` | Performance timeseries. Same params + `IsGrossMetricsEnabled`, `IsSdcClient` |

### 1.5 Transactions (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hist/v1/transactions` | All historical transactions. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKeys`, `AssetTypes`, `BookingId`, `ClientKey`, `CorporateActionId`, `Events`, `FromDate`, `FundingSubType`, `ToDate`, `ToOpenOrClose`, `TradeId`, `TransactionType`, `Uics` |

### 1.6 Unsettled Amounts (v1) — BETA

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hist/v1/unsettledamounts` | Unsettled amounts per currency. Params: `AccountGroupKey`, `AccountKey`, `AmountTypeSource`, `ClientKey`, `CurrencyCode`, `Scope` |
| GET | `/hist/v1/unsettledamounts/{Date}` | Historical unsettled amounts for a date. Params: `ClientKey` (req) |
| GET | `/hist/v1/unsettledamounts/exchanges` | Unsettled amounts grouped by exchange. Params: `AccountGroupKey`, `AccountKey`, `AmountTypeSource`, `ClientKey` |
| GET | `/hist/v1/unsettledamounts/exchanges/{ExchangeId}` | Unsettled amounts for a specific exchange |
| GET | `/hist/v1/unsettledamounts/instruments` | Unsettled amounts by instrument. Params: `AmountTypeId` (req), `Currency` (req), `AccountGroupKey`, `AccountKey`, `ClientKey` |

---

## 2. Asset Transfers

> BETA — only available to select partners.

| Sub-Service | Description |
|-------------|-------------|
| CashManagement - Beneficiary Instructions | Manage beneficiary instructions for cash transfers |
| CashManagement - Cash Withdrawal | Client cash withdrawal |
| CashManagement - Cash Withdrawal Limits | Retrieve withdrawal limits |
| CashManagement - InterAccount Transfers | Transfer cash between accounts |
| CashManagement - Periodic Payment | Recurring payments |
| Partner - Cash Transfer | Partner-level cash transfers |
| Partner - Cash Transfer Limits | Partner-level transfer limits |
| Partner - Prefunding | Partner prefunding |
| Securities Transfers | Transfer securities between accounts |

> Endpoint pattern: `/at/v1/...` — detailed specs require interactive API Explorer (SPA-rendered pages).

---

## 3. Chart

OHLC historical data. Horizons from 1 minute to 1 month. Some FX data back to 2002.

### 3.1 Charts (v3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chart/v3/charts` | Get OHLC samples for an instrument |
| POST | `/chart/v3/charts/subscriptions` | Create streaming chart subscription (returns initial snapshot) |
| DELETE | `/chart/v3/charts/subscriptions/{ContextId}` | Remove subscriptions by context. Params: `Tag` |
| DELETE | `/chart/v3/charts/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

**GET `/chart/v3/charts` parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `AssetType` | Yes | Instrument asset type |
| `Uic` | Yes | Unique Instrument Code |
| `Horizon` | Yes | Interval in minutes: 1, 5, 10, 15, 30, 60, 120, 240, 360, 480, 1440, 10080, 43200 |
| `Count` | No | Number of samples (default ~100) |
| `FieldGroups` | No | `ChartInfo`, `Data`, `DisplayAndFormat` |
| `Mode` | No | `From` or `UpTo` — how `Time` is interpreted |
| `Time` | No | ISO 8601 reference timestamp |
| `AccountKey` | No | Account key |

**Response data fields by AssetType:**

| AssetType | Fields |
|-----------|--------|
| FxSpot, CfdOnIndex, CfdOnFutures | OpenAsk/Bid, HighAsk/Bid, LowAsk/Bid, CloseAsk/Bid, Time |
| CfdOnStock | Open, OpenAsk/Bid, High, HighAsk/Bid, Low, LowAsk/Bid, Close, CloseAsk/Bid, Time |
| Stock | Open, High, Low, Close, Volume, Interest, Time |
| StockIndex, ContractFutures, ManagedFund | Open, High, Low, Close, Interest, Time |

**Subscription request body:**
```json
{
  "ContextId": "string",
  "ReferenceId": "string",
  "Arguments": {
    "AssetType": "FxSpot",
    "Uic": 21,
    "Horizon": 1,
    "Count": 2,
    "FieldGroups": ["Data", "ChartInfo"]
  },
  "Format": "application/json",
  "RefreshRate": 1000
}
```

> Do NOT use chart close prices for watchlists — use `/trade/v1/infoprices` instead.
> Monitor `DataVersion` — when it changes, re-fetch all samples.

---

## 4. Client Management

### 4.1 Accounts (v2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cm/v2/accounts` | Create additional account for existing client |

### 4.2 Client Renewals (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cm/v1/clientrenewals` | Renewal info for client/user. Params: `ClientKey`, `UserKey` |
| PATCH | `/cm/v1/clientrenewals/{RenewalEntityId}` | Update renewal info/documents |
| POST | `/cm/v1/clientrenewals/all` | Status of all ongoing renewals (incl. approved within 3 months). Params: `$skip`, `$top` |
| GET | `/cm/v1/clientrenewals/pending` | Pending renewals. Params: `$skip`, `$top`, `MustRenewBy`, `OwnerKey` |

### 4.3 Documents (v1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cm/v1/documents` | Upload documents for existing client |

### 4.4 Signups (v1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cm/v1/signups` | Create new client. Params: `OwnerKey` (req). Returns `ClientId`, `ClientKey`, `SignupId` |
| POST | `/cm/v1/signups/attachments/{SignUpId}` | Attach files. Params: `DocumentType` (req), `RenewalDate`, `Title` |
| PUT | `/cm/v1/signups/completeapplication/{SignUpId}` | Complete onboarding. Params: `AwaitAccountCreation` |
| GET | `/cm/v1/signups/onboardingpdf/{ClientKey}` | Generate onboarding PDF. Params: `DocumentType` (req) |
| GET | `/cm/v1/signups/options` | Available field values for signup forms |
| GET | `/cm/v1/signups/status/{ClientKey}` | Client onboarding status |
| POST | `/cm/v1/signups/verification/initiate/{ClientKey}` | Initiate external verification |

### 4.5 Signups (v2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cm/v2/signups/attachments/{SignUpId}` | Attach multiple files |
| GET | `/cm/v2/signups/options` | Translated field values |
| POST | `/cm/v2/signups/verification/initiate/{ClientKey}` | Initiate verification (v2) |

### 4.6 Users (v1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cm/v1/users/resetpasswordrequest` | Request password reset |

---

## 5. Client Reporting

PDF/Excel report retrieval. Format controlled via `Accept` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cr/v1/reports/AccountStatement/{ClientKey}` | Account statement (PDF/Excel). Params: `AccountGroupKey`, `AccountKey`, `AccountStatementSortByRule`, `FromDate`, `ToDate` |
| GET | `/cr/v1/reports/Portfolio/{ClientKey}/{FromDate}/{ToDate}` | Portfolio report (PDF). Params: `AccountGroupKey`, `AccountKey`, `IncludeYTDInformation`, `IsGrossMetricsEnabled`, `IsSdcCLient`, `OptionalReportSections` |
| GET | `/cr/v1/reports/Portfolio/me/{FromDate}/{ToDate}` | Portfolio report for authenticated user |
| GET | `/cr/v1/reports/TradeDetails/{ClientKey}` | Trade details (PDF). Params: `AccountKey`, `FilterType`, `FilterValue`, `TradeId` |
| GET | `/cr/v1/reports/TradesExecuted/{ClientKey}` | Trades executed (PDF/Excel). Params: `AccountGroupKey`, `AccountKey`, `FromDate` (req), `ToDate` (req) |

---

## 6. Client Services

### 6.1 Audit — Order Activities (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cs/v1/audit/orderactivities` | Historical order activities. Params: `$skiptoken`, `$top`, `AccountKey`, `ClientKey`, `CorrelationKey`, `EntryType`, `FieldGroups`, `FromDateTime`, `IncludeSubAccounts`, `OrderId`, `Status`, `ToDateTime` |

### 6.2 Cash Management — Inter Account Transfer (v2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cs/v2/cashmanagement/interaccounttransfers` | Transfer money between accounts of same client |

### 6.3 Cash Management — Wire Transfers (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cs/v2/cashmanagement/wiretransfers/instructions` | Wire transfer funding instructions. Params: `AccountKey` (req), `ClientKey` (req), `CurrencyCode` (req) |

### 6.4 Client Info (v2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cs/v2/clientinfo/clients/search` | Search child counterparts. Params: `$inlinecount`, `$skip`, `$top` (max 100) |

### 6.5 Historical Report Data (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cs/v1/reports/aggregatedAmounts/{ClientKey}/{FromDate}/{ToDate}` | Aggregated amounts. Params: `$skip`, `$skiptoken`, `$top`, `AccountGroupKey`, `AccountKey`, `MockDataId` |
| GET | `/cs/v1/reports/bookings/{ClientKey}` | Booking records. Params: `$skip`, `$skiptoken`, `$top`, `AccountGroupKey`, `AccountKey`, `FilterType`, `FilterValue`, `FromDate`, `ToDate`, `MockDataId` |
| GET | `/cs/v1/reports/closedPositions/{ClientKey}/{FromDate}/{ToDate}` | Closed positions. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKey` |
| GET | `/cs/v1/reports/trades/{ClientKey}` | Trades. Params: `$skip`, `$skiptoken`, `$top`, `AccountGroupKey`, `AccountKey`, `FromDate`, `ToDate`, `TradeId`, `MockDataId` |

### 6.6 Support Cases (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cs/v1/partner/support/cases` | List support cases. Params: `$top`, `FromDateTime`, `ToDateTime`, `Status` |
| POST | `/cs/v1/partner/support/cases` | Create new case |
| GET | `/cs/v1/partner/support/cases/{CaseId}` | Get case by ID |
| PATCH | `/cs/v1/partner/support/cases/{CaseId}` | Update case |
| PUT | `/cs/v1/partner/support/cases/{CaseId}/caseclose` | Close case |
| POST | `/cs/v1/partner/support/cases/{CaseId}/internalcomment` | Add internal comment |
| POST | `/cs/v1/partner/support/cases/{CaseId}/note` | Add note |

### 6.7 Trading Conditions (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cs/v1/tradingconditions/instrument/{AccountKey}/{Uic}/{AssetType}` | Trading conditions for instrument. Params: `FieldGroups`, `TradeContext` |
| GET | `/cs/v1/tradingconditions/ContractOptionSpaces/{AccountKey}/{OptionRootId}` | Trading conditions for contract options. Params: `FieldGroups`, `Uic` |
| GET | `/cs/v1/tradingconditions/cost/{AccountKey}/{Uic}/{AssetType}` | Pre-trade cost illustration. Params: `Amount`, `FieldGroups`, `HoldingPeriodInDays`, `Price`, `TradeContext` |

---

## 7. Corporate Actions

> Subject to special licensing agreements.

### 7.1 Elections (v2)

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/ca/v2/elections` | Send election instruction (overwrites previous) |
| PUT | `/ca/v2/elections/bulk` | Bulk election instructions |

### 7.2 Event Views (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ca/v2/eventviews` | All events for owner's clients. Params: `$skip`, `$top`, `AssetTypes`, `CorporateActionTypes`, `ElectionStatuses`, `EventStates`, `EventStatus`, `EventTypes`, `FromDeadlineDate`, `FromExDate`, `FromPayDate`, `FromRecordDate`, `IncludeLapsedEvents`, `Keywords`, `OwnerKey`, `SortColumn`, `SortType`, `ToDeadlineDate`, `ToExDate`, `ToPayDate`, `ToRecordDate` |

### 7.3 Events (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ca/v2/events` | Events for client positions. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKey`, `AssetTypes`, `ClientKey`, `CorporateActionTypes`, `ElectionStatuses`, `EventStates`, `EventStatus`, `EventTypes`, date filters, `IncludeLapsedEvents`, `IncludeSubAccounts`, `Keywords`, `SortColumn`, `SortType` |
| GET | `/ca/v2/events/{EventId}` | Single event details. Params: `AccountKey`, `ClientKey`, `EventStates`, `IncludeSubAccounts` |
| GET | `/ca/v2/events/lookupdata` | Filter options/lookup data. Params: `AccountGroupKey`, `AccountKey`, `ClientKey`, `FieldGroups`, `IncludeSubAccounts` |

### 7.4 Holdings (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ca/v2/holdings` | Client holdings. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKey`, `ClientKey`, `EventId`, `IncludeSubAccounts`, `ManagementTypes`, `ModelIds` |
| POST | `/ca/v2/holdings` | Client holdings via POST. Params: `$skip`, `$top` |

### 7.5 Proxy Voting (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ca/v2/proxyvoting/events` | Proxy voting events. Params: `$skip`, `$top`, `AccountKey`, `ClientKey`, `SortColumn`, `SortType` |
| GET | `/ca/v2/proxyvoting/events/{JobNumber}/fees` | Proxy voting fees. Params: `AccountKey` |
| POST | `/ca/v2/proxyvoting/events/{JobNumber}/fees/actions/accept` | Accept fee disclaimer, get action URL |

### 7.6 Standing Instructions (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ca/v2/standinginstructions` | List standing instructions. Params: `ClientKey` (req), `IncludeSubAccounts` (req) |
| POST | `/ca/v2/standinginstructions` | Create standing instruction |
| DELETE | `/ca/v2/standinginstructions` | Remove standing instructions. Params: `ClientKey` (req), `StandingInstructionIds` (req) |

---

## 8. Disclaimer Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dm/v2/disclaimers` | Get disclaimer detail. Params: `DisclaimerTokens` (req) |
| POST | `/dm/v2/disclaimers` | Register user's disclaimer response |

---

## 9. ENS (Event Notification Services)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ens/v1/activities` | List activities. Params: `$skiptoken`, `$top`, `AccountGroupKey`, `AccountKey`, `Activities`, `CANotificationTypes`, `ClientKey`, `CorporateActionEventTypes`, `CorporateActionTypes`, `Duration`, `ExpirationDateTime`, `FieldGroups`, `FromDateTime`, `IncludeSubAccounts`, `OrderStatuses`, `OrderSubStatuses`, `OrderTypes`, `PositionEventFilter`, `SequenceId`, `SourceOrderId`, `TimeOnMargin`, `ToDateTime` |
| POST | `/ens/v1/activities/subscriptions` | Create event subscription (streaming/WebSocket) |
| DELETE | `/ens/v1/activities/subscriptions/{ContextId}` | Remove subscriptions. Params: `Tag` |
| DELETE | `/ens/v1/activities/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

---

## 10. Market Overview

### 10.1 Instrument Documents (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mkt/v1/instruments/{Uic}/{AssetType}/documents/pdf` | Fetch instrument PDF. Params: `Amount`, `DocumentType` (req), `HoldingPeriodInDays`, `LanguageCode` (req) |
| GET | `/mkt/v1/instruments/{Uic}/{AssetType}/documents/recommended` | Recommended documents list. Params: `DocumentType` (req), `OptionType` |

### 10.2 Instrument Documents (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mkt/v2/instruments/{Uic}/{AssetType}/documents/pdf` | Fetch instrument PDF (v2). Params: `Amount`, `DocumentType` (req), `HoldingPeriodInDays`, `LanguageCode` (req) |
| GET | `/mkt/v2/instruments/{Uic}/{AssetType}/documents/recommended` | Recommended documents (v2). Params: `DocumentTypes` (req) |

---

## 11. Partner Integration

> Endpoint pattern: `/pi/v1/...` — detailed specs require interactive API Explorer.

| Sub-Service | Description |
|-------------|-------------|
| Advisory Accounts | Manage advisory accounts |
| External Accounts | Manage external accounts of clients |
| Funding Instruction | Manage funding instructions |
| InteractiveESigning | eSigning verification callbacks |
| InteractiveIdVerification | ID verification |
| Partner Bulk Bookings | Bulk booking endpoints |
| Update Pricing | Non-stream price updates |

---

## 12. Portfolio

Client portfolio information: balances, positions, orders, exposure.

### 12.1 Account Groups (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/accountgroups` | List account groups. Params: `ClientKey` (req), `$inlinecount`, `$skip`, `$top` |
| GET | `/port/v1/accountgroups/{AccountGroupKey}` | Single account group. Params: `ClientKey` (req) |
| PATCH | `/port/v1/accountgroups/{AccountGroupKey}` | Update account group settings. Params: `ClientKey` (req) |
| GET | `/port/v1/accountgroups/me` | Account groups for authenticated user |

### 12.2 Accounts (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/accounts` | List accounts. Params: `ClientKey` (req), `IncludeSubAccounts`, `$inlinecount`, `$skip`, `$top` |
| GET | `/port/v1/accounts/{AccountKey}` | Single account |
| PATCH | `/port/v1/accounts/{AccountKey}` | Update account (shield value, benchmark, display name) |
| PUT | `/port/v1/accounts/{AccountKey}/reset` | Reset trial account (SIM only) |
| GET | `/port/v1/accounts/me` | Accounts for authenticated user |
| POST | `/port/v1/accounts/subscriptions` | Create account subscription |
| DELETE | `/port/v1/accounts/subscriptions/{ContextId}` | Remove subscriptions by tag |
| DELETE | `/port/v1/accounts/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 12.3 Balances (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/balances` | Get balance. Params: `AccountGroupKey`, `AccountKey`, `ClientKey`, `FieldGroups` |
| GET | `/port/v1/balances/marginoverview` | Margin overview. Params: `AccountGroupKey`, `AccountKey`, `ClientKey` |
| GET | `/port/v1/balances/me` | Balance for authenticated user |
| POST | `/port/v1/balances/subscriptions` | Create balance subscription |
| DELETE | `/port/v1/balances/subscriptions/{ContextId}` | Remove subscriptions by tag |
| DELETE | `/port/v1/balances/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 12.4 Clients (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/clients` | All clients under owner. Params: `OwnerKey` (req), `$inlinecount`, `$skip`, `$top` |
| PATCH | `/port/v1/clients` | Update client settings (netting mode, protection limits). Params: `ClientKey` (req) |
| GET | `/port/v1/clients/{ClientKey}` | Client details |
| GET | `/port/v1/clients/me` | Authenticated user's client details |
| PATCH | `/port/v1/clients/me` | Update own client profile |

### 12.5 Closed Positions (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/closedpositions` | List closed positions. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKey`, `ClientKey`, `ClosedPositionId`, `FieldGroups` |
| GET | `/port/v1/closedpositions/{ClosedPositionId}` | Single closed position |
| GET | `/port/v1/closedpositions/me` | Closed positions for authenticated user |
| POST | `/port/v1/closedpositions/subscriptions` | Create subscription |
| DELETE | `/port/v1/closedpositions/subscriptions/{ContextId}` | Remove subscriptions by tag |
| PATCH | `/port/v1/closedpositions/subscriptions/{ContextId}/{ReferenceId}` | Modify subscription page size |
| DELETE | `/port/v1/closedpositions/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 12.6 Exposure (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/exposure/currency` | Currency exposures. Params: `AccountGroupKey`, `AccountKey`, `ClientKey`, `StrategyGroupingEnabled` |
| GET | `/port/v1/exposure/currency/me` | Currency exposures for authenticated user |
| GET | `/port/v1/exposure/fxspot` | FX spot exposures |
| GET | `/port/v1/exposure/fxspot/me` | FX spot exposures for authenticated user |
| GET | `/port/v1/exposure/instruments` | Instrument exposures. Params: `AccountGroupKey`, `AccountKey`, `AssetType`, `ClientKey`, `ExpiryDate`, `LowerBarrier`, `PutCall`, `StrategyGroupingEnabled`, `Strike`, `Uic`, `UpperBarrier`, `ValueDate` |
| GET | `/port/v1/exposure/instruments/me` | Instrument exposures for authenticated user |
| POST | `/port/v1/exposure/instruments/subscriptions` | Create instrument exposure subscription |
| DELETE | `/port/v1/exposure/instruments/subscriptions/{ContextId}` | Remove subscriptions by tag |
| DELETE | `/port/v1/exposure/instruments/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 12.7 Net Positions (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/netpositions` | List net positions. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKey`, `AssetType`, `ClientKey`, `ExpiryDate`, `FieldGroups`, `LowerBarrier`, `NetPositionId`, `PutCall`, `StrategyGroupingEnabled`, `Strike`, `Uic`, `UpperBarrier`, `ValueDate`, `WatchlistId` |
| GET | `/port/v1/netpositions/{NetPositionId}` | Single net position |
| GET | `/port/v1/netpositions/me` | Net positions for authenticated user |
| POST | `/port/v1/netpositions/subscriptions` | Create subscription |
| DELETE | `/port/v1/netpositions/subscriptions/{ContextId}` | Remove subscriptions by tag |
| DELETE | `/port/v1/netpositions/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 12.8 Orders (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/orders` | List open orders. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKey`, `ClientKey`, `FieldGroups`, `OrderId`, `Status`, `WatchlistId` |
| GET | `/port/v1/orders/{ClientKey}/{OrderId}` | Single open order. Params: `FieldGroups` |
| GET | `/port/v1/orders/me` | Open orders for authenticated user. Params: `$skip`, `$top`, `FieldGroups`, `MultiLegOrderId`, `Status` |
| POST | `/port/v1/orders/subscriptions` | Create order subscription |
| DELETE | `/port/v1/orders/subscriptions/{ContextId}` | Remove subscriptions by tag |
| DELETE | `/port/v1/orders/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 12.9 Positions (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/positions` | List positions. Params: `$skip`, `$top`, `AccountGroupKey`, `AccountKey`, `ClientKey`, `FieldGroups`, `NetPositionId`, `PositionId`, `StrategyGroupingEnabled`, `WatchlistId` |
| GET | `/port/v1/positions/{PositionId}` | Single position |
| GET | `/port/v1/positions/me` | Positions for authenticated user |
| POST | `/port/v1/positions/subscriptions` | Create position subscription |
| DELETE | `/port/v1/positions/subscriptions/{ContextId}` | Remove subscriptions by tag |
| PATCH | `/port/v1/positions/subscriptions/{ContextId}/{ReferenceId}` | Modify subscription page size |
| DELETE | `/port/v1/positions/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 12.10 Users (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/port/v1/users` | List users. Params: `$inlinecount`, `$skip`, `$top`, `ActiveUsersFilter`, `ClientKey`, `IncludeSubUsers` |
| GET | `/port/v1/users/{UserKey}` | User details |
| GET | `/port/v1/users/{UserKey}/entitlements` | User market data entitlements. Params: `EntitlementFieldSet` |
| GET | `/port/v1/users/me` | Authenticated user details |
| PATCH | `/port/v1/users/me` | Update user preferences (language, culture, timezone) |
| GET | `/port/v1/users/me/entitlements` | Authenticated user's entitlements |

**Cross-cutting patterns:**
- `/me` endpoints use authenticated user's context
- Subscriptions: POST to create (returns snapshot), DELETE to remove, PATCH to modify page size
- Subscriptions use `ContextId` + `ReferenceId`, support `Tag` for bulk removal
- Pagination: OData-style `$skip`, `$top`, `$inlinecount`, `$skiptoken`
- `FieldGroups` controls response verbosity

---

## 13. Reference Data

All endpoints are GET-only. 10 sub-services, 16 endpoints.

### 13.1 Algo Strategies (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/algostrategies` | List strategies. Params: `$skip`, `$top` |
| GET | `/ref/v1/algostrategies/{Name}` | Strategy details |

### 13.2 Countries (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/countries` | All supported countries |

### 13.3 Cultures (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/cultures` | All supported cultures |

### 13.4 Currencies (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/currencies` | All supported currencies |

### 13.5 Currency Pairs (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/currencypairs` | All currency pairs. Params: `AccountKey` (req), `ClientKey` (req) |

### 13.6 Exchanges (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/exchanges` | List exchanges. Params: `$skip`, `$top` |
| GET | `/ref/v1/exchanges/{ExchangeId}` | Exchange details |

### 13.7 Instruments (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/instruments` | Search/list instruments. Params: `$skip`, `$top`, `AccountKey`, `AssetTypes`, `CanParticipateInMultiLegOrder`, `Class`, `ExchangeId`, `IncludeNonTradable`, `Keywords`, price change filters, `Tags`, `Uics` |
| GET | `/ref/v1/instruments/contractoptionspaces/{OptionRootId}` | Contract option details. Params: `CanParticipateInMultiLegOrder`, `ClientKey`, `ExpiryDates`, `OptionSpaceSegment`, `TradingStatus`, `UnderlyingUic` |
| GET | `/ref/v1/instruments/details` | Bulk instrument details. Params: `$skip`, `$top`, `AccountKey`, `AssetTypes`, `FieldGroups`, `Tags`, `Uics` |
| GET | `/ref/v1/instruments/details/{Uic}/{AssetType}` | Single instrument details. Params: `AccountKey`, `ClientKey`, `FieldGroups` |
| GET | `/ref/v1/instruments/futuresspaces/{ContinuousFuturesUic}` | Futures space overview |
| GET | `/ref/v1/instruments/tradingschedule/{Uic}/{AssetType}` | Trading schedule |

### 13.8 Languages (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/languages` | All supported languages (ISO 639-1) |

### 13.9 Standard Dates (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/standarddates/forwardtenor/{Uic}` | Forward tenor dates. Params: `AccountKey` (req) |
| GET | `/ref/v1/standarddates/fxoptionexpiry/{Uic}` | FX option expiry dates |

### 13.10 Time Zones (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ref/v1/timezones` | All supported time zones |

---

## 14. Regulatory Services

### 14.1 Financial Overview (v3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reg/v3/mifid/financialoverviews/{EntityType}/{EntityKey}` | Get financial overview |
| PUT | `/reg/v3/mifid/financialoverviews/{EntityType}/{EntityKey}` | Replace financial overview |
| PATCH | `/reg/v3/mifid/financialoverviews/{EntityType}/{EntityKey}` | Partial update |

### 14.2 Investment Profile (v3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reg/v3/mifid/accountinvestmentprofiles/{AccountKey}` | Account investment profile. Params: `EntityKey`, `EntityType` |
| PUT | `/reg/v3/mifid/accountinvestmentprofiles/{AccountKey}` | Update account investment profile |
| PATCH | `/reg/v3/mifid/accountinvestmentprofiles/{AccountKey}` | Partial update |
| GET | `/reg/v3/mifid/investmentprofiles/{EntityType}/{EntityKey}` | Shared investment profile |
| PUT | `/reg/v3/mifid/investmentprofiles/{EntityType}/{EntityKey}` | Replace shared profile |
| PATCH | `/reg/v3/mifid/investmentprofiles/{EntityType}/{EntityKey}` | Partial update |

### 14.3 Knowledge & Experience (v3)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reg/v3/mifid/appropriateness/{UserKey}/{RegulatoryContext}` | Appropriateness status |
| GET | `/reg/v3/mifid/qnasections/{UserKey}/{RegulatoryContext}` | K&E assessment Q&A. Params: `SectionName` |

---

## 15. Root Services

### 15.1 Diagnostics (v1) — No auth required

| Method | Path | Description |
|--------|------|-------------|
| GET | `/root/v1/diagnostics/get` | Test GET |
| POST | `/root/v1/diagnostics/post` | Test POST |
| PUT | `/root/v1/diagnostics/put` | Test PUT |
| PATCH | `/root/v1/diagnostics/patch` | Test PATCH |
| DELETE | `/root/v1/diagnostics/delete` | Test DELETE |
| HEAD | `/root/v1/diagnostics/head` | Test HEAD |
| OPTIONS | `/root/v1/diagnostics/options` | Test OPTIONS |

### 15.2 Sessions (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/root/v1/sessions/capabilities` | Get session capabilities |
| PUT | `/root/v1/sessions/capabilities` | Replace session capabilities |
| PATCH | `/root/v1/sessions/capabilities` | Partial update |
| POST | `/root/v1/sessions/events/subscriptions` | Session capabilities subscription |
| DELETE | `/root/v1/sessions/events/subscriptions/{ContextId}/{ReferenceId}` | Remove subscription |

### 15.3 Subscriptions (v1)

| Method | Path | Description |
|--------|------|-------------|
| DELETE | `/root/v1/subscriptions/{ContextId}` | Batch delete subscriptions (CSM). Params: `Tag` (req) |

### 15.4 User (v2)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/root/v2/user` | Current user info |

---

## 16. Trading

Order placement, prices, and trade execution. 9 sub-services, 45 endpoints.

### 16.1 Allocation Keys (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trade/v1/allocationkeys` | List allocation keys. Params: `$skip`, `$top`, `AccountKey`, `ClientKey`, `IncludeSubClients`, `Statuses` |
| POST | `/trade/v1/allocationkeys` | Create allocation key |
| GET | `/trade/v1/allocationkeys/{AllocationKeyId}` | Get allocation key |
| DELETE | `/trade/v1/allocationkeys/{AllocationKeyId}` | Delete allocation key |
| GET | `/trade/v1/allocationkeys/distributions/{AllocationKeyId}` | Calculate distribution. Params: `AssetType`, `OrderAmountType`, `Totalamount`, `Uic` |

### 16.2 Info Prices (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trade/v1/infoprices` | Single info price. Params: `AccountKey`, `Amount`, `AmountType`, `AssetType`, `FieldGroups`, `ForwardDate`, `ForwardDateFarLeg`, `ForwardDateNearLeg`, `OrderAskPrice`, `OrderBidPrice`, `QuoteCurrency`, `ToOpenClose`, `Uic` |
| GET | `/trade/v1/infoprices/list` | Multiple info prices (uses `Uics` plural) |
| POST | `/trade/v1/infoprices/subscriptions` | Create info price subscription |
| DELETE | `/trade/v1/infoprices/subscriptions/{ContextId}` | Remove subscriptions. Params: `Tag` |
| DELETE | `/trade/v1/infoprices/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 16.3 Messages (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trade/v1/messages` | Get unseen trade messages |
| PUT | `/trade/v1/messages/seen` | Mark messages as seen. Params: `MessageIds` |
| PUT | `/trade/v1/messages/seen/{MessageId}` | Mark single message as seen |
| POST | `/trade/v1/messages/subscriptions` | Create message subscription |
| DELETE | `/trade/v1/messages/subscriptions/{ContextId}` | Remove subscriptions. Params: `Tag` |
| DELETE | `/trade/v1/messages/subscriptions/{ContextId}/{ReferenceId}` | Remove single subscription |

### 16.4 Options Chain (v1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trade/v1/optionschain/subscriptions` | Create options chain subscription |
| PATCH | `/trade/v1/optionschain/subscriptions/{ContextId}/{ReferenceId}` | Modify subscription (scroll expiries/strikes) |
| DELETE | `/trade/v1/optionschain/subscriptions/{ContextId}/{ReferenceId}` | Remove subscription |
| PUT | `/trade/v1/optionschain/subscriptions/{ContextId}/{ReferenceId}/ResetATM` | Reset to at-the-money strikes |

### 16.5 Orders (v2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trade/v2/orders` | Place order (supports child limit/stop orders) |
| PATCH | `/trade/v2/orders` | Change orders (batch supported) |
| DELETE | `/trade/v2/orders?AccountKey={}&AssetType={}&Uic={}` | Cancel all orders for instrument/account |
| DELETE | `/trade/v2/orders/{OrderIds}?AccountKey={}` | Cancel specific orders |
| POST | `/trade/v2/orders/multileg` | Place multi-leg option strategy |
| PATCH | `/trade/v2/orders/multileg` | Change multi-leg order |
| DELETE | `/trade/v2/orders/multileg/{MultiLegOrderId}?AccountKey={}` | Cancel multi-leg order |
| GET | `/trade/v2/orders/multileg/defaults?AccountKey={}&OptionRootId={}&OptionsStrategyType={}` | Multi-leg strategy defaults |
| POST | `/trade/v2/orders/multileg/precheck` | Pre-validate multi-leg order |
| POST | `/trade/v2/orders/precheck` | Pre-validate order (stand-alone, 3-way, OCO) |

### 16.6 Positions (v1)

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/trade/v1/positions/{PositionId}` | Update position properties |
| PUT | `/trade/v1/positions/{PositionId}/exercise` | Force exercise position |
| PUT | `/trade/v1/positions/exercise` | Force exercise by UIC across all positions |

### 16.7 Prices (v1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trade/v1/prices/multileg` | Multi-leg price snapshot |
| POST | `/trade/v1/prices/multileg/subscriptions` | Create multi-leg price subscription |
| DELETE | `/trade/v1/prices/multileg/subscriptions/{ContextId}` | Remove multi-leg subscriptions. Params: `Tag` |
| DELETE | `/trade/v1/prices/multileg/subscriptions/{ContextId}/{ReferenceId}` | Remove single multi-leg subscription |
| POST | `/trade/v1/prices/subscriptions` | Create price subscription |
| DELETE | `/trade/v1/prices/subscriptions/{ContextId}` | Remove price subscriptions. Params: `Tag` |
| DELETE | `/trade/v1/prices/subscriptions/{ContextId}/{ReferenceId}` | Remove single price subscription |
| PUT | `/trade/v1/prices/subscriptions/{ContextId}/{ReferenceId}/MarginImpact` | Request margin impact calculation |

### 16.8 Trades (v1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trade/v1/trades` | Trade correction (cancel + recreate). Deal-capture only |
| DELETE | `/trade/v1/trades/{PositionIds}?AccountKey={}` | Cancel deal-capture trades |

### 16.9 Trades (v2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trade/v2/trades` | Create new trade. Deal-capture only |
| DELETE | `/trade/v2/trades/{PositionIds}?AccountKey={}` | Cancel deal-capture trades |

---

## 17. Value Add

### Price Alerts (v1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vas/v1/pricealerts/definitions` | List price alerts. Params: `$inlinecount`, `$skip`, `$top`, `State` (req) |
| POST | `/vas/v1/pricealerts/definitions` | Create price alert |
| GET | `/vas/v1/pricealerts/definitions/{AlertDefinitionId}` | Get alert by ID |
| PUT | `/vas/v1/pricealerts/definitions/{AlertDefinitionId}` | Update alert |
| DELETE | `/vas/v1/pricealerts/definitions/{AlertDefinitionIds}` | Delete alerts |
| GET | `/vas/v1/pricealerts/usersettings` | Get alert notification preferences |
| PUT | `/vas/v1/pricealerts/usersettings` | Update alert notification preferences |

---

## Common Patterns

### Authentication
All endpoints require OAuth2 Bearer token (`Authorization: Bearer {token}`), except `/root/v1/diagnostics/*`.

### Base URLs
- **Simulation:** `https://gateway.saxobank.com/sim/openapi`
- **Production:** `https://gateway.saxobank.com/openapi`

### Pagination
OData-style: `$skip`, `$top`, `$inlinecount`, `$skiptoken`

### Streaming Subscriptions
- **Create:** POST to `…/subscriptions` → returns initial snapshot
- **Modify:** PATCH on `…/subscriptions/{ContextId}/{ReferenceId}`
- **Remove single:** DELETE on `…/subscriptions/{ContextId}/{ReferenceId}`
- **Remove by tag:** DELETE on `…/subscriptions/{ContextId}?Tag={tag}`
- **Batch remove (CSM):** DELETE on `/root/v1/subscriptions/{ContextId}?Tag={tag}`
- Transport: WebSocket with `ContextId` + `ReferenceId` identifiers
- Watch for `_resetsubscriptions` and `_disconnect` control messages

### `/me` Endpoints
Shortcut using authenticated user's context instead of explicit `ClientKey`/`AccountKey`.

### FieldGroups
Many endpoints accept `FieldGroups` to control response verbosity and select specific data sections.

### AssetType Values
`FxSpot`, `FxForwards`, `FxVanillaOption`, `FxKnockInOption`, `FxKnockOutOption`, `FxOneTouchOption`, `FxNoTouchOption`, `CfdOnStock`, `CfdOnIndex`, `CfdOnFutures`, `CfdOnEtf`, `CfdOnEtn`, `CfdOnFund`, `CfdOnRights`, `Stock`, `StockIndex`, `StockOption`, `Bond`, `MutualFund`, `ManagedFund`, `ContractFutures`, `FuturesOption`, `Etc`, `Etf`, `Etn`, `Fund`, `Rights`, `CfdIndexOption`, `CompanyWarrant`, `FxBinaryOption`, `IpoOnStock`

---

## Endpoint Summary

| Service Group | Endpoints | Primary Use for MCP |
|---------------|-----------|---------------------|
| Account History | 10 | Performance data, transaction history |
| Asset Transfers | ~9 sub-services | Cash/securities transfers (BETA) |
| Chart | 4 | OHLC market data |
| Client Management | 14 | Account creation, onboarding |
| Client Reporting | 5 | PDF/Excel reports |
| Client Services | 17 | Trading conditions, audit, cash mgmt |
| Corporate Actions | ~15 | Elections, events, proxy voting |
| Disclaimer Management | 2 | Legal disclaimers |
| ENS | 4 | Real-time event notifications |
| Market Overview | 4 | Instrument documents |
| Partner Integration | ~7 sub-services | Partner-specific integrations |
| Portfolio | 58 | Positions, balances, orders, exposure |
| Reference Data | 16 | Instruments, exchanges, currencies |
| Regulatory Services | 11 | MiFID compliance |
| Root Services | 14 | Diagnostics, sessions, user info |
| Trading | 45 | Orders, prices, trades |
| Value Add | 7 | Price alerts |
| **Total** | **~240+** | |

---

## Appendix A: Response Schemas (Live Examples)

Real response shapes from the SIM environment, useful for building MCP tool responses.

### A.1 Client Info (`/port/v1/clients/me`)

```json
{
  "ClientId": "20768936",
  "ClientKey": "pLnap1BPrJGM7u1YHsgBsA==",
  "ClientType": "Normal",
  "DefaultAccountId": "20768936",
  "DefaultAccountKey": "pLnap1BPrJGM7u1YHsgBsA==",
  "DefaultCurrency": "EUR",
  "Name": "...",
  "LegalAssetTypes": ["FxSpot", "FxForwards", "ContractFutures", "Stock", "StockOption", "Bond", "FuturesOption", "StockIndexOption", "Cash", "CfdOnStock", "CfdOnIndex", "StockIndex", "CfdOnEtf", "CfdOnEtc", "CfdOnEtn", "CfdOnFund", "CfdOnRights", "CfdOnCompanyWarrant", "Etf", "Etc", "Etn", "Fund", "FxSwap", "Rights", "IpoOnStock", "CompanyWarrant"],
  "IsMarginTradingAllowed": true,
  "PositionNettingMethod": "FIFO",
  "PositionNettingMode": "Intraday",
  "PositionNettingProfile": "FifoRealTime",
  "ContractOptionsTradingProfile": "Expert",
  "CurrencyDecimals": 2,
  "AccountValueProtectionLimit": 0.0,
  "ForceOpenDefaultValue": false,
  "MarginCalculationMethod": "Default",
  "MarginMonitoringMode": "Margin",
  "AllowedNettingProfiles": ["FifoRealTime", "FifoEndOfDay"],
  "AllowedTradingSessions": "Regular"
}
```

### A.2 Account (`/port/v1/accounts/me`)

```json
{
  "Data": [{
    "AccountGroupKey": "pGHUw|E|fzq0xQiGnTb7-g==",
    "AccountId": "20768936",
    "AccountKey": "pLnap1BPrJGM7u1YHsgBsA==",
    "AccountSubType": "None",
    "AccountType": "Normal",
    "Active": true,
    "ClientId": "20768936",
    "ClientKey": "pLnap1BPrJGM7u1YHsgBsA==",
    "Currency": "EUR",
    "CurrencyDecimals": 2,
    "IsTrialAccount": true,
    "IsMarginTradingAllowed": true,
    "ManagementType": "Client",
    "LegalAssetTypes": ["FxSpot", "Stock", "..."],
    "IndividualMargining": true,
    "FractionalOrderEnabled": false,
    "DirectMarketAccess": false,
    "CreationDate": "2025-06-16T20:35:02.740000Z"
  }]
}
```

### A.3 Balance (`/port/v1/balances/me`)

```json
{
  "CashBalance": 760564.12,
  "TotalValue": 988144.49,
  "Currency": "EUR",
  "CurrencyDecimals": 2,
  "UnrealizedPositionsValue": 226897.62,
  "NonMarginPositionsValue": 227580.37,
  "OpenPositionsCount": 3,
  "NetPositionsCount": 3,
  "OrdersCount": 0,
  "ClosedPositionsCount": 0,
  "CostToClosePositions": -682.75,
  "CollateralAvailable": 760564.12,
  "MarginAvailableForTrading": 760564.12,
  "MarginUsedByCurrentPositions": 0.0,
  "MarginUtilizationPct": 0.0,
  "MarginExposureCoveragePct": 0.0,
  "MarginNetExposure": 0.0,
  "InitialMargin": {
    "CollateralAvailable": 760564.12,
    "MarginAvailable": 760564.12,
    "MarginUsedByCurrentPositions": 0.0,
    "MarginUtilizationPct": 0.0,
    "NetEquityForMargin": 760564.12,
    "CollateralCreditValue": { "Line": 760564.12, "UtilizationPct": 0.0 }
  },
  "CalculationReliability": "Ok",
  "SettlementValue": 0.0,
  "OptionPremiumsMarketValue": 0.0,
  "UnrealizedMarginProfitLoss": 0.0,
  "TransactionsNotBooked": 0.0,
  "IsPortfolioMarginModelSimple": true
}
```

### A.4 Position (`/port/v1/positions/me`)

```json
{
  "__count": 3,
  "Data": [{
    "PositionId": "5025735079",
    "NetPositionId": "56214__Share",
    "DisplayAndFormat": {
      "Currency": "PLN",
      "Decimals": 2,
      "Description": "Enea SA",
      "Format": "Normal",
      "Symbol": "ENA:xwar"
    },
    "Exchange": {
      "Description": "Warsaw Stock Exchange",
      "ExchangeId": "WSE",
      "IsOpen": false,
      "TimeZoneId": "4"
    },
    "PositionBase": {
      "AccountId": "20768936",
      "AccountKey": "pLnap1BPrJGM7u1YHsgBsA==",
      "Amount": 11541.0,
      "AssetType": "Stock",
      "CanBeClosed": true,
      "ExecutionTimeOpen": "2026-03-10T08:29:15.495067Z",
      "IsForceOpen": false,
      "IsMarketOpen": false,
      "OpenPrice": 23.12,
      "OpenPriceIncludingCosts": 23.189359674205008,
      "Status": "Open",
      "Uic": 56214,
      "ValueDate": "2026-03-12T00:00:00.000000Z"
    },
    "PositionView": {
      "CalculationReliability": "ApproximatedPrice",
      "ConversionRateCurrent": 0.23395,
      "ConversionRateOpen": 0.23545,
      "CurrentPrice": 0.0,
      "CurrentPriceDelayMinutes": 15,
      "MarketState": "Closed",
      "ProfitLossOnTrade": -24697.74,
      "ProfitLossOnTradeInBaseCurrency": -5815.08,
      "TradeCostsTotal": -1526.87,
      "TradeCostsTotalInBaseCurrency": -358.41,
      "ExposureCurrency": "PLN"
    }
  }]
}
```

### A.5 Instrument Search (`/ref/v1/instruments?Keywords=AAPL&AssetTypes=Stock`)

```json
{
  "Data": [{
    "AssetType": "Stock",
    "CurrencyCode": "USD",
    "Description": "Apple Inc.",
    "ExchangeId": "NASDAQ",
    "GroupId": 976,
    "Identifier": 211,
    "IssuerCountry": "US",
    "PrimaryListing": 211,
    "SummaryType": "Instrument",
    "Symbol": "AAPL:xnas",
    "TradableAs": ["Stock"]
  }]
}
```

### A.6 Instrument Details (`/ref/v1/instruments/details/{Uic}/{AssetType}`)

```json
{
  "AssetType": "Stock",
  "CurrencyCode": "USD",
  "Description": "Apple Inc.",
  "Symbol": "AAPL:xnas",
  "Uic": 211,
  "IsTradable": true,
  "TradingStatus": "Tradable",
  "MinimumTradeSize": 1.0,
  "IncrementSize": 1.0,
  "AmountDecimals": 4,
  "Format": { "Decimals": 2, "OrderDecimals": 2 },
  "Exchange": {
    "CountryCode": "US",
    "ExchangeId": "NASDAQ",
    "Name": "NASDAQ",
    "TimeZoneId": "3"
  },
  "SupportedOrderTypes": ["TriggerStop", "TriggerBreakout", "TriggerLimit", "StopLimit", "StopIfTraded", "TrailingStopIfTraded", "Limit", "Market"],
  "SupportedOrderTypeSettings": [
    { "OrderType": "Market", "DurationTypes": ["DayOrder"] },
    { "OrderType": "Limit", "DurationTypes": ["GoodTillCancel", "DayOrder", "GoodTillDate"] },
    { "OrderType": "StopIfTraded", "DurationTypes": ["GoodTillCancel", "DayOrder", "GoodTillDate"] }
  ],
  "OrderDistances": {
    "EntryDefaultDistance": 0.25,
    "EntryDefaultDistanceType": "Percentage",
    "StopLossDefaultDistance": 0.5,
    "StopLossDefaultDistanceType": "Percentage",
    "TakeProfitDefaultDistance": 0.5,
    "TakeProfitDefaultDistanceType": "Percentage"
  },
  "TickSizeScheme": {
    "DefaultTickSize": 0.01,
    "Elements": [{ "HighPrice": 0.9999, "TickSize": 0.0001 }]
  },
  "StandardAmounts": [1.0, 10.0, 100.0, 500.0, 1000.0, 10000.0, 50000.0, 100000.0],
  "RelatedInstruments": [
    { "AssetType": "CfdOnStock", "Uic": 211 }
  ],
  "RelatedOptionRoots": [309],
  "TradingSessions": {
    "TimeZone": 3,
    "TimeZoneAbbreviation": "EDT",
    "TimeZoneOffset": "-04:00:00",
    "Sessions": [
      { "StartTime": "...T21:00:00Z", "EndTime": "...T11:00:00Z", "State": "Closed" },
      { "StartTime": "...T11:00:00Z", "EndTime": "...T13:30:00Z", "State": "PreMarket" },
      { "StartTime": "...T13:30:00Z", "EndTime": "...T20:00:00Z", "State": "AutomatedTrading" },
      { "StartTime": "...T20:00:00Z", "EndTime": "...T21:00:00Z", "State": "PostMarket" }
    ]
  },
  "SupportedStrategies": ["VWAP", "TWAP", "Iceberg", "Dark", "Liquidity Seeking", "..."],
  "PrimaryListing": 211,
  "TradableAs": ["Stock"],
  "IsExtendedTradingHoursEnabled": true
}
```

### A.7 Info Price (`/trade/v1/infoprices?Uic=21&AssetType=FxSpot`)

```json
{
  "AssetType": "FxSpot",
  "Uic": 21,
  "LastUpdated": "2026-03-13T07:16:01.520000Z",
  "PriceSource": "SBFX",
  "DisplayAndFormat": {
    "Currency": "USD",
    "Decimals": 4,
    "Description": "Euro/US Dollar",
    "Format": "AllowDecimalPips",
    "Symbol": "EURUSD"
  },
  "Quote": {
    "Amount": 10000,
    "Ask": 1.14765,
    "Bid": 1.14745,
    "Mid": 1.14755,
    "AskSize": 1000000.0,
    "BidSize": 5000000.0,
    "DelayedByMinutes": 0,
    "MarketState": "Open",
    "PriceSource": "SBFX",
    "PriceSourceType": "Firm",
    "PriceTypeAsk": "Tradable",
    "PriceTypeBid": "Tradable",
    "ErrorCode": "None"
  },
  "PriceInfo": {
    "High": 1.15287,
    "Low": 1.14749,
    "NetChange": -0.00348,
    "PercentChange": -0.3
  },
  "PriceInfoDetails": {
    "LastClose": 1.15103,
    "LastTraded": 0.0,
    "Open": 0.0,
    "Volume": 0.0
  },
  "InstrumentPriceDetails": {
    "IsMarketOpen": true,
    "ShortTradeDisabled": false,
    "ValueDate": "2026-03-17"
  },
  "MarketDepth": {
    "Ask": [1.14765, 1.14766, 1.14775, 1.14778],
    "AskSize": [4782000.0, 5218000.0, 10000000.0, 5000000.0],
    "Bid": [1.14745, 1.1474, 1.14733],
    "BidSize": [10000000.0, 10000000.0, 5000000.0],
    "NoOfBids": 3,
    "NoOfOffers": 4,
    "Level2PriceFeed": true
  }
}
```

### A.8 Chart Data (`/chart/v3/charts?Uic=21&AssetType=FxSpot&Horizon=1440`)

```json
{
  "ChartInfo": {
    "DelayedByMinutes": 0,
    "ExchangeId": "SBFX",
    "FirstSampleTime": "1971-01-06T00:00:00.000000Z",
    "Horizon": 1440
  },
  "Data": [{
    "CloseAsk": 1.1568,
    "CloseBid": 1.1566,
    "HighAsk": 1.16466,
    "HighBid": 1.16446,
    "LowAsk": 1.15619,
    "LowBid": 1.15599,
    "OpenAsk": 1.16096,
    "OpenBid": 1.16076,
    "Time": "2026-03-11T00:00:00.000000Z"
  }],
  "DataVersion": 29537652,
  "DisplayAndFormat": {
    "Decimals": 4,
    "Description": "Euro/US Dollar",
    "Format": "Normal",
    "Symbol": "EURUSD"
  }
}
```

### A.9 Trading Conditions (`/cs/v1/tradingconditions/instrument/{AccountKey}/{Uic}/{AssetType}`)

```json
{
  "AccountCurrency": "EUR",
  "AmountCurrency": "USD",
  "AssetType": "Stock",
  "IsTradable": true,
  "Uic": 211,
  "Rating": 1.0,
  "CurrentSpread": 0.01,
  "InstrumentCurrency": "USD",
  "CommissionLimits": [{
    "Currency": "USD",
    "MinCommission": 15.0,
    "OrderAction": "ExecuteOrder",
    "PerUnitRate": 0.02
  }],
  "CurrencyConversion": {
    "AskRate": 0.87151,
    "BidRate": 0.87151,
    "Markup": 0.0
  },
  "CollateralUtilizationLimit": {
    "InitialHaircut": 1.0,
    "CollateralEntries": [{
      "InitialRate": 0.0,
      "MaintenanceRate": 0.0,
      "NotionalLowerLimitUSD": 0.0
    }]
  },
  "HasKID": false,
  "IsSrdEligible": false
}
```

### A.10 User Info (`/root/v2/user`)

```json
{
  "ClientId": 20768936,
  "UserId": 20768936,
  "AssociatedAccountOperations": [
    "OAPI.OP.ViewPII", "OAPI.OP.ManageTradeConfig",
    "OAPI.OP.ManageInterAccountTransfers", "OAPI.OP.UserPreferences",
    "OAPI.OP.ManageClientOnboarding", "OAPI.OP.ManageCashTransfers",
    "OAPI.OP.View", "OAPI.OP.Trading", "OAPI.OP.ManageCorporateActions"
  ],
  "GeneralOperations": [
    "OAPI.OP.CreateSupportTicket", "OAPI.OP.TradingOnNonFundedAccounts",
    "OAPI.OP.TakePriceSession", "OAPI.OP.ManageClientOnboarding",
    "OAPI.OP.TakeTradeSession"
  ]
}
```
