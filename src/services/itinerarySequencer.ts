import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { bedrockError } from "./bedrockError";
import type { DurationUnit, Experience } from "../types";

/**
 * AI sequencer (the second AI step). Given the recommended experiences and a
 * trip duration, ask Claude (Bedrock, via Converse) to SELECT and ORDER the
 * experiences into a single coherent journey where each leads naturally into
 * the next, choosing a number of stops that suits the duration.
 *
 * Only ids we pass in can be used. Unlike the recommender, this returns an
 * ordered SUBSET — experiences that don't fit the journey are dropped, and the
 * order is meaningful (it becomes the checkpoint order). If Bedrock is
 * unavailable, we fall back to the experiences in the order given so an
 * itinerary can still be built.
 */

const client = new BedrockRuntimeClient({ region: env.bedrockRegion });

const SYSTEM_PROMPT = `You are a travel itinerary planner.
You are given a trip duration and a list of recommended experiences (each has an id, title, category, and description).
Select and order the experiences into a single coherent journey where each one leads naturally into the next — consider flow of energy, time of day, theme, and variety.
Choose how many to include based on the duration: a short duration fits only a few, a longer one fits more. Never include more experiences than were provided.
Only ever use the ids provided. Never invent experiences.
Respond with ONLY a JSON object, no prose, in exactly this shape:
{"orderedExperienceIds": ["<id>", "<id>", ...]}`;

function buildUserMessage(
  experiences: Experience[],
  durationValue: number,
  durationUnit: DurationUnit,
): string {
  const list = experiences
    .map(
      (experience) =>
        `- id: ${experience.experienceId} | ${experience.title} [${experience.category}] — ${experience.description}`,
    )
    .join("\n");

  return `Trip duration: ${durationValue} ${durationUnit}.\n\nRecommended experiences:\n${list}`;
}

interface ParseMatchedIds {
  orderedExperienceIds?: unknown;
}

export async function sequenceExperiences(
  experiences: Experience[],
  durationValue: number,
  durationUnit: DurationUnit,
): Promise<Experience[]> {
  if (!env.bedrockModelId) {
    throw new AppError(500, "AI recommendations are not configured", {
      code: "AI_NOT_CONFIGURED",
      retryable: false,
    });
  }

  if (!env.bedrockModelId || experiences.length === 0) {
    return experiences;
  }

  try {
    const command = new ConverseCommand({
      modelId: env.bedrockModelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            {
              text: buildUserMessage(experiences, durationValue, durationUnit),
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 1024, temperature: 0 },
    });

    const response = await client.send(command);
    const block = response.output?.message?.content?.[0] as
      | { text?: string }
      | undefined;
    const text = block?.text ?? "";

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new AppError(502, "AI returned an unexpected response", {
        code: "AI_BAD_RESPONSE",
        retryable: false,
      });
    }

    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      orderedExperienceIds?: unknown;
    };

    if (!Array.isArray(parsed.orderedExperienceIds)) {
      throw new AppError(502, "AI returned an unexpected response", {
        code: "AI_BAD_RESPONSE",
        retryable: false,
      });
    }

    // Walk the AI's id list (journey order) and resolve each to its experience,
    // dropping any id we don't recognise. Order follows the AI, not the DB.
    const byId = new Map(experiences.map((e) => [e.experienceId, e]));
    const ordered = parsed.orderedExperienceIds
      .map((id) => (typeof id === "string" ? byId.get(id) : undefined))
      .filter(
        (experience): experience is Experience => experience !== undefined,
      );
    return ordered.length > 0 ? ordered : experiences;
  } catch (error) {
    throw bedrockError(error);
  }
}
