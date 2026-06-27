import { AppError } from "../utils/errors";

/**
 * Map a caught Bedrock/Converse error to an AppError so routes can surface it via
 * next(error) instead of returning a silent empty result. The frontend branches
 * on the HTTP status and the `code`/`retryable` flags in the error body, e.g.
 * 429 -> back off, 503/504 -> retry or fall back, 4xx config -> don't retry.
 *
 * Exception names below are the ones @aws-sdk/client-bedrock-runtime ships for
 * the Converse operation. Response shape (via errorHandler):
 *   { success:false, message, errors:{ code, retryable } }
 */
export function bedrockError(error: unknown): AppError {
  const name = (error as { name?: string })?.name ?? "";
  const code = (error as { code?: string })?.code ?? "";

  switch (name) {
    case "ThrottlingException":
      return new AppError(429, "AI is rate limited — please retry shortly", {
        code: "AI_RATE_LIMITED",
        retryable: true,
      });
    case "ServiceQuotaExceededException":
      return new AppError(429, "AI usage quota has been exceeded", {
        code: "AI_QUOTA_EXCEEDED",
        retryable: false,
      });
    case "ModelTimeoutException":
      return new AppError(504, "The AI request timed out", {
        code: "AI_TIMEOUT",
        retryable: true,
      });
    case "ModelNotReadyException":
    case "ServiceUnavailableException":
    case "InternalServerException":
      return new AppError(503, "AI is temporarily unavailable", {
        code: "AI_UNAVAILABLE",
        retryable: true,
      });
    case "ModelErrorException":
      return new AppError(502, "The AI model failed to process the request", {
        code: "AI_MODEL_ERROR",
        retryable: true,
      });
    case "AccessDeniedException":
      // Missing IAM permission.
      return new AppError(500, "AI access is not configured", {
        code: "AI_ACCESS_DENIED",
        retryable: false,
      });
    case "ResourceNotFoundException":
      // Wrong/unknown model id.
      return new AppError(500, "The configured AI model was not found", {
        code: "AI_MODEL_NOT_FOUND",
        retryable: false,
      });
    case "ValidationException":
      // The request built was rejected.
      return new AppError(500, "The AI rejected the request", {
        code: "AI_INVALID_REQUEST",
        retryable: false,
      });
    default:
      break;
  }

  // Network-level failures carry no SDK exception name.
  if (
    name === "TimeoutError" ||
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(code)
  ) {
    return new AppError(503, "Could not reach the AI service", {
      code: "AI_UNREACHABLE",
      retryable: true,
    });
  }

  return new AppError(502, "The AI request failed", {
    code: "AI_REQUEST_FAILED",
    retryable: true,
  });
}
