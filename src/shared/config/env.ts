export type UnifiedConfig = {
  MCP_TITLE: string;
  MCP_INSTRUCTIONS: string;
  MCP_VERSION: string;
  LOG_LEVEL: 'debug' | 'info' | 'warning' | 'error';
};

export function parseConfig(env: Record<string, unknown>): UnifiedConfig {
  return {
    MCP_TITLE: String(env.MCP_TITLE || 'Saxo MCP'),
    MCP_INSTRUCTIONS: String(
      env.MCP_INSTRUCTIONS ||
        'Use saxo_config to connect with your token. Then my_account to verify. search_instrument to find UICs. Always precheck before placing orders.',
    ),
    MCP_VERSION: String(env.MCP_VERSION || '0.1.0'),
    LOG_LEVEL: (env.LOG_LEVEL as UnifiedConfig['LOG_LEVEL']) || 'info',
  };
}

export function resolveConfig(): UnifiedConfig {
  return parseConfig(process.env as Record<string, unknown>);
}
