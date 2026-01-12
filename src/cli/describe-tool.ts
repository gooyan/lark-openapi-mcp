import { AllTools, AllToolsZh } from '../mcp-tool/tools';
import { McpTool } from '../mcp-tool/types';

export interface DescribeToolOptions {
  language?: 'zh' | 'en';
}

export function handleDescribeTool(toolName: string, options: DescribeToolOptions): void {
  const isZH = options.language === 'zh';
  const allTools: McpTool[] = isZH ? AllToolsZh : AllTools;

  const tool = allTools.find((t) => t.name === toolName);

  if (!tool) {
    console.error(JSON.stringify({ error: `Tool not found: ${toolName}` }));
    process.exit(1);
  }

  const output = {
    name: tool.name,
    description: tool.description,
    project: tool.project,
    schema: tool.schema,
    accessTokens: tool.accessTokens,
    httpMethod: tool.httpMethod,
    path: tool.path,
    sdkName: tool.sdkName,
    supportFileUpload: tool.supportFileUpload,
    supportFileDownload: tool.supportFileDownload,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}
