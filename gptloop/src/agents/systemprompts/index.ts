/**
 * Custom System Prompts for the existing Main Agent.
 *
 * This module lets the user save multiple named system prompts and choose which one is active. The
 * active prompt REPLACES the built-in Main Agent system prompt for future turns (it does NOT create a
 * new agent, sub-agent, team, or multi-agent system). When no prompt is active the Main Agent uses
 * its built-in prompt. Persistence reuses the SQLite app_state repository; the backend is the source
 * of truth for both the saved prompts and the active selection.
 *
 *   configuration — the persistent MainAgentPromptConfig shape + defensive normalization
 *   manager       — persistent CRUD + active-selection over the existing SQLite app_state repository
 */
export {
  normalizeMainAgentPromptConfig,
  type MainAgentPromptConfig,
  type MainAgentPromptWire,
} from "./configuration.js";
export {
  MainAgentPromptManager,
  type CreateMainAgentPromptInput,
  type UpdateMainAgentPromptInput,
} from "./manager.js";
