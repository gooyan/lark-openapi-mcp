# Lark MCP CLI

> Fork 自 [larksuite/lark-openapi-mcp](https://github.com/larksuite/lark-openapi-mcp)，新增 CLI 工具命令支持。

项目介绍见 @README.md

## 项目结构

```
src/
├── cli.ts              # CLI 入口，所有命令定义
├── cli/
│   ├── index.ts        # CLI 模块导出
│   ├── login-handler.ts # 登录相关处理
│   ├── list-tools.ts   # [新增] list-tools 命令
│   ├── describe-tool.ts # [新增] describe 命令
│   └── call-tool.ts    # [新增] call 命令
├── mcp-tool/
│   ├── mcp-tool.ts     # LarkMcpTool 核心类
│   ├── tools/          # 工具定义（en/zh）
│   ├── utils/
│   │   ├── handler.ts  # larkOapiHandler 执行工具
│   │   └── filter-tools.ts
│   └── constants.ts    # 预设工具列表
├── mcp-server/         # MCP Server 实现
└── auth/               # 认证相关
```

## 开发命令

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式
npm run dev:cli

# 测试
npm test
```

## 新增的 CLI 命令

### list-tools
列出可用的 MCP 工具。

```bash
node dist/cli.js list-tools [--language zh] [--filter <keyword>] [--verbose]
```

### describe
显示工具详细信息。

```bash
node dist/cli.js describe <toolName> [--language zh]
```

### call
直接调用 MCP 工具。

```bash
node dist/cli.js call <toolName> -a <appId> -s <appSecret> [--params <json>]
```

## 注意事项

- 工具定义在 `src/mcp-tool/tools/en/` 和 `src/mcp-tool/tools/zh/` 目录
- 工具执行通过 `larkOapiHandler` 函数，使用 Lark Node SDK
- CLI 命令需要在输出后调用 `process.exit()` 确保进程退出
- 保持与上游兼容，现有命令（mcp、login 等）不变
