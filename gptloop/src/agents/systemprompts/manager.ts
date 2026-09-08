import type { AppStateRepo } from "../../database/repositories/appStateRepo.js";
import { createSystemPromptId } from "../../database/ids.js";
import {
  normalizeMainAgentPromptConfig,
  type MainAgentPromptConfig,
} from "./configuration.js";

/** Fields accepted when creating a custom system prompt (id/timestamps are assigned by the manager). */
export interface CreateMainAgentPromptInput {
  name: string;
  description?: string;
  content: string;
}

/** Fields accepted when updating a custom system prompt (all optional; id/createdAt are immutable). */
export interface UpdateMainAgentPromptInput {
  name?: string;
  description?: string;
  content?: string;
}

/**
 * MainAgentPromptManager — the persistent store for the Main Agent's custom system prompts.
 *
 * It reuses the application's existing persistence architecture: the saved prompts live in the
 * SQLite-backed `app_state` document keyed `mainAgentSystemPrompts`, and the currently-active prompt
 * id lives in `activeMainAgentSystemPromptId` (the very same documents the frontend syncs to). No new
 * persistence system is introduced. The backend is the SOURCE OF TRUTH for both the saved prompts and
 * the active selection.
 *
 * This manager only changes the INSTRUCTIONS the single existing Main Agent runs with — it never
 * creates a new agent, sub-agent, team, or multi-agent system. Only one prompt is active at a time.
 */
export class MainAgentPromptManager {
  constructor(private readonly appState: AppStateRepo) {}

  /** All stored custom prompts, normalized and newest-first (by createdAt). */
  list(): MainAgentPromptConfig[] {
    const raw = this.appState.get("mainAgentSystemPrompts");
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    const out: MainAgentPromptConfig[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      const config = normalizeMainAgentPromptConfig(item, { id: createSystemPromptId(), now });
      if (!config || seen.has(config.id)) continue;
      seen.add(config.id);
      out.push(config);
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** One custom prompt by id, or null when it does not exist. */
  get(id: string): MainAgentPromptConfig | null {
    if (!id) return null;
    return this.list().find((p) => p.id === id) ?? null;
  }

  /** The id of the active custom prompt, or null when the Main Agent should use its built-in prompt. */
  getActiveId(): string | null {
    const raw = this.appState.get("activeMainAgentSystemPromptId");
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  }

  /** The active custom prompt config, or null when none is active (or the active id is stale). */
  getActive(): MainAgentPromptConfig | null {
    const id = this.getActiveId();
    if (!id) return null;
    return this.get(id);
  }

  /**
   * Resolve the system-prompt TEXT the Main Agent should use for a turn: the active custom prompt's
   * content when one is active AND has non-empty content, otherwise `null` (meaning "use the built-in
   * Main Agent prompt"). This is the single point the agent runtime consults so the built-in prompt is
   * always the safe default.
   */
  resolveActivePromptText(): string | null {
    const active = this.getActive();
    if (!active) return null;
    const content = active.content.trim();
    return content.length > 0 ? content : null;
  }

  /** Create and persist a new custom prompt. Throws when the name is empty. */
  create(input: CreateMainAgentPromptInput): MainAgentPromptConfig {
    const name = (input.name ?? "").trim();
    if (!name) throw new Error("A system prompt name is required.");
    const now = Date.now();
    const config: MainAgentPromptConfig = {
      id: createSystemPromptId(),
      name,
      description: (input.description ?? "").trim(),
      content: input.content ?? "",
      createdAt: now,
      updatedAt: now,
    };
    const all = this.list();
    this.persist([config, ...all]);
    return config;
  }

  /** Update an existing custom prompt. Returns the updated config, or null when it does not exist. */
  update(id: string, patch: UpdateMainAgentPromptInput): MainAgentPromptConfig | null {
    const all = this.list();
    const index = all.findIndex((p) => p.id === id);
    if (index === -1) return null;
    const existing = all[index]!;
    const updated: MainAgentPromptConfig = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
      description: patch.description !== undefined ? patch.description.trim() : existing.description,
      content: patch.content !== undefined ? patch.content : existing.content,
      updatedAt: Date.now(),
    };
    const next = all.slice();
    next[index] = updated;
    this.persist(next);
    return updated;
  }

  /** Delete a custom prompt by id. Returns true when one was removed. Clears the active id if it matched. */
  delete(id: string): boolean {
    const all = this.list();
    const next = all.filter((p) => p.id !== id);
    if (next.length === all.length) return false;
    this.persist(next);
    if (this.getActiveId() === id) this.setActive(null);
    return true;
  }

  /**
   * Select which custom prompt is active (or `null` to fall back to the built-in Main Agent prompt).
   * Returns the active id that was stored. An unknown id is rejected and clears the active selection,
   * so the active id can never point at a non-existent prompt.
   */
  setActive(id: string | null): string | null {
    if (!id) {
      this.appState.set("activeMainAgentSystemPromptId", null);
      return null;
    }
    const exists = this.get(id) !== null;
    const next = exists ? id : null;
    this.appState.set("activeMainAgentSystemPromptId", next);
    return next;
  }

  private persist(configs: MainAgentPromptConfig[]): void {
    this.appState.set("mainAgentSystemPrompts", configs);
  }
}
