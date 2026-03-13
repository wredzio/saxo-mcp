import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from '../config/env.js';
import { registerTools } from '../shared/tools/registry.js';

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: config.MCP_TITLE, version: config.MCP_VERSION },
    {
      capabilities: { tools: { listChanged: true } },
      instructions: config.MCP_INSTRUCTIONS,
    },
  );

  registerTools(server);
  return server;
}
