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

# 列出所有工具（1291 个）
node dist/cli.js list-tools -t preset.all -l zh
```

### describe
显示工具详细信息。

```bash
node dist/cli.js describe <toolName> [--language zh]
```

### call
直接调用 MCP 工具。

```bash
# 基本用法（自动使用已登录的 token）
node dist/cli.js call <toolName> -a <appId> -s <appSecret> [--params <json>]

# 显式指定 user access token
node dist/cli.js call <toolName> -a <appId> -s <appSecret> -u <token>

# 开启调试模式
node dist/cli.js call <toolName> -a <appId> -s <appSecret> --debug
```

> 登录后（`login` 命令），`call` 会自动使用存储的 user access token，无需手动传入 `-u`。

## 批量邮件处理脚本

`scripts/mail-processor.js` - 批量处理邮件，节省 AI token

### 命令

| 命令 | 说明 |
|------|------|
| `fetch-list` | 获取邮件列表 |
| `fetch-detail` | 批量获取邮件详情 |
| `parse` | 解析 HTML 为纯文本 |
| `export` | 导出为 AI 友好格式 |
| `process` | 一键执行完整流程 |

### 使用示例

```bash
node scripts/mail-processor.js process \
  -a $APP_ID -s $APP_SECRET \
  --mailbox xxx@xxx.com \
  --count 20 \
  -o /tmp/mail.txt
```

### 核心逻辑

- HTML 转纯文本：使用正则移除标签，无外部依赖
- 内容截断：默认 2000 字符/封，可通过 `--max-length` 调整
- Token 节省：~99%（100KB HTML → 1KB 纯文本）

## 工具统计

使用 `preset.all` 可加载全部 1291 个工具，主要模块：

| 模块 | 数量 | 说明 |
|------|------|------|
| corehr | 229 | 飞书人事 |
| hire | 178 | 招聘 |
| task | 74 | 飞书任务 |
| contact | 70 | 通讯录 |
| mail | 67 | 邮箱 |
| im | 67 | 消息 |
| vc | 55 | 视频会议 |
| drive | 52 | 云文档 |
| bitable | 46 | 多维表格 |
| calendar | 41 | 日历 |

## 注意事项

- 工具定义在 `src/mcp-tool/tools/en/` 和 `src/mcp-tool/tools/zh/` 目录
- 工具执行通过 `larkOapiHandler` 函数，使用 Lark Node SDK
- CLI 命令需要在输出后调用 `process.exit()` 确保进程退出
- 保持与上游兼容，现有命令（mcp、login 等）不变
- 脚本中避免使用 `process` 作为函数名（与 Node.js 全局对象冲突）

## 调试技巧

- **构建问题**：submodule 克隆后需完整构建 `npm run build`，直接 `npx tsc` 可能遗漏模块
- **输出分析**：CLI 输出通过管道 grep 可能匹配失败，建议先输出到文件再分析
  ```bash
  # 推荐方式
  node dist/cli.js list-tools -t preset.all > /tmp/tools.json
  grep 'task' /tmp/tools.json
  ```
