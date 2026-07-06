export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "EXTERNAL_SERVICE"
  | "INTERNAL"

export interface AppErrorOptions {
  code: AppErrorCode
  message: string
  userMessage?: string
  cause?: unknown
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly userMessage: string

  constructor({ code, message, userMessage, cause }: AppErrorOptions) {
    super(message, { cause })
    this.name = "AppError"
    this.code = code
    this.userMessage = userMessage ?? message
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError
  }

  static fromUnknown(
    error: unknown,
    fallback: Pick<AppErrorOptions, "code" | "message" | "userMessage"> = {
      code: "INTERNAL",
      message: "An unexpected error occurred",
      userMessage: "Something went wrong. Please try again.",
    },
  ): AppError {
    if (AppError.isAppError(error)) {
      return error
    }

    if (error instanceof Error) {
      return new AppError({
        code: fallback.code,
        message: error.message || fallback.message,
        userMessage: fallback.userMessage,
        cause: error,
      })
    }

    return new AppError(fallback)
  }
}
