"use client";

import { useState, useTransition } from "react";
import { Check, KeyRound, LoaderCircle, Sparkles } from "lucide-react";

import { saveAIProvider } from "@/actions/ai-settings";
import { AINotice } from "@/components/feedback/AINotice";
import {
  AI_PROVIDER_LABELS,
  type AIProvider,
  type AIProviderStatus,
  type AISettings,
} from "@jobhunt/shared/ai";

type Props = { settings: AISettings; providers: AIProviderStatus[] };

export function AISettingsForm({ settings, providers }: Props) {
  const [savedProvider, setSavedProvider] = useState(settings.provider);
  const [selected, setSelected] = useState<AIProvider>(settings.provider);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const configured = providers.find(
    (provider) => provider.id === selected,
  )?.configured;

  function handleSave(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await saveAIProvider(selected);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setSavedProvider(result.data.provider);
        setSaved(true);
      } catch {
        setError(
          "Could not reach the server. Check your connection and try again.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-accent-muted p-2 text-accent">
          <Sparkles aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            AI provider
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Choose the provider for job matching, resumes, and company research.
          </p>
        </div>
      </div>
      <fieldset disabled={isPending} className="mt-6">
        <legend className="sr-only">Default AI provider</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {providers.map((provider) => (
            <label
              key={provider.id}
              className={`flex cursor-pointer flex-col gap-4 rounded-xl border p-4 transition-colors ${selected === provider.id ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent"} ${!provider.configured ? "cursor-not-allowed" : ""}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  {AI_PROVIDER_LABELS[provider.id]}
                </span>
                <input
                  type="radio"
                  name="provider"
                  value={provider.id}
                  checked={selected === provider.id}
                  disabled={!provider.configured}
                  onChange={() => {
                    setSelected(provider.id);
                    setSaved(false);
                    setError(null);
                  }}
                  className="h-4 w-4 accent-accent focus-visible:outline-accent"
                />
              </span>
              <span className="break-all text-xs text-text-secondary">
                {provider.model}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${provider.configured ? "bg-success-lightest text-success-foreground" : "bg-surface-secondary text-text-secondary"}`}
                >
                  {provider.configured ? "Key configured" : "API key needed"}
                </span>
                {savedProvider === provider.id && (
                  <span className="rounded-full bg-accent-muted px-2 py-1 text-xs font-medium text-accent">
                    Current default
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex items-start gap-2 rounded-lg bg-surface-secondary p-4 text-sm leading-6 text-text-secondary">
        <KeyRound aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
        <p>
          API keys are configured securely on the server. If a provider reaches
          its limit, users see a notice and you can switch the default here. New
          requests use the saved provider.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-xs text-text-secondary">
          Gemini is the default for new installations.
        </p>
        <button
          type="submit"
          disabled={isPending || !configured || selected === savedProvider}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending && (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          )}
          {isPending ? "Saving…" : "Save provider"}
        </button>
      </div>
      {error && (
        <div className="mt-4">
          <AINotice failure={{ error }} />
        </div>
      )}
      {saved && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 text-sm text-success-foreground"
        >
          <Check aria-hidden="true" className="h-4 w-4" />
          {AI_PROVIDER_LABELS[savedProvider]} is now the default for everyone.
        </p>
      )}
    </form>
  );
}
