import type { ZodObject, ZodRawShape, z } from 'zod';

/**
 * Context passed to every tool handler.
 */
export interface ToolContext {
  signal?: AbortSignal;
}

/**
 * Content block in tool results.
 */
export type ToolContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; uri: string; mimeType?: string; text?: string };

/**
 * Result returned from tool handlers.
 */
export interface ToolResult {
  content: ToolContentBlock[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

/**
 * Tool definition using Zod schemas.
 */
export interface SharedToolDefinition<TShape extends ZodRawShape = ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  inputSchema: ZodObject<TShape>;
  outputSchema?: ZodRawShape;
  handler: (
    args: z.infer<ZodObject<TShape>>,
    context: ToolContext,
  ) => Promise<ToolResult>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export function defineTool<TShape extends ZodRawShape>(
  def: SharedToolDefinition<TShape>,
): SharedToolDefinition<TShape> {
  return def;
}
