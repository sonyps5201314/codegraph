/**
 * The marker-fenced agent-instructions block the installer writes into each
 * agent's instructions file (CLAUDE.md / AGENTS.md / GEMINI.md / QWEN.md).
 *
 * History: pre-#529 the installer wrote a full usage playbook here, which
 * duplicated the MCP `initialize` instructions for the main agent — so it
 * was removed and `mcp/server-instructions.ts` became the single source of
 * truth. A much smaller block returned for #704, because the MCP
 * instructions cannot reach two audiences that the instructions FILE does
 * reach:
 *
 *  - **Task-tool subagents** — they receive the project instructions file
 *    in their context but NOT the MCP initialize instructions. They hold
 *    the codegraph MCP tools only as deferred names and rarely think to
 *    load them: measured on a forced-delegation flow question (excalidraw,
 *    sonnet, high effort), subagents loaded + used codegraph in ~1 of 9
 *    runs without this block, and consistently with it — including runs
 *    with zero Read/grep fallback.
 *  - **Non-MCP harnesses** — agents with no MCP client at all can still
 *    run the `codegraph explore` CLI, which prints the same output as the
 *    MCP tool.
 *
 * Keep this block SHORT. The main agent reads it every turn on top of the
 * server instructions — the #529 duplication-cost argument still bounds
 * its size. Command names and the two surfaces, nothing more.
 */

import { openCodeToolName, withOpenCodeToolNames } from '../mcp/opencode-tool-names';

/** Markers used by the marker-based section write/removal. */
export const CODEGRAPH_SECTION_START = '<!-- CODEGRAPH_START -->';
export const CODEGRAPH_SECTION_END = '<!-- CODEGRAPH_END -->';

/**
 * The full block, markers included, exactly as written to disk.
 *
 * A global install writes this into a user-scope file (~/.claude/CLAUDE.md,
 * ~/.codex/AGENTS.md) that applies to every project the user opens. Keep the
 * indexed and unindexed paths explicit so agents either use the available
 * graph or initialize it once and fall back cleanly if initialization fails.
 */
export const CODEGRAPH_INSTRUCTIONS_BLOCK = `${CODEGRAPH_SECTION_START}
## CodeGraph

In repositories indexed by CodeGraph (a \`.codegraph/\` directory exists at the repo root), reach for it BEFORE \`rg\`, \`grep\`, \`find\`, or reading files when you need to understand or locate code:

- **MCP tools** (when available): \`codegraph_explore\` and focused query tools — treat each tool's own description as authoritative; do not give any one interface an unconditional preference.
- **Shell** (always works): use the matching \`codegraph\` subcommand, or \`codegraph explore "<symbol names or question>"\` for exploratory queries; run \`codegraph --help\` to see the available commands.

If there is no \`.codegraph/\` directory in the target repository, automatically run \`codegraph init\` from that repository root before using CodeGraph. If initialization fails, report the failure briefly and fall back to \`rg\` for content searches, \`find\` for file and directory discovery, or other built-in file tools as appropriate.
${CODEGRAPH_SECTION_END}`;

/**
 * OpenCode's block (#1267): the same text, with the MCP tool named the way
 * OpenCode lists it, and one sentence more. OpenCode registers a direct MCP tool
 * as `<server key>_<tool name>`, so under the key the installer writes,
 * `codegraph_explore` is `codegraph_codegraph_explore` there; the plain block
 * sent its agents (subagents included) after a tool that doesn't exist.
 *
 * The sentence names the tool both ways, because the file can be shared: the
 * project's `AGENTS.md` is read by Codex, Droid, Kimi and Pi as well, and
 * dotfiles often link several agents' files to one. So this block serves every
 * agent reading it, and an agent writing the plain block keeps this one where
 * it finds it (`upsertInstructionsEntry`) rather than trade blocks with
 * OpenCode on every install. The `codegraph explore` line is the same for all.
 */
export const OPENCODE_INSTRUCTIONS_BLOCK = ((): string => {
  const tool = 'codegraph_explore';
  const renamed = withOpenCodeToolNames(CODEGRAPH_INSTRUCTIONS_BLOCK, [tool]);
  const body = renamed.slice(0, renamed.length - CODEGRAPH_SECTION_END.length);
  return (
    `${body}\nOpenCode puts the MCP server's key in front of each tool's name, so it lists this tool as ` +
    `\`${openCodeToolName(tool)}\` where other agents list \`${tool}\`; if the server is registered under ` +
    `another key, that key replaces the first \`codegraph_\`.\n${CODEGRAPH_SECTION_END}`
  );
})();
