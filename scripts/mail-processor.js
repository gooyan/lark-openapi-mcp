#!/usr/bin/env node

/**
 * Mail Processor - 批量邮件处理工具
 *
 * 功能：
 * 1. fetch-list: 获取邮件列表
 * 2. fetch-detail: 批量获取邮件详情
 * 3. parse: 解析邮件，提取纯文本
 * 4. export: 导出为 AI 友好的格式
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('@larksuiteoapi/node-sdk');

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-./g, (x) => x[1].toUpperCase());
      options[key] = args[++i];
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const keyMap = { a: 'appId', s: 'appSecret', o: 'output', i: 'input' };
      options[keyMap[key] || key] = args[++i];
    }
  }

  return { command, options };
}

// 创建 Lark 客户端
function createClient(options) {
  if (!options.appId || !options.appSecret) {
    console.error('Error: --app-id (-a) and --app-secret (-s) are required');
    process.exit(1);
  }
  return new Client({
    appId: options.appId,
    appSecret: options.appSecret,
    domain: options.domain || 'https://open.feishu.cn',
  });
}

// 获取邮件列表
async function fetchList(options) {
  const client = createClient(options);
  const mailbox = options.mailbox;
  const folder = options.folder || 'INBOX';
  const count = parseInt(options.count) || 10;

  if (!mailbox) {
    console.error('Error: --mailbox is required');
    process.exit(1);
  }

  console.error(`Fetching ${count} emails from ${folder}...`);

  const result = [];
  let pageToken = null;

  while (result.length < count) {
    const params = {
      path: { user_mailbox_id: mailbox },
      params: {
        folder_id: folder,
        page_size: Math.min(count - result.length, 50),
      },
    };
    if (pageToken) {
      params.params.page_token = pageToken;
    }

    const response = await client.mail.v1.userMailboxMessage.list(params);

    if (response.data?.items) {
      result.push(...response.data.items);
    }

    if (!response.data?.has_more) break;
    pageToken = response.data.page_token;
  }

  const output = {
    mailbox,
    folder,
    count: result.length,
    items: result.slice(0, count),
  };

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
    console.error(`Saved ${output.count} message IDs to ${options.output}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

// 批量获取邮件详情
async function fetchDetail(options) {
  const client = createClient(options);
  const mailbox = options.mailbox;

  if (!options.input) {
    console.error('Error: --input is required');
    process.exit(1);
  }

  const listData = JSON.parse(fs.readFileSync(options.input, 'utf-8'));
  const messageIds = listData.items;

  console.error(`Fetching ${messageIds.length} email details...`);

  const results = [];
  for (let i = 0; i < messageIds.length; i++) {
    const messageId = messageIds[i];
    console.error(`  [${i + 1}/${messageIds.length}] ${messageId.slice(0, 20)}...`);

    try {
      const response = await client.mail.v1.userMailboxMessage.get({
        path: {
          user_mailbox_id: mailbox || listData.mailbox,
          message_id: messageId,
        },
      });

      if (response.data?.message) {
        results.push(response.data.message);
      }
    } catch (err) {
      console.error(`    Error: ${err.message}`);
    }

    // 避免请求过快
    await new Promise((r) => setTimeout(r, 100));
  }

  const output = {
    mailbox: mailbox || listData.mailbox,
    count: results.length,
    messages: results,
  };

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
    console.error(`Saved ${output.count} message details to ${options.output}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

// HTML 转纯文本（无依赖实现）
function htmlToText(html) {
  if (!html) return '';

  let text = html;

  // 移除 script 和 style 标签及内容
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 替换常见 HTML 实体
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&mdash;/gi, '—');
  text = text.replace(/&ndash;/gi, '–');

  // 块级元素换行
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
  text = text.replace(/<\/?(table|thead|tbody|ul|ol)[^>]*>/gi, '\n');

  // 移除所有其他 HTML 标签
  text = text.replace(/<[^>]+>/g, '');

  // 解码其他 HTML 实体
  text = text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

  // 清理多余空白
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}

// 解析邮件，提取纯文本
function parse(options) {
  if (!options.input) {
    console.error('Error: --input is required');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(options.input, 'utf-8'));
  console.error(`Parsing ${data.messages.length} emails...`);

  const parsed = data.messages.map((msg, i) => {
    console.error(`  [${i + 1}/${data.messages.length}] ${msg.subject?.slice(0, 30) || 'No Subject'}...`);

    let bodyText = '';

    // 优先使用 body_plain
    if (msg.body_plain) {
      try {
        bodyText = Buffer.from(msg.body_plain, 'base64').toString('utf-8');
      } catch (e) {
        bodyText = msg.body_plain;
      }
    }

    // 如果没有 body_plain，从 body_html 提取
    if (!bodyText && msg.body_html) {
      try {
        const html = Buffer.from(msg.body_html, 'base64').toString('utf-8');
        bodyText = htmlToText(html);
      } catch (e) {
        bodyText = '';
      }
    }

    // 提取发件人
    let from = '';
    if (msg.from) {
      from = msg.from.name ? `${msg.from.name} <${msg.from.mail_address}>` : msg.from.mail_address;
    }

    // 提取收件人
    let to = '';
    if (msg.to && msg.to.length > 0) {
      to = msg.to.map((t) => (t.name ? `${t.name} <${t.mail_address}>` : t.mail_address)).join(', ');
    }

    return {
      id: msg.thread_id || msg.id,
      subject: msg.subject || 'No Subject',
      from,
      to,
      date: msg.date || msg.send_time,
      body: bodyText.slice(0, 5000), // 限制长度
      bodyLength: bodyText.length,
    };
  });

  const output = {
    mailbox: data.mailbox,
    count: parsed.length,
    messages: parsed,
  };

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
    console.error(`Saved ${output.count} parsed messages to ${options.output}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

// 导出为 AI 友好的格式
function exportForAI(options) {
  if (!options.input) {
    console.error('Error: --input is required');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(options.input, 'utf-8'));
  const maxBodyLength = parseInt(options.maxLength) || 2000;

  console.error(`Exporting ${data.messages.length} emails for AI...`);

  const lines = [];
  lines.push(`# 邮件摘要 (共 ${data.messages.length} 封)`);
  lines.push(`邮箱: ${data.mailbox}`);
  lines.push('');

  data.messages.forEach((msg, i) => {
    lines.push(`=== 邮件 ${i + 1} ===`);
    lines.push(`主题: ${msg.subject}`);
    lines.push(`发件人: ${msg.from}`);
    lines.push(`收件人: ${msg.to}`);
    lines.push(`日期: ${msg.date || '未知'}`);
    lines.push('');
    lines.push('内容:');

    const body = msg.body.slice(0, maxBodyLength);
    lines.push(body);
    if (msg.bodyLength > maxBodyLength) {
      lines.push(`... (内容已截断，原长度 ${msg.bodyLength} 字符)`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  const output = lines.join('\n');

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.error(`Saved to ${options.output} (${output.length} chars)`);
  } else {
    console.log(output);
  }
}

// 一键处理流程
async function processAll(options) {
  const tmpDir = options.tmpDir || '/tmp';
  const mailbox = options.mailbox;
  const folder = options.folder || 'INBOX';
  const count = options.count || '10';

  if (!mailbox) {
    console.error('Error: --mailbox is required');
    process.exit(1);
  }

  const listFile = path.join(tmpDir, 'mail-list.json');
  const detailFile = path.join(tmpDir, 'mail-details.json');
  const parsedFile = path.join(tmpDir, 'mail-parsed.json');

  console.error('=== Step 1: Fetch List ===');
  await fetchList({ ...options, folder, count, output: listFile });

  console.error('\n=== Step 2: Fetch Details ===');
  await fetchDetail({ ...options, input: listFile, output: detailFile });

  console.error('\n=== Step 3: Parse ===');
  parse({ input: detailFile, output: parsedFile });

  console.error('\n=== Step 4: Export ===');
  exportForAI({ input: parsedFile, output: options.output });

  console.error('\nDone!');
}

// 主函数
async function main() {
  const { command, options } = parseArgs();

  switch (command) {
    case 'fetch-list':
      await fetchList(options);
      break;
    case 'fetch-detail':
      await fetchDetail(options);
      break;
    case 'parse':
      parse(options);
      break;
    case 'export':
      exportForAI(options);
      break;
    case 'process':
      await processAll(options);
      break;
    default:
      console.log(`
Mail Processor - 批量邮件处理工具

Usage:
  node mail-processor.js <command> [options]

Commands:
  fetch-list     获取邮件列表
  fetch-detail   批量获取邮件详情
  parse          解析邮件，提取纯文本
  export         导出为 AI 友好的格式
  process        一键执行完整流程

Options:
  -a, --app-id <id>         Feishu App ID
  -s, --app-secret <secret> Feishu App Secret
  --mailbox <email>         邮箱地址
  --folder <folder>         文件夹 (默认: INBOX)
  --count <n>               邮件数量 (默认: 10)
  -i, --input <file>        输入文件
  -o, --output <file>       输出文件
  --max-length <n>          导出时内容最大长度 (默认: 2000)

Examples:
  # 一键处理 10 封邮件
  node mail-processor.js process -a $APP_ID -s $APP_SECRET --mailbox xxx@xxx.com --count 10 -o /tmp/mail.txt

  # 分步执行
  node mail-processor.js fetch-list -a $APP_ID -s $APP_SECRET --mailbox xxx --count 10 -o /tmp/list.json
  node mail-processor.js fetch-detail -a $APP_ID -s $APP_SECRET --mailbox xxx -i /tmp/list.json -o /tmp/details.json
  node mail-processor.js parse -i /tmp/details.json -o /tmp/parsed.json
  node mail-processor.js export -i /tmp/parsed.json -o /tmp/mail.txt
      `);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
