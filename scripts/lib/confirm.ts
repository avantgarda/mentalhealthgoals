import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

/**
 * The one confirmation contract for destructive scripts.
 *
 * `--yes` is the answer everywhere, so there is a single rule to remember
 * rather than one per script. `envGate` is available for the commands that can
 * irreversibly prune a store, where a second deliberate opt-in is worth the
 * friction. Scripts with further guards of their own keep them: this covers the
 * prompt, not a script's own policy.
 */

export type ConfirmOptions = {
  /** Exact phrase the operator must type. Shown in the prompt. */
  phrase: string
  /** True when `--yes` was passed. */
  yes: boolean
  /**
   * Environment variable that must equal `'1'` before `--yes` is honoured. Omit
   * for commands where `--yes` alone is sufficient.
   */
  envGate?: string
  /** Extra context printed above the prompt. */
  preamble?: string[]
  env?: Partial<Record<string, string>>
  isTTY?: boolean
  logger?: Pick<Console, 'log'>
}

export async function confirmDestructive(options: ConfirmOptions): Promise<void> {
  const { envGate, phrase, preamble = [], yes } = options
  const env = options.env ?? process.env
  const logger = options.logger ?? console
  const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY)

  if (yes) {
    if (envGate && env[envGate] !== '1') {
      throw new Error(`--yes requires ${envGate}=1 so unattended writes are explicitly opted in`)
    }
    return
  }

  if (!isTTY) {
    throw new Error(
      `Cannot request confirmation without a TTY. Use --yes${envGate ? ` with ${envGate}=1` : ''}.`,
    )
  }

  for (const line of preamble) logger.log(line)

  const readline = createInterface({ input, output })
  try {
    const answer = await readline.question(`Type ${phrase} to continue: `)
    if (answer !== phrase) {
      throw new Error('Confirmation did not match; no changes were made')
    }
  } finally {
    readline.close()
  }
}
