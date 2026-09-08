/**
 * Custom System Prompts for the existing Main Agent.
 *
 * A custom system prompt is a saved, user-authored instruction set that REPLACES the built-in Main
 * Agent system prompt for future turns. It is NOT a new agent, sub-agent, team, or multi-agent
 * system — it only changes the INSTRUCTIONS the one existing Main Agent runs with. The Main Agent
 * architecture, tools, runtime, and lifecycle are all unchanged; only the system prompt string it is
 * given differs when a custom prompt is active.
 *
 * Only ONE custom prompt is active at a time. When none is active the Main Agent falls back to the
 * built-in prompt (see agents/systemprompt.ts). Configs persist in the shared SQLite app_state
 * repository (keys `mainAgentSystemPrompts` + `activeMainAgentSystemPromptId`), exactly like Custom
 * Agents — the backend is the source of truth for both the saved prompts and the active selection.
 *
 * This file owns the persistent CONFIGURATION shape and its defensive normalization.
 */
export interface MainAgentPromptConfig {
  /** Stable unique id (16-character alphanumeric). */
  id: string;
  /** Human-readable prompt name (required). */
  name: string;
  /** Optional short description of what this prompt is for. */
  description: string;
  /** The full system-prompt text used verbatim by the Main Agent when this prompt is active. */
  content: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * The over-the-wire (snake_case) shape a prompt config takes when sent from the frontend or stored.
 * Every field is untrusted; both snake_case and camelCase spellings are accepted.
 */
export interface MainAgentPromptWire {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  content?: unknown;
  system_prompt?: unknown;
  systemPrompt?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Defensively normalize an untrusted prompt payload (wire or stored) into a well-formed
 * MainAgentPromptConfig, or `null` when it is unusable (no name). `id`/timestamps fall back to the
 * supplied defaults so this can be reused for both create (mint an id/now) and load (keep existing).
 */
export function normalizeMainAgentPromptConfig(
  raw: unknown,
  defaults: { id: string; now: number },
): MainAgentPromptConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as MainAgentPromptWire;

  const name = str(r.name).trim();
  if (!name) return null;

  // Accept `content` first, then the alternate `system_prompt`/`systemPrompt` spellings.
  const content = str(r.content) || str(r.system_prompt) || str(r.systemPrompt);

  const id = str(r.id).trim() || defaults.id;
  const createdAt = num(r.created_at ?? r.createdAt, defaults.now);
  const updatedAt = num(r.updated_at ?? r.updatedAt, defaults.now);

  return {
    id,
    name,
    description: str(r.description).trim(),
    content,
    createdAt,
    updatedAt,
  };
}
