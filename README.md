# Saxo MCP

MCP server for Saxo Bank OpenAPI. Gives AI assistants (Claude, Cursor, etc.) access to your Saxo Bank account — portfolio, prices, charts, trading, and alerts.

Runs over **stdio** transport. Built with Bun and TypeScript.

## Tools

| Tool | Description |
|------|-------------|
| `saxo_config` | Show connection status and environment |
| `my_account` | Account overview — balances, margin, client info |
| `my_portfolio` | Open/net/closed positions and currency exposure |
| `my_orders` | Active (working) orders — limits, stops |
| `search_instrument` | Find instruments by keyword, get UICs and trading details |
| `get_price` | Live bid/ask/spread for one or more instruments |
| `get_chart` | Historical OHLC candles (1m to 1M intervals) |
| `trade` | Place, modify, cancel, or precheck orders |
| `my_history` | Transactions, performance summary, account value history |
| `price_alert` | Create, list, and delete price alerts |

## Setup

### 1. Get a Saxo access token

Go to [Saxo Developer Portal](https://www.developer.saxo/openapi/token) and generate an access token. Use the **SIM** environment for testing (paper trading with real prices).

### 2. Configure your MCP client

Add this to your MCP client configuration:

**Claude Code** (`~/.claude/.mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "saxo": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "src/stdio.ts"],
      "cwd": "/path/to/saxo-mcp",
      "env": {
        "SAXO_TOKEN": "your-saxo-access-token",
        "SAXO_ENV": "sim"
      }
    }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "saxo": {
      "command": "bun",
      "args": ["run", "src/stdio.ts"],
      "cwd": "/path/to/saxo-mcp",
      "env": {
        "SAXO_TOKEN": "your-saxo-access-token",
        "SAXO_ENV": "sim"
      }
    }
  }
}
```

**Cursor** (Settings → MCP Servers → Add):

```json
{
  "saxo": {
    "command": "bun",
    "args": ["run", "src/stdio.ts"],
    "cwd": "/path/to/saxo-mcp",
    "env": {
      "SAXO_TOKEN": "your-saxo-access-token",
      "SAXO_ENV": "sim"
    }
  }
}
```

### 3. Install and verify

```bash
bun install
```

After configuring the client, use `saxo_config` to check the connection, then `my_account` to verify API access.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SAXO_TOKEN` | Yes | — | Saxo Bank OAuth access token |
| `SAXO_ENV` | No | `sim` | `"sim"` for simulation or `"live"` for production |

## Typical workflow

```
search_instrument("Apple")     → get uic: 211, assetType: "Stock"
get_price(uic: 211)            → live bid/ask
get_chart(uic: 211, "1d")      → daily candles
trade(action: "precheck", ...) → cost estimate, margin impact
trade(action: "place", ...)    → submit order
my_orders()                    → track working orders
my_portfolio()                 → see positions
my_history(view: "performance")→ trading performance summary
```

The `uic` + `assetType` pair identifies instruments across all tools. Use `search_instrument` to discover them.

## Development

```bash
bun install          # Install dependencies
bun run start        # Run the server (stdio)
bun run lint         # Biome linter
bun run lint:fix     # Biome auto-fix
bun run typecheck    # TypeScript type check
bun test             # Run tests
```

## License

MIT
