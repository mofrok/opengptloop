import { Router, type Request, type Response } from "express";
import type { MainAgentPromptManager } from "../agents/systemprompts/index.js";

/**
 * Custom System Prompts API — read/CRUD over the Main Agent's saved custom system prompts plus the
 * active selection. These prompts only change the INSTRUCTIONS of the existing Main Agent; they never
 * create a new agent, sub-agent, team, or multi-agent system.
 *
 * The frontend primarily persists prompts through the shared app-state sync (the
 * `mainAgentSystemPrompts` + `activeMainAgentSystemPromptId` documents), exactly like Custom Agents;
 * these endpoints expose the same data through a dedicated, well-typed CRUD surface. Every write goes
 * through the MainAgentPromptManager, which stores configs in the existing SQLite app_state
 * repository — the backend is the source of truth.
 */
export function buildMainAgentPromptsRouter(manager: MainAgentPromptManager): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    const prompts = manager.list();
    res.json({
      ok: true,
      count: prompts.length,
      active_id: manager.getActiveId(),
      prompts,
    });
  });

  router.get("/:id", (req: Request, res: Response) => {
    const prompt = manager.get(String(req.params.id));
    if (!prompt) {
      res.status(404).json({ error: "System prompt not found." });
      return;
    }
    res.json({ ok: true, prompt });
  });

  router.post("/", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "A system prompt name is required." });
      return;
    }
    const prompt = manager.create({
      name,
      description: typeof body.description === "string" ? body.description : "",
      content:
        typeof body.content === "string"
          ? body.content
          : typeof body.system_prompt === "string"
            ? (body.system_prompt as string)
            : typeof body.systemPrompt === "string"
              ? (body.systemPrompt as string)
              : "",
    });
    res.json({ ok: true, prompt });
  });

  router.put("/:id", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Parameters<MainAgentPromptManager["update"]>[1] = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.content === "string") patch.content = body.content;
    else if (typeof body.system_prompt === "string") patch.content = body.system_prompt as string;
    else if (typeof body.systemPrompt === "string") patch.content = body.systemPrompt as string;

    const prompt = manager.update(String(req.params.id), patch);
    if (!prompt) {
      res.status(404).json({ error: "System prompt not found." });
      return;
    }
    res.json({ ok: true, prompt });
  });

  router.delete("/:id", (req: Request, res: Response) => {
    const removed = manager.delete(String(req.params.id));
    res.json({ ok: removed });
  });

  /** Select which saved prompt is active (body: { id: string | null }). null = built-in prompt. */
  router.post("/active", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { id?: unknown };
    const id = typeof body.id === "string" && body.id.trim().length > 0 ? body.id.trim() : null;
    const activeId = manager.setActive(id);
    res.json({ ok: true, active_id: activeId });
  });

  return router;
}
