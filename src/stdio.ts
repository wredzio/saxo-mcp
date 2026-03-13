import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './core/mcp.js';

const server = buildServer();
const transport = new StdioServerTransport();
await server.connect(transport);
