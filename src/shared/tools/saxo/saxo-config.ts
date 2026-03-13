import { z } from 'zod';
import { defineTool } from '../types.js';
import { success, error } from './helpers.js';

export const saxoConfigTool = defineTool({
  name: 'saxo_config',
  title: 'Saxo Config',
  description: `Show current Saxo Bank connection status.

Token and environment are configured via environment variables:
- SAXO_TOKEN: Saxo Bank OAuth access token
- SAXO_ENV: "sim" (default) or "live"`,
  inputSchema: z.object({}),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },

  handler: async () => {
    const token = process.env.SAXO_TOKEN;
    const env = (process.env.SAXO_ENV ?? 'sim') as 'sim' | 'live';
    const baseUrl =
      env === 'live'
        ? 'https://gateway.saxobank.com/openapi'
        : 'https://gateway.saxobank.com/sim/openapi';

    if (!token) {
      return error(
        'No SAXO_TOKEN configured.',
        'NO_TOKEN',
        ['Set SAXO_TOKEN environment variable in your MCP client config.'],
      );
    }

    const masked = token.length <= 8 ? '****' : `${token.slice(0, 4)}...${token.slice(-4)}`;

    return success(
      `Saxo: ${env.toUpperCase()}, token: ${masked}`,
      { environment: env, baseUrl, token: masked, status: 'configured' },
      [
        `Connected to Saxo ${env.toUpperCase()} environment.`,
        `Endpoint: ${baseUrl}`,
        'Use my_account to verify the connection works.',
      ],
    );
  },
});
