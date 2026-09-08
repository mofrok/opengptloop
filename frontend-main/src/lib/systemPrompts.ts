import type { SystemPrompt } from "@/types";

/**
 * Custom System Prompts — saved instruction sets for the EXISTING Main Agent.
 *
 * A custom system prompt only changes the Main Agent's INSTRUCTIONS for future turns. It is NOT a new
 * agent, sub-agent, team, or multi-agent system. Only one prompt is active at a time; when none is
 * active the Main Agent uses its built-in system prompt. The backend is the source of truth — the
 * saved prompts and the active selection persist through the shared app-state sync
 * (`mainAgentSystemPrompts` + `activeMainAgentSystemPromptId`), and the backend applies the active
 * prompt to each Main Agent turn.
 *
 * This module owns the defensive normalization used when hydrating persisted state.
 */

/** Defensive normalize of one stored/loaded system prompt into a well-formed value. */
export function normalizeSystemPrompt(raw: unknown): SystemPrompt | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!id || !name) return null;
  const content =
    typeof r.content === "string"
      ? r.content
      : typeof (r as { system_prompt?: unknown }).system_prompt === "string"
        ? ((r as { system_prompt: string }).system_prompt)
        : typeof (r as { systemPrompt?: unknown }).systemPrompt === "string"
          ? ((r as { systemPrompt: string }).systemPrompt)
          : "";
  return {
    id,
    name,
    description: typeof r.description === "string" ? r.description : "",
    content,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
  };
}

/** Normalize a persisted array of system prompts, dropping malformed entries and duplicate ids. */
export function normalizeSystemPrompts(raw: unknown): SystemPrompt[] {
  if (!Array.isArray(raw)) return [];
  const out: SystemPrompt[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const prompt = normalizeSystemPrompt(item);
    if (!prompt || seen.has(prompt.id)) continue;
    seen.add(prompt.id);
    out.push(prompt);
  }
  return out;
}
