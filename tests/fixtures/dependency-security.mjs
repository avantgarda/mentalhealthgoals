import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Resolve through the consuming packages, so a different hoisted copy cannot
// make these checks pass while Payload or ESLint still uses a vulnerable one.
const require = createRequire(import.meta.url)
const payloadRequire = createRequire(require.resolve('payload'))
const eslintRequire = createRequire(require.resolve('eslint'))
const minimatchRequire = createRequire(eslintRequire.resolve('minimatch'))

const scenario = process.argv[2]

if (scenario === 'payload-websocket' || scenario === 'native-websocket') {
  const WebSocket =
    scenario === 'payload-websocket' ? payloadRequire('undici').WebSocket : globalThis.WebSocket
  const sockets = new Set()
  const server = createServer()
  server.on('upgrade', (request, socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    assert.equal(request.headers['sec-websocket-protocol'], undefined)
    const accept = createHash('sha1')
      .update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n` +
        'Sec-WebSocket-Protocol: unrequested\r\n\r\n',
    )
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}`)
      socket.addEventListener('open', () =>
        reject(new Error('Accepted an unrequested subprotocol')),
      )
      socket.addEventListener('error', resolve, { once: true })
    })
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise((resolve) => server.close(resolve))
  }
} else if (scenario === 'payload-balanced-pool') {
  const { BalancedPool } = payloadRequire('undici')
  const rejected = new Error('Custom connection policy rejected this upstream')
  const pool = new BalancedPool('https://127.0.0.1:1', {
    connect: (_options, callback) => callback(rejected),
  })
  try {
    await assert.rejects(pool.request({ path: '/', method: 'GET' }), (error) => error === rejected)
  } finally {
    await pool.close()
  }
} else if (scenario === 'payload-safe-fetch') {
  const moduleURL = pathToFileURL(join(dirname(require.resolve('payload')), 'uploads/safeFetch.js'))
  const { safeFetch } = await import(moduleURL.href)
  for (const address of ['http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/']) {
    await assert.rejects(safeFetch(address), /private or internal address/)
  }
} else {
  const expand = minimatchRequire('brace-expansion')
  if (scenario === 'brace-comma') {
    assert.ok(expand('{' + '{a},'.repeat(10000) + 'b}').length > 0)
  } else if (scenario === 'brace-nesting') {
    assert.ok(expand('{'.repeat(10000) + 'a,b' + '}'.repeat(10000)).length > 0)
  } else if (scenario === 'brace-rewrite') {
    assert.ok(expand('{a}' + '}'.repeat(128000) + ',z}').length > 0)
  } else if (scenario === 'brace-normal') {
    assert.deepEqual(expand('src/{collections,utilities}/*.{ts,tsx}'), [
      'src/collections/*.ts',
      'src/collections/*.tsx',
      'src/utilities/*.ts',
      'src/utilities/*.tsx',
    ])
  } else {
    throw new Error(`Unknown security regression scenario: ${scenario}`)
  }
}

console.log(JSON.stringify({ scenario, ok: true }))
