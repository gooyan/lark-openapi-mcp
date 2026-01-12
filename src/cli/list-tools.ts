import { AllTools, AllToolsZh } from '../mcp-tool/tools';
import { filterTools } from '../mcp-tool/utils';
import { TokenMode } from '../mcp-tool/types';
import { defaultToolNames, presetTools, PresetName } from '../mcp-tool/constants';
import { parseStringArray } from '../utils/parser-string-array';

export interface ListToolsOptions {
  language?: 'zh' | 'en';
  tools?: string;
  filter?: string;
  verbose?: boolean;
}

export function handleListTools(options: ListToolsOptions): void {
  const isZH = options.language === 'zh';
  const allTools = isZH ? AllToolsZh : AllTools;

  // Parse tools option
  let toolNames = defaultToolNames;
  if (options.tools) {
    const toolsArray = parseStringArray(options.tools);
    toolNames = [];
    for (const tool of toolsArray) {
      if (tool.startsWith('preset.') && presetTools[tool as PresetName]) {
        toolNames.push(...presetTools[tool as PresetName]);
      } else {
        toolNames.push(tool as any);
      }
    }
  }

  const filterOptions = {
    allowTools: toolNames,
    tokenMode: TokenMode.AUTO,
    language: options.language,
  };

  let tools = filterTools(allTools, filterOptions);

  // Apply keyword filter
  if (options.filter) {
    const keyword = options.filter.toLowerCase();
    tools = tools.filter(
      (t) =>
        t.name.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword) ||
        t.project.toLowerCase().includes(keyword),
    );
  }

  const output = {
    total: tools.length,
    tools: tools.map((t) => {
      if (options.verbose) {
        return {
          name: t.name,
          description: t.description,
          project: t.project,
          accessTokens: t.accessTokens,
          httpMethod: t.httpMethod,
          path: t.path,
        };
      }
      return {
        name: t.name,
        description: t.description,
      };
    }),
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}
