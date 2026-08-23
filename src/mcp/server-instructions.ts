import { withOpenCodeToolNames } from './opencode-tool-names';

/**
 * Server-level instructions emitted in the MCP `initialize` response.
 *
 * MCP clients (Claude Code, Cursor, opencode, LangChain, OpenAI Agent
 * SDK, …) surface this text in the agent's system prompt automatically,
 * giving the agent a high-level playbook for the codegraph toolset
 * before it sees individual tool descriptions.
 *
 * Keep this valid for both the default explore-only surface and a custom
 * CODEGRAPH_MCP_TOOLS allowlist. Individual tool descriptions own detailed
 * routing; this shared text only establishes the selection rule and limits.
 * Keep it tight because some clients repeat server instructions alongside
 * every exposed tool description.
 *
 * An OpenCode client gets this text with each tool named the way OpenCode lists
 * it (`codegraph_codegraph_explore`, #1267): see {@link openCodeInstructions}.
 * Write tool names here as the tools are named; the rewrite is applied for it.
 */
export const SERVER_INSTRUCTIONS = `# Codegraph — code intelligence over an indexed knowledge graph

Codegraph provides read-only, line-numbered source and structural relationships
from a pre-built index covering 30+ languages.

## Tool selection

Choose the narrowest exposed tool whose individual description matches the
task. Do not call \`codegraph_explore\` automatically when a focused tool can
answer directly. Use \`codegraph_explore\` for multi-symbol architecture,
end-to-end flow, or an unknown-scope question that needs combined source and
call paths. If it is the only exposed tool, use it for indexed-code lookup.

## Use and limits

- Prefer Codegraph over a grep/Read loop for indexed source, and treat returned
  verbatim source as already read. Do not re-fetch it merely to verify it.
- Use raw Read/Grep for configs, docs, unindexed content, or a file that a
  staleness warning says was omitted or changed after the last index sync.
- The index may lag writes by about one second; cross-file resolution is
  best-effort. Compiler, linter, and tests remain the correctness authority.
- If a project is not indexed, use built-in tools for it. Indexing is the user's
  decision; mention \`codegraph init\` when useful, but do not run it yourself.
`;

/**
 * Instructions variant sent when the server's own root has NO codegraph index.
 *
 * The tools are still exposed (gating tool availability on whether `./` has an
 * index is the bug behind #964: it breaks monorepos where only sub-projects are
 * indexed, and a server that started before `codegraph init` never surfaces the
 * tools afterward). Instead of an "inactive" note, this variant tells the agent
 * codegraph works **per project**: there's no default project to query, so pass
 * a `projectPath` to any project that HAS a `.codegraph/`. The full single-
 * project playbook ({@link SERVER_INSTRUCTIONS}) is sent instead when the root
 * IS indexed, so the common case stays tight.
 */
export const SERVER_INSTRUCTIONS_NO_ROOT_INDEX = `# Codegraph — available per project

This server has no default \`.codegraph/\` index, but its read-only tools can
query any indexed project. Choose the narrowest exposed tool whose individual
description matches the task.

- To query a project that HAS a \`.codegraph/\` index (e.g. a service inside a
  monorepo, or a second repo), pass its path as \`projectPath\` to any Codegraph
  tool. It resolves the nearest index at or above that path.
- For a project with no \`.codegraph/\`, use your built-in tools (Read/Grep/Glob)
  for that project. Indexing is the user's decision — don't run it yourself, but
  if it comes up they can run \`codegraph init\` in a project to enable codegraph
  there (a new index is picked up live, no restart).
`;

/**
 * The sentence an OpenCode client gets under the instructions' title (#1267):
 * why every tool name starts with the server's key, and what changes when the
 * server is registered under a key other than the one `codegraph install` writes.
 */
export const OPENCODE_SERVER_KEY_NOTE =
  "In OpenCode each tool's name starts with this server's key, so the tool names below begin with " +
  '`codegraph_codegraph_`; if the server is registered under another key, that key replaces the first `codegraph_`.';

/**
 * What an OpenCode client gets in place of `instructions` (#1267): the same
 * text, with each of `toolNames` written the way OpenCode lists it and
 * {@link OPENCODE_SERVER_KEY_NOTE} under the title. Nothing else changes, so
 * the `codegraph` CLI commands and `CODEGRAPH_*` variables read as they do for
 * every other client. See `./opencode-tool-names`.
 */
export function openCodeInstructions(instructions: string, toolNames: readonly string[]): string {
  const renamed = withOpenCodeToolNames(instructions, toolNames);
  const titleEnd = renamed.indexOf('\n');
  if (titleEnd === -1) return `${renamed}\n\n${OPENCODE_SERVER_KEY_NOTE}`;
  return `${renamed.slice(0, titleEnd + 1)}\n${OPENCODE_SERVER_KEY_NOTE}\n${renamed.slice(titleEnd + 1)}`;
}
