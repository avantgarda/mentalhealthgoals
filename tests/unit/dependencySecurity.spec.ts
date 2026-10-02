// @vitest-environment node
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const run = promisify(execFile)
const fixture = fileURLToPath(new URL('../fixtures/dependency-security.mjs', import.meta.url))

describe('dependency security regressions', () => {
  // Isolate crashes and blocked event loops from Vitest. A generous process
  // deadline catches the old quadratic parser without relying on millisecond
  // performance assertions on shared CI runners.
  it.each([
    ['payload-websocket', 'Payload rejects an unrequested WebSocket subprotocol without crashing'],
    ['native-websocket', 'Node rejects an unrequested WebSocket subprotocol without crashing'],
    ['payload-balanced-pool', 'Payload preserves a custom BalancedPool connection policy'],
    ['payload-safe-fetch', 'Payload still blocks internal upload destinations'],
    ['brace-comma', 'ESLint brace parsing survives long chains of comma groups'],
    ['brace-nesting', 'ESLint brace parsing survives deeply nested groups'],
    ['brace-rewrite', 'ESLint brace parsing finishes malformed rewrite input within the deadline'],
    ['brace-normal', 'ordinary ESLint brace patterns still expand correctly'],
  ])(
    '%s: %s',
    async (scenario) => {
      const { stdout } = await run(process.execPath, [fixture, scenario], { timeout: 10000 })
      expect(JSON.parse(stdout)).toEqual({ scenario, ok: true })
    },
    15000,
  )
})
