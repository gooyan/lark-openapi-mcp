import fs from 'fs';
import { Client } from '@larksuiteoapi/node-sdk';
import { AllTools, AllToolsZh } from '../mcp-tool/tools';
import { McpTool } from '../mcp-tool/types';
import { larkOapiHandler } from '../mcp-tool/utils';
import { logger } from '../utils/logger';
import { authStore } from '../auth/store';

export interface CallToolOptions {
  appId: string;
  appSecret: string;
  domain?: string;
  language?: 'zh' | 'en';
  params?: string;
  paramsFile?: string;
  userAccessToken?: string;
  debug?: boolean;
}

export async function handleCallTool(toolName: string, options: CallToolOptions): Promise<void> {
  // Validate required options
  if (!options.appId || !options.appSecret) {
    console.error(JSON.stringify({ error: 'Missing required options: --app-id and --app-secret are required' }));
    process.exit(1);
  }

  // Get tool definition
  const isZH = options.language === 'zh';
  const allTools: McpTool[] = isZH ? AllToolsZh : AllTools;
  const tool = allTools.find((t) => t.name === toolName);

  if (!tool) {
    console.error(JSON.stringify({ error: `Tool not found: ${toolName}` }));
    process.exit(1);
  }

  // Parse params
  let params: Record<string, any> = {};
  if (options.paramsFile) {
    try {
      const content = fs.readFileSync(options.paramsFile, 'utf-8');
      params = JSON.parse(content);
    } catch (err) {
      console.error(JSON.stringify({ error: `Failed to read params file: ${err}` }));
      process.exit(1);
    }
  } else if (options.params) {
    try {
      params = JSON.parse(options.params);
    } catch (err) {
      console.error(JSON.stringify({ error: `Failed to parse params JSON: ${err}` }));
      process.exit(1);
    }
  }

  // Create Lark client
  const client = new Client({
    appId: options.appId,
    appSecret: options.appSecret,
    domain: options.domain,
    loggerLevel: options.debug ? (4 as any) : (1 as any), // 1 = error, 4 = debug
  });

  // Handle user access token - auto-fetch from authStore if not provided
  let userAccessToken = options.userAccessToken;
  if (!userAccessToken) {
    try {
      const storedTokenKey = await authStore.getLocalAccessToken(options.appId);
      if (storedTokenKey) {
        const tokenInfo = await authStore.getToken(storedTokenKey);
        if (tokenInfo?.token) {
          userAccessToken = tokenInfo.token;
          if (options.debug) {
            console.error('[CallTool] Using stored user access token');
          }
        }
      }
    } catch {
      // Ignore errors when fetching stored token
    }
  }

  if (userAccessToken) {
    params.useUAT = true;
  }

  if (options.debug) {
    logger.info(`[CallTool] Calling tool: ${toolName}`);
  }

  try {
    const handler = tool.customHandler || larkOapiHandler;
    const result = await handler(client, params, {
      userAccessToken,
      tool,
    });

    if (result.isError) {
      console.error(JSON.stringify({ error: true, result: result.content }));
      process.exit(1);
    }

    // Parse and output result
    const content = result.content?.[0];
    if (content?.type === 'text' && content.text) {
      try {
        const parsed = JSON.parse(content.text);
        console.log(JSON.stringify(parsed, null, 2));
      } catch {
        console.log(content.text);
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ error: `Failed to call tool: ${err}` }));
    process.exit(1);
  }
}
