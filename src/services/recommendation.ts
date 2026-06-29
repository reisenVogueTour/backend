import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../config/env";
import type { Experience } from "../types";
import { AppError } from "../utils/errors";
import { bedrockError } from "./bedrockError";

/**
 * AI matcher. Given a traveler's free-text description and the experiences
 * available in a destination, ask Claude (Amazon Bedrock, via Converse) to
 * return ONLY the experiences that genuinely match.
 *
 * Errors are surfaced, not swallowed: a Bedrock failure (throttle, quota,
 * network, etc.) throws a classified AppError so the route propagates it and the
 * frontend can decide (retry vs fall back). An empty result means the model
 * genuinely found no matches — a legitimate 200, not an error.
 */

const client = new BedrockRuntimeClient({ region: env.bedrockRegion });

const SYSTEM_PROMPT = `You are a travel recommendation engine for a tours marketplace.
You are given a traveler's description of their tastes and goals, and a list of available experiences (each has an id, title, category, and description).
Infer the traveler's interests from their description and return ONLY the experiences that genuinely match.
Do not include experiences that don't fit. If none match, return an empty list.
Only ever use the ids provided. Never invent experiences.
Respond with ONLY a JSON object, no prose, in exactly this shape:
{"matchedExperienceIds": ["<id>", "<id>", ...]}`;

function buildUserMessage(prompt: string, experiences: Experience[]): string {
  const list = experiences
    .map(
      (experience) =>
        `- id: ${experience.experienceId} | ${experience.title} [${experience.category}] — ${experience.description}`,
    )
    .join("\n");

  return `Traveler description:\n"${prompt}"\n\nAvailable experiences:\n${list}`;
}

function parseMatchedIds(text: string): Set<string> {
  let ids: unknown;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    ids = JSON.parse(text.slice(start, end + 1)).matchedExperienceIds;
  } catch {
    ids = undefined;
  }

  if (!Array.isArray(ids)) {
    throw new AppError(502, "AI returned an unexpected response", {
      code: "AI_BAD_RESPONSE",
      retryable: false,
    });
  }

  return new Set(ids.filter((id): id is string => typeof id === "string"));
}

export async function matchExperiences(
  prompt: string,
  experiences: Experience[],
): Promise<Experience[]> {
  if (experiences.length === 0) {
    return [];
  }

  if (!env.bedrockModelId) {
    throw new AppError(500, "AI recommendations are not configured", {
      code: "AI_NOT_CONFIGURED",
      retryable: false,
    });
  }

  let text = "";
  try {
    const response = await client.send(
      new ConverseCommand({
        modelId: env.bedrockModelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [
          {
            role: "user",
            content: [{ text: buildUserMessage(prompt, experiences) }],
          },
        ],
        inferenceConfig: { maxTokens: 1024, temperature: 0 },
      }),
    );
    const block = response.output?.message?.content?.[0] as
      | { text?: string }
      | undefined;
    text = block?.text ?? "";
  } catch (error) {
    throw bedrockError(error);
  }

  const matchedIds = parseMatchedIds(text);

  return experiences.filter((experience) =>
    matchedIds.has(experience.experienceId),
  );
}
