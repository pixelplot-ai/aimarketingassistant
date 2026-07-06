import { AppError, type AppErrorCode } from "@/lib/errors/app-error"

export type IntegrationErrorCode =
  | AppErrorCode
  | "PLATFORM_NOT_SUPPORTED"
  | "OAUTH_FAILED"
  | "TOKEN_EXPIRED"
  | "PUBLISH_FAILED"
  | "NOT_IMPLEMENTED"

export class IntegrationError extends AppError {
  readonly platformId?: string

  constructor(options: {
    code: IntegrationErrorCode
    message: string
    userMessage?: string
    platformId?: string
    cause?: unknown
  }) {
    super({
      code: options.code === "PLATFORM_NOT_SUPPORTED" ||
        options.code === "OAUTH_FAILED" ||
        options.code === "TOKEN_EXPIRED" ||
        options.code === "PUBLISH_FAILED" ||
        options.code === "NOT_IMPLEMENTED"
        ? "EXTERNAL_SERVICE"
        : options.code,
      message: options.message,
      userMessage: options.userMessage,
      cause: options.cause,
    })
    this.name = "IntegrationError"
    this.platformId = options.platformId
  }

  static notImplemented(platformId: string): IntegrationError {
    return new IntegrationError({
      code: "NOT_IMPLEMENTED",
      message: `${platformId} integration is not implemented`,
      userMessage: `${platformId} is not available yet.`,
      platformId,
    })
  }

  static platformNotSupported(platformId: string): IntegrationError {
    return new IntegrationError({
      code: "PLATFORM_NOT_SUPPORTED",
      message: `Unknown platform: ${platformId}`,
      userMessage: "This platform is not supported.",
      platformId,
    })
  }
}
