import { randomUUID } from "node:crypto";
import { PostHog } from "posthog-node";

const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;

if (process.env.NODE_ENV !== "production") {
  if (!projectToken) {
    console.warn(
      "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured",
    );
  }

  if (!host) {
    console.warn(
      "POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_HOST is configured",
    );
  }
}

export const posthog = projectToken && host
  ? new PostHog(projectToken, { host })
  : undefined;

const aiSessionId = `api-server-${process.pid}`;

type AiGeneration = {
  traceId: string;
  model: string;
  input: unknown;
  startedAt: number;
};

type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export function beginAiGeneration(model: string, input: unknown): AiGeneration {
  return {
    traceId: randomUUID(),
    model,
    input,
    startedAt: Date.now(),
  };
}

export function captureAiGeneration(
  generation: AiGeneration,
  outputChoices: unknown,
  usage: AiUsage = {},
) {
  posthog?.capture({
    distinctId: aiSessionId,
    event: "$ai_generation",
    properties: {
      $ai_session_id: aiSessionId,
      $ai_trace_id: generation.traceId,
      $ai_model: generation.model,
      $ai_provider: "openai",
      $ai_input: generation.input,
      $ai_output_choices: outputChoices,
      $ai_input_tokens: usage.inputTokens ?? 0,
      $ai_output_tokens: usage.outputTokens ?? 0,
      $ai_latency: (Date.now() - generation.startedAt) / 1000,
    },
  });
}
