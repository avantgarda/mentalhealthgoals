# Dependency security review — 2 October 2026

The baseline had 11 open GitHub Dependabot alerts and 13 npm audit findings. Ten concerned
Payload's Undici 7.29.0; three concerned ESLint's brace-expansion 1.1.18. npm reported two
additional high-severity brace-expansion advisories beyond the open GitHub alerts.

## Fixes and dependency constraints

- `payload>undici@7.29.0` resolves to **7.29.1**. Payload 3.90.2, the latest published release
  at review time, declares exactly 7.29.0. A lockfile refresh alone cannot satisfy that pin.
  The parent/version selector changes that one requirement and stops applying when Payload
  changes its Undici requirement; it does not downgrade future releases or replace the
  separate Undici 6.28.1 and 8.11.2 copies.
- `brace-expansion@>=1.0.0 <1.1.21` resolves to **1.1.21**. The affected copy comes through
  ESLint → minimatch 3.1.5. Keep this on its existing major version; the separate 5.0.12 copy
  is already fixed. The selector establishes a floor only for vulnerable 1.x requirements.
- Node **24.21.0** contains bundled Undici **7.29.1**, whereas the local Node 24.19.0 contained
  vulnerable 7.29.0. npm overrides do not change Node's built-in fetch or WebSocket. `.nvmrc`
  selects the fixed runtime, `engines.node` permits later Node 24 releases, and
  `pnpm check:runtime` verifies and logs both actual versions. Deployment builds run that
  check before migrations. Vercel selects and maintains the latest supported 24.x runtime;
  the build guard fails safely if its actual runtime is older than the security floor.

The dependency changes retain all Payload packages at 3.90.2 and introduce no schema or
CMS content changes. The Node upgrade stays within the existing supported major version.

Sources: [Undici 7.29.1 release](https://github.com/nodejs/undici/releases/tag/v7.29.1),
[brace-expansion patch comparison](https://github.com/juliangruber/brace-expansion/compare/v1.1.18...v1.1.21),
[Node 24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0),
[Vercel runtime version policy](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
and [pnpm override selectors](https://pnpm.io/settings/dependency-resolution#overrides).

## Advisory-by-advisory assessment

All Undici rows below are fixed by 7.29.1. All brace-expansion rows are fixed by 1.1.21.
Assessments describe the reviewed source paths, not a proof that every possible dynamically
loaded path is unreachable. We patch the affected dependencies even when the triggering API
is not used by the application.

| GitHub alert | Advisory                                                                                                       | Severity | Trigger and reviewed application use                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #13          | [GHSA-3wwx-pv8p-q78v](https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v)                | Medium   | Malformed compressed WebSocket input can crash a client. Payload uses Node's global WebSocket for local Next development HMR; the reviewed application has no production WebSocket client. Both npm and bundled copies are addressed. |
| #14          | [GHSA-w293-vg96-wgc3](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3)                | High     | BalancedPool drops function-valued connection/TLS options. Payload's upload safeFetch uses Agent with a custom DNS lookup; reviewed application paths do not use BalancedPool. Test custom connection policy preservation.            |
| #15          | [GHSA-rx4f-c7p8-82vq](https://github.com/nodejs/undici/security/advisories/GHSA-rx4f-c7p8-82vq)                | Medium   | Abrupt WebSocketStream closure with a locked writer causes an unhandled rejection. No WebSocketStream use found in reviewed application/Payload paths.                                                                                |
| #16          | [GHSA-8436-99hf-9mmv](https://github.com/nodejs/undici/security/advisories/GHSA-8436-99hf-9mmv)                | Low      | Undici cache interceptor can replay unsafe HTTP methods. No Undici cache interceptor is configured; Next's caching is separate.                                                                                                       |
| #17          | [GHSA-2gqq-gqf2-x968](https://github.com/nodejs/undici/security/advisories/GHSA-2gqq-gqf2-x968)                | Low      | Dump interceptor mishandles oversized chunked bodies. No dump interceptor use found.                                                                                                                                                  |
| #18          | [GHSA-2jfj-6hjv-fm6j](https://github.com/nodejs/undici/security/advisories/GHSA-2jfj-6hjv-fm6j)                | Medium   | Shared Undici caches can replay Set-Cookie across callers. No Undici cache interceptor is configured.                                                                                                                                 |
| #19          | [GHSA-3xpg-4rpp-hhhm](https://github.com/nodejs/undici/security/advisories/GHSA-3xpg-4rpp-hhhm)                | Medium   | Decompression interceptor has unbounded decoded output. No such interceptor is configured; patched default limits still provide protection if it is used later.                                                                       |
| #20          | [GHSA-rfgv-xxqx-mfg5](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5)                | High     | Unrequested WebSocket subprotocol can terminate the process. Test both the actual Payload dependency and Node's native WebSocket with an isolated local malformed handshake.                                                          |
| #21          | [GHSA-r53p-7pc4-xj5r](https://github.com/nodejs/undici/security/advisories/GHSA-r53p-7pc4-xj5r)                | Low      | Retried response framing can split downstream responses in a forwarding proxy. No retry interceptor or such forwarding path found.                                                                                                    |
| #22          | [GHSA-pmjh-fq2x-6v4x](https://github.com/nodejs/undici/security/advisories/GHSA-pmjh-fq2x-6v4x)                | Medium   | RetryHandler can orphan a body after a failed retry. No RetryHandler, RetryAgent or retry interceptor use found.                                                                                                                      |
| #25          | [GHSA-q2hr-2g5m-vwhr](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) | Medium   | Malformed brace rewrites cause quadratic parser work. Affected copy is ESLint tooling; no visitor-supplied glob input path found. Test bounded completion in a child process.                                                         |
| npm audit    | [GHSA-qhr7-859c-m2p7](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7) | High     | Deeply nested brace groups exhaust the stack. Same development-only chain. Test deeply nested input against ESLint's actual dependency.                                                                                               |
| npm audit    | [GHSA-6j4f-fj2g-mc7p](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p) | High     | Long comma-group chains exhaust the parser stack. Same development-only chain. Test long chained input and normal brace-pattern compatibility.                                                                                        |

The installed Undici 6.28.1 (Vercel Blob SDK) and 8.11.2 (jsdom) are above the patched floors
for these advisories. For alert #20, Dependabot's summary reported 6.28.1 as installable while
the affected dependency chain showed 7.29.0. That summary does not establish the cause of
its resolver's version choice. The exact Payload pin is independently verified; it is
addressed explicitly instead of treating the summary as an instruction to downgrade.

## Verification and future updates

`tests/unit/dependencySecurity.spec.ts` resolves packages through their actual consumers.
Each adversarial case runs in a child process with a generous deadline, isolating crashes
and parser stalls. Before the fixes, the npm and native WebSocket cases crashed, the
BalancedPool policy check failed, two brace cases overflowed, and the rewrite case timed
out. Ordinary patterns and Payload's internal-address blocking already passed.

Local verification on Node 24.21.0 passed all **170 integration/unit tests**, including the
eight security regressions, plus lint/format, typecheck, generated-types consistency and
both migration schema modes. The full npm audit fell from **13 findings to zero**; the
separate production audit also reported zero. The old Node runtime was rejected by the
build guard, and the verified fixed runtime passed it. PR CI, preview and deployed-commit
checks remain required in addition to these local results.

Run the regressions and existing integration suite, lint/format, typecheck, generated-types
check, both migration schema modes, production build and end-to-end checks. Audit the full
lockfile and production dependencies with `pnpm audit --json` and `pnpm audit --prod --json`.
Review the Vercel preview and its logged runtime versions before merge; verify the deployed
commit and the open GitHub alert list after merge. Do not dismiss alerts as a substitute
for upgrading their affected dependency.

For future alerts, read the advisory and the complete dependency chain, compare every
installed major-version copy with its patched range, and check Node's bundled libraries
separately. Prefer an upstream compatible patch. When a parent pin prevents that, document
and test a version-scoped override, preserving unaffected major versions. Remove this
Payload override once its upstream requirement is fixed and the resolved graph is secure.

Routine version updates run Mondays at 07:00 Europe/London; security updates attempt fixes
when alerts are detected. The current YAML groups apply to version updates. A failed
automatic security update needs investigation rather than waiting for the weekly run.
See [Dependabot security updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates)
and [dependency resolution errors](https://docs.github.com/en/code-security/reference/supply-chain-security/troubleshoot-dependabot/dependabot-errors).
