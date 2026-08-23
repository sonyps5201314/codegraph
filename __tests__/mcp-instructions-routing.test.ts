import { describe, expect, it } from 'vitest';
import {
  SERVER_INSTRUCTIONS,
  SERVER_INSTRUCTIONS_NO_ROOT_INDEX,
} from '../src/mcp/server-instructions';
import { tools } from '../src/mcp/tools';

describe('MCP tool routing instructions', () => {
  it('keeps shared guidance valid for a multi-tool allowlist', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/narrowest exposed tool/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/multi-symbol architecture/i);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/there is a single tool/i);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/call `codegraph_explore` before/i);
  });

  it('does not present explore as the unconditional primary tool', () => {
    const explore = tools.find((tool) => tool.name === 'codegraph_explore');
    expect(explore).toBeDefined();
    expect(explore!.description).toMatch(/multi-symbol architecture/i);
    expect(explore!.description).toMatch(/narrower exposed tool/i);
    expect(explore!.description).not.toMatch(/PRIMARY TOOL|ONLY call/i);
  });

  it('keeps no-root guidance tool-neutral', () => {
    expect(SERVER_INSTRUCTIONS_NO_ROOT_INDEX).toMatch(/narrowest exposed tool/i);
    expect(SERVER_INSTRUCTIONS_NO_ROOT_INDEX).toMatch(/any Codegraph\s+tool/i);
    expect(SERVER_INSTRUCTIONS_NO_ROOT_INDEX).not.toMatch(/one `codegraph_explore`/i);
  });
});
