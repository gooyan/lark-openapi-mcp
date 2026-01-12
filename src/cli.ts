#!/usr/bin/env node

import fs from 'fs';
import dotenv from 'dotenv';
import { Command } from 'commander';
import { currentVersion } from './utils/version';
import { initMcpServerWithTransport } from './mcp-server';
import { NODE_VERSION_MAJOR, OAPI_MCP_DEFAULT_ARGS, OAPI_MCP_ENV_ARGS } from './utils/constants';
import { LoginHandler } from './cli/login-handler';
import { handleListTools } from './cli/list-tools';
import { handleDescribeTool } from './cli/describe-tool';
import { handleCallTool } from './cli/call-tool';
import { parseStringArray } from './utils/parser-string-array';
import { LogLevel, logger } from './utils/logger';

dotenv.config();

const program = new Command();

program.name('lark-mcp').description('Feishu/Lark MCP Tool').version(currentVersion);

program
  .command('whoami')
  .description('Print All User Sessions')
  .action(() => {
    LoginHandler.handleWhoAmI();
  });

program
  .command('login')
  .description('Login using OAuth and get user access token')
  .option('-a, --app-id <appId>', 'Feishu/Lark App ID')
  .option('-s, --app-secret <appSecret>', 'Feishu/Lark App Secret')
  .option('-d, --domain <domain>', '(Optional) Feishu/Lark Domain (default: "https://open.feishu.cn")')
  .option('--host <host>', '(Optional) Host to listen (default: "localhost")')
  .option('-p, --port <port>', '(Optional) Port to listen (default: "3000")')
  .option(
    '--scope <scope>',
    '(Optional) Specify OAuth scope for user access token, default is all permissions granted to the app, separated by spaces or commas',
  )
  .option('--debug', '(Optional) Enable debug mode')
  .action(async (options) => {
    if (NODE_VERSION_MAJOR < 20) {
      logger.error(
        `❌ This CLI requires Node.js >= 20. You are using v${process.versions.node}.\n\n` +
          `👉 Please upgrade Node.js: https://nodejs.org/`,
      );
      process.exit(1);
    }
    const mergedOptions = { ...OAPI_MCP_DEFAULT_ARGS, ...OAPI_MCP_ENV_ARGS, ...options };
    if (mergedOptions.debug) {
      logger.setLevel(LogLevel.DEBUG);
    }
    await LoginHandler.handleLogin({ ...mergedOptions, scope: parseStringArray(mergedOptions.scope) });
  });

program
  .command('logout')
  .description('Logout and clear stored user access token')
  .option('-a, --app-id <appId>', '(Optional) Feishu/Lark App ID, if not specified, logout all apps')
  .option('--debug', '(Optional) Enable debug mode')
  .action(async (options) => {
    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    }
    await LoginHandler.handleLogout(options.appId);
  });

program
  .command('mcp')
  .description('Start Feishu/Lark MCP Service')
  .option('-a, --app-id <appId>', 'Feishu/Lark App ID')
  .option('-s, --app-secret <appSecret>', 'Feishu/Lark App Secret')
  .option('-d, --domain <domain>', '(Optional) Feishu/Lark Domain (default: "https://open.feishu.cn")')
  .option(
    '-t, --tools <tools>',
    '(Optional) List of API tools to enable, separated by commas or spaces (default: "preset.default")',
  )
  .option(
    '-c, --tool-name-case <toolNameCase>',
    '(Optional) Tool Name Case, snake or camel or kebab or dot (default: "snake")',
  )
  .option('-l, --language <language>', '(Optional) Tools Language, zh or en (default: "en")')
  .option(
    '--token-mode <tokenMode>',
    '(Optional) Token Mode, auto or user_access_token or tenant_access_token (default: "auto")',
  )
  .option('-u, --user-access-token <userAccessToken>', '(Optional) User Access Token (beta)')
  .option(
    '--oauth',
    '(Optional) Enable MCP Auth Server to get user_access_token and auto request user login when token expires (Beta) (default: false)',
  )
  .option(
    '--scope <scope>',
    '(Optional) Specify OAuth scope for user access token, default is all permissions granted to the app, separated by spaces or commas',
  )
  .option('-m, --mode <mode>', '(Optional) Transport Mode, stdio or sse or streamable (default: "stdio")')
  .option('--host <host>', '(Optional) Host to listen (default: "localhost")')
  .option('-p, --port <port>', '(Optional) Port to listen (default: "3000")')
  .option('--config <configPath>', '(Optional) Config file path (JSON)')
  .option('--debug', '(Optional) Enable debug mode')
  .action(async (options) => {
    let fileOptions = {};
    if (options.config) {
      try {
        const configContent = fs.readFileSync(options.config, 'utf-8');
        fileOptions = JSON.parse(configContent);
      } catch (err) {
        logger.error(`Failed to read config file: ${err}`);
        process.exit(1);
      }
    }
    const mergedOptions = { ...OAPI_MCP_DEFAULT_ARGS, ...OAPI_MCP_ENV_ARGS, ...fileOptions, ...options };

    if (NODE_VERSION_MAJOR < 20 && mergedOptions.oauth) {
      logger.error(
        `❌ This CLI requires Node.js >= 20. You are using v${process.versions.node}.\n\n` +
          `👉 Please upgrade Node.js: https://nodejs.org/`,
      );
      process.exit(1);
    }

    if (mergedOptions.debug) {
      logger.setLevel(LogLevel.DEBUG);
    }

    await initMcpServerWithTransport('oapi', {
      ...mergedOptions,
      scope: parseStringArray(mergedOptions.scope),
      tools: parseStringArray(mergedOptions.tools),
    });
  });

program
  .command('recall-developer-documents')
  .description('Start Feishu/Lark Open Platform Recall MCP Service')
  .option('-d, --domain <domain>', '(Optional) Feishu Open Platform Domain', 'https://open.feishu.cn')
  .option('-m, --mode <mode>', '(Optional) Transport Mode, stdio or sse or streamable', 'stdio')
  .option('--host <host>', '(Optional) Host to listen', 'localhost')
  .option('-p, --port <port>', '(Optional) Port to listen in sse mode', '3001')
  .option('--debug', '(Optional) Enable debug mode')
  .action(async (options) => {
    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    }
    await initMcpServerWithTransport('recall', options);
  });

// ============ CLI Tools Commands ============

program
  .command('list-tools')
  .description('List available MCP tools')
  .option('-l, --language <language>', '(Optional) Tools Language, zh or en (default: "en")')
  .option(
    '-t, --tools <tools>',
    '(Optional) Filter by preset or tool names, separated by commas (default: "preset.default")',
  )
  .option('-f, --filter <keyword>', '(Optional) Filter tools by keyword in name or description')
  .option('-v, --verbose', '(Optional) Show detailed tool information')
  .option('--debug', '(Optional) Enable debug mode')
  .action((options) => {
    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    }
    handleListTools(options);
  });

program
  .command('describe <toolName>')
  .description('Show detailed information about a specific tool')
  .option('-l, --language <language>', '(Optional) Tools Language, zh or en (default: "en")')
  .option('--debug', '(Optional) Enable debug mode')
  .action((toolName, options) => {
    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    }
    handleDescribeTool(toolName, options);
  });

program
  .command('call <toolName>')
  .description('Call a specific MCP tool directly')
  .option('-a, --app-id <appId>', 'Feishu/Lark App ID')
  .option('-s, --app-secret <appSecret>', 'Feishu/Lark App Secret')
  .option('-d, --domain <domain>', '(Optional) Feishu/Lark Domain (default: "https://open.feishu.cn")')
  .option('-l, --language <language>', '(Optional) Tools Language, zh or en (default: "en")')
  .option('--params <json>', '(Optional) Tool parameters as JSON string')
  .option('--params-file <path>', '(Optional) Tool parameters from JSON file')
  .option('-u, --user-access-token <token>', '(Optional) User Access Token for user-level APIs')
  .option('--debug', '(Optional) Enable debug mode')
  .action(async (toolName, options) => {
    const mergedOptions = { ...OAPI_MCP_DEFAULT_ARGS, ...OAPI_MCP_ENV_ARGS, ...options };
    if (mergedOptions.debug) {
      logger.setLevel(LogLevel.DEBUG);
    }
    await handleCallTool(toolName, mergedOptions);
  });

if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);

export { program };
