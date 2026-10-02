// npm overrides cannot update the Undici built into Node's fetch/WebSocket.
// Check before deployment migrations as well as standalone builds, and leave
// the actual platform versions in the build log for verification.
const tuple = (version) => version.replace(/^v/, '').split('.').map(Number)
const atLeast = (version, minimum) => {
  const actual = tuple(version)
  const required = tuple(minimum)
  for (let index = 0; index < required.length; index++) {
    if (actual[index] !== required[index]) return actual[index] > required[index]
  }
  return true
}

const { node, undici } = process.versions
if (tuple(node)[0] !== 24 || !atLeast(node, '24.21.0') || !undici || !atLeast(undici, '7.29.1')) {
  throw new Error(
    `Unsupported runtime: Node ${node}, bundled Undici ${undici ?? 'unknown'}. ` +
      'Use Node 24.21.0 or a later Node 24 release (nvm install && nvm use).',
  )
}
console.log(`Runtime security check passed: Node ${node}, bundled Undici ${undici}`)
