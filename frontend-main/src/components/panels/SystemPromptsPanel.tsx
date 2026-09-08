import { useEffect, useState } from "react";
import { Check, Pencil, Plus, RefreshCw, ScrollText, Sparkles, Trash2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { fetchMainAgentSystemPrompt } from "@/lib/customAgentTools";
import { Modal } from "@/components/ui/Modal";
import { Button, EmptyState, Field, PanelHeader, TextArea, TextInput, Toggle } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

const NAME_MAX = 70;
const DESC_MAX = 300;

interface Draft {
  id: string | null;
  name: string;
  description: string;
  content: string;
}

const empty = (): Draft => ({ id: null, name: "", description: "", content: "" });

/**
 * Custom System Prompts panel.
 *
 * Lets the user manage multiple named system prompts for the EXISTING Main Agent and choose which one
 * is active. The active prompt only changes the Main Agent's INSTRUCTIONS for future turns — it never
 * creates a new agent, sub-agent, or team. Only one prompt is active at a time; when none is active
 * the Main Agent uses its built-in system prompt.
 *
 * Creating a prompt pre-fills the editor with the Main Agent's own built-in prompt (a template the
 * user can edit), with a Reload button to fetch the built-in prompt again at any time. The backend is
 * the source of truth: saved prompts + the active selection persist through the shared app-state sync
 * and the backend applies the active prompt to each Main Agent turn.
 */
export function SystemPromptsPanel() {
  const prompts = useStore((s) => s.mainAgentSystemPrompts);
  const activeId = useStore((s) => s.activeMainAgentSystemPromptId);
  const addSystemPrompt = useStore((s) => s.addSystemPrompt);
  const updateSystemPrompt = useStore((s) => s.updateSystemPrompt);
  const deleteSystemPrompt = useStore((s) => s.deleteSystemPrompt);
  const setActiveSystemPrompt = useStore((s) => s.setActiveSystemPrompt);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Built-in Main Agent prompt load status (used to pre-fill and to reload the default template).
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Auto pre-fill the built-in Main Agent prompt when the CREATE editor opens (only if untouched).
  useEffect(() => {
    if (!draft || draft.id !== null) return;
    const controller = new AbortController();
    setPromptLoading(true);
    setPromptError(null);
    fetchMainAgentSystemPrompt(controller.signal)
      .then((prompt) => {
        if (controller.signal.aborted) return;
        setDraft((d) =>
          d && d.id === null && d.content.trim().length === 0 ? { ...d, content: prompt } : d,
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPromptError("Couldn't load the Main Agent's built-in prompt to pre-fill. You can still write your own.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPromptLoading(false);
      });
    return () => controller.abort();
    // Run only when the editor opens (identified by the draft's id going from null→open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft !== null]);

  // Reload the built-in Main Agent prompt into the editor, replacing the current content. Available
  // in both create and edit so the user can always re-seed from the current default template.
  const reloadDefault = () => {
    setPromptLoading(true);
    setPromptError(null);
    fetchMainAgentSystemPrompt()
      .then((prompt) => setDraft((d) => (d ? { ...d, content: prompt } : d)))
      .catch(() =>
        setPromptError("Couldn't reload the Main Agent's built-in prompt. Check the backend and try again."),
      )
      .finally(() => setPromptLoading(false));
  };

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError("A prompt name is required.");
    if (name.length > NAME_MAX) return setError(`Name must be ${NAME_MAX} characters or fewer.`);
    if (draft.description.length > DESC_MAX)
      return setError(`Description must be ${DESC_MAX} characters or fewer.`);
    if (!draft.content.trim()) return setError("A system prompt is required.");
    const clash = prompts.some(
      (p) => p.id !== draft.id && p.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (clash) return setError(`A system prompt named "${name}" already exists.`);

    const payload = { name, description: draft.description.trim(), content: draft.content };
    if (draft.id) {
      updateSystemPrompt(draft.id, payload);
    } else {
      const created = addSystemPrompt(payload);
      // Activate a newly created prompt so it takes effect on the next Main Agent turn.
      setActiveSystemPrompt(created.id);
    }
    setDraft(null);
    setError(null);
  };

  const builtInActive = !activeId || !prompts.some((p) => p.id === activeId);

  return (
    <div className="mx-auto w-full max-w-2xl panel-in">
      <PanelHeader kicker="Instructions for the Main Agent" title="Custom system prompts" />
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        Save multiple system prompts for the built-in Main Agent and choose which one is active. The
        active prompt changes only the Main Agent's instructions for future runs — it never creates a
        new agent, sub-agent, or team. Only one prompt is active at a time; when none is active the
        Main Agent uses its built-in system prompt.
      </p>

      <div
        className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs text-[var(--muted)]"
        aria-live="polite"
      >
        <ScrollText className="h-3.5 w-3.5 shrink-0 text-[var(--subtle)]" />
        <span>
          Active prompt:{" "}
          <span className="font-medium text-[var(--fg)]">
            {builtInActive ? "Built-in Main Agent prompt" : prompts.find((p) => p.id === activeId)?.name}
          </span>{" "}
          — used by the Main Agent for all future runs.
        </span>
      </div>

      {/* Built-in Main Agent prompt — the default when no custom prompt is active. */}
      <article
        className={cn(
          "mb-3 flex flex-col rounded-[var(--radius-xl)] bg-[var(--bg)] p-5 transition-colors hover:bg-[var(--chip)]",
          builtInActive && "ring-1 ring-[var(--secondary)]",
        )}
        style={{ boxShadow: "var(--shadow-chip)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-[var(--secondary)]" />
            <h3 className="font-serif-display m-0 text-2xl text-[var(--fg)]">Built-in prompt</h3>
            <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--subtle)]">
              default
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Toggle
              checked={builtInActive}
              onChange={() => setActiveSystemPrompt(null)}
              label="Use the built-in Main Agent prompt"
            />
            <span className="text-xs text-[var(--muted)]">{builtInActive ? "Active" : "Use"}</span>
          </div>
        </div>
        <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--muted)]">
          The Main Agent's original system prompt. Selected automatically whenever no custom prompt is
          active.
        </p>
      </article>

      {prompts.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-8 w-8" />}>
          No custom system prompts yet. Create one to customize the Main Agent's instructions.
        </EmptyState>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          {prompts.map((prompt) => {
            const isActive = prompt.id === activeId;
            return (
              <li key={prompt.id}>
                <article
                  className={cn(
                    "flex h-full flex-col rounded-[var(--radius-xl)] bg-[var(--bg)] p-5 transition-colors hover:bg-[var(--chip)]",
                    isActive && "ring-1 ring-[var(--secondary)]",
                  )}
                  style={{ boxShadow: "var(--shadow-chip)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif-display m-0 text-2xl text-[var(--fg)]">{prompt.name}</h3>
                  </div>
                  <p className="line-clamp-2 m-0 mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {prompt.description || "No description."}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <Toggle
                      checked={isActive}
                      onChange={(v) => setActiveSystemPrompt(v ? prompt.id : null)}
                      label={isActive ? "Active prompt" : "Use this prompt"}
                    />
                    <span className="text-xs text-[var(--muted)]">{isActive ? "Active" : "Use"}</span>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 border-t border-[var(--border)] pt-3">
                    <Button
                      variant="ghost"
                      className="px-2"
                      onClick={() => {
                        setError(null);
                        setPromptError(null);
                        setDraft({
                          id: prompt.id,
                          name: prompt.name,
                          description: prompt.description,
                          content: prompt.content,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 text-[var(--subtle)] hover:text-[var(--danger)]"
                      onClick={() => deleteSystemPrompt(prompt.id)}
                      title="Delete system prompt"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <Button
          onClick={() => {
            setError(null);
            setPromptError(null);
            setDraft(empty());
          }}
        >
          <Plus className="h-4 w-4" /> Create system prompt
        </Button>
      </div>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        icon={<ScrollText className="h-4 w-4" />}
        title={draft?.id ? "Edit system prompt" : "New system prompt"}
        size="lg"
        footer={
          <Button onClick={save}>
            <Check className="h-4 w-4" /> Save
          </Button>
        }
      >
        {draft && (
          <div className="space-y-4 p-5">
            <Field
              label="Prompt name"
              hint={`${draft.name.length}/${NAME_MAX}`}
              hintError={draft.name.length > NAME_MAX}
            >
              <TextInput
                value={draft.name}
                maxLength={NAME_MAX}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Concise reviewer"
              />
            </Field>
            <Field
              label="Short description (optional)"
              hint={`${draft.description.length}/${DESC_MAX}`}
              hintError={draft.description.length > DESC_MAX}
            >
              <TextArea
                rows={2}
                maxLength={DESC_MAX}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="A short summary of what this prompt is for."
              />
            </Field>
            <Field
              label={
                <span className="inline-flex items-center gap-2">
                  System prompt
                  {promptLoading && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--subtle)]">
                      <RefreshCw className="h-3 w-3 animate-spin" /> loading Main Agent prompt…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={reloadDefault}
                    disabled={promptLoading}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:border-[var(--secondary)] disabled:opacity-50"
                    title="Reload the Main Agent's built-in system prompt into the editor"
                  >
                    <RefreshCw className={cn("h-3 w-3", promptLoading && "animate-spin")} />
                    Reload default prompt
                  </button>
                </span>
              }
              hint="no limit"
            >
              <TextArea
                rows={14}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                className="font-mono text-xs"
                placeholder="The Main Agent's full system prompt (pre-filled from the built-in prompt — edit freely)."
              />
              <p className="mt-1 text-[10px] text-[var(--subtle)]">
                Pre-filled with the Main Agent's built-in prompt as a template. Use “Reload default
                prompt” to fetch it again. When this prompt is active it replaces the built-in prompt
                for all future Main Agent runs.
              </p>
              {promptError && <p className="mt-1 text-[10px] text-[var(--danger)]">{promptError}</p>}
            </Field>

            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
