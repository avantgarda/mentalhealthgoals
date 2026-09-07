/**
 * The one retry policy for the scripts layer.
 *
 * Callers decide what is worth retrying by choosing what to throw. Anything
 * that throws is retried; anything returned is accepted. That distinction
 * matters for media checks, where a 404 is a real answer and retrying it could
 * only produce a slower genuine miss.
 */

export type Logger = Pick<Console, 'warn'>

export type RetryOptions = {
  attempts?: number
  logger?: Logger
  /** Injectable so tests do not spend real time in backoff. */
  sleep?: (milliseconds: number) => Promise<void>
}

export const DEFAULT_RETRY_ATTEMPTS = 3

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 250ms, 500ms, 1s … */
export function backoffDelay(attempt: number): number {
  return 250 * 2 ** (attempt - 1)
}

export async function retry<T>(
  label: string,
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_RETRY_ATTEMPTS
  const sleep = options.sleep ?? defaultSleep
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts) break

      const delay = backoffDelay(attempt)
      options.logger?.warn(`${label} failed (${errorMessage(error)}); retrying in ${delay}ms`)
      await sleep(delay)
    }
  }

  throw new Error(`${label} failed after ${attempts} attempts: ${errorMessage(lastError)}`)
}
