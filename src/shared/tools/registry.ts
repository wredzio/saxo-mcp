import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodObject, ZodRawShape, ZodTypeAny } from 'zod';
import { logger } from '../utils/logger.js';
import {
  saxoConfigTool,
  myAccountTool,
  myPortfolioTool,
  myOrdersTool,
  searchInstrumentTool,
  getPriceTool,
  getChartTool,
  tradeTool,
  myHistoryTool,
  priceAlertTool,
} from './saxo/index.js';
import type { SharedToolDefinition, ToolContext, ToolResult } from './types.js';

function getSchemaShape(schema: ZodTypeAny): ZodRawShape | undefined {
  if ('shape' in schema && typeof schema.shape === 'object') {
    return (schema as ZodObject<ZodRawShape>).shape;
  }
  if ('_def' in schema && schema._def && typeof schema._def === 'object') {
    const def = schema._def as { schema?: ZodTypeAny; innerType?: ZodTypeAny };
    if (def.schema) return getSchemaShape(def.schema);
    if (def.innerType) return getSchemaShape(def.innerType);
  }
  return undefined;
}

export type { SharedToolDefinition, ToolContext, ToolResult } from './types.js';
export { defineTool } from './types.js';

export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: ZodObject<ZodRawShape>;
  outputSchema?: ZodRawShape;
  annotations?: Record<string, unknown>;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

function asRegisteredTool<T extends ZodRawShape>(
  tool: SharedToolDefinition<T>,
): RegisteredTool {
  return tool as unknown as RegisteredTool;
}

export const sharedTools: RegisteredTool[] = [
  asRegisteredTool(saxoConfigTool),
  asRegisteredTool(myAccountTool),
  asRegisteredTool(myPortfolioTool),
  asRegisteredTool(myOrdersTool),
  asRegisteredTool(searchInstrumentTool),
  asRegisteredTool(getPriceTool),
  asRegisteredTool(getChartTool),
  asRegisteredTool(tradeTool),
  asRegisteredTool(myHistoryTool),
  asRegisteredTool(priceAlertTool),
];

export function getSharedTool(name: string): RegisteredTool | undefined {
  return sharedTools.find((t) => t.name === name);
}

export async function executeSharedTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = getSharedTool(name);
  if (!tool) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }

  try {
    if (context.signal?.aborted) {
      return { content: [{ type: 'text', text: 'Operation was cancelled' }], isError: true };
    }

    const parseResult = tool.inputSchema.safeParse(args);
    if (!parseResult.success) {
      const errors = parseResult.error.errors
        .map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { content: [{ type: 'text', text: `Invalid input: ${errors}` }], isError: true };
    }

    return await tool.handler(parseResult.data as Record<string, unknown>, context);
  } catch (error) {
    if (context.signal?.aborted) {
      return { content: [{ type: 'text', text: 'Operation was cancelled' }], isError: true };
    }
    return { content: [{ type: 'text', text: `Tool error: ${(error as Error).message}` }], isError: true };
  }
}

export function registerTools(server: McpServer): void {
  for (const tool of sharedTools) {
    const inputSchemaShape = getSchemaShape(tool.inputSchema);
    if (!inputSchemaShape) {
      throw new Error(`Failed to extract schema shape for tool: ${tool.name}`);
    }

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: inputSchemaShape,
        ...(tool.outputSchema && { outputSchema: tool.outputSchema }),
        ...(tool.annotations && { annotations: tool.annotations }),
      },
      async (args: Record<string, unknown>, extra: { signal?: AbortSignal }) => {
        const context: ToolContext = { signal: extra.signal };
        const result = await executeSharedTool(tool.name, args, context);
        return result as CallToolResult;
      },
    );
  }

  logger.info('tools', { message: `Registered ${sharedTools.length} tools` });
}
