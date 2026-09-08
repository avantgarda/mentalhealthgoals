import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessChange, validatePlan, type ContentChange } from './content-patch-core'

const change: ContentChange = {
  collection: 'workstreams',
  match: { field: 'slug', value: 'example' },
  before: {
    title: 'Original',
    resources: [{ id: 'existing', label: 'Site', url: 'https://example.org' }],
  },
  after: {
    title: 'Revised',
    resources: [{ id: 'existing', label: 'Site', url: 'https://example.org' }],
  },
}

test('matches content independently of environment-specific record IDs', () => {
  assert.equal(assessChange({ id: 900, ...change.before }, change), 'ready')
})
test('a repeated run does not apply the change twice', () => {
  assert.equal(assessChange({ id: 900, ...change.after }, change), 'already applied')
})
test('refuses intervening edits, including edits inside nested arrays', () => {
  assert.throws(
    () => assessChange({ ...change.before, title: 'Editor revision' }, change),
    /baseline/,
  )
  assert.throws(() => assessChange({ ...change.before, resources: [] }, change), /baseline/)
})
test('reversal only accepts the expected revised content', () => {
  const reverse = { ...change, before: change.after, after: change.before }
  assert.equal(assessChange(change.after, reverse), 'ready')
  assert.equal(assessChange(change.before, reverse), 'already applied')
  assert.throws(() => assessChange({ ...change.after, title: 'Later work' }, reverse), /baseline/)
})
test('only allows reviewed content fields and one entry per target', () => {
  const plan = { version: 1, name: 'Example', changes: [change] }
  assert.equal(validatePlan(plan), plan)
  assert.throws(() => validatePlan({ ...plan, changes: [change, change] }), /Duplicate/)
  assert.throws(
    () =>
      validatePlan({
        ...plan,
        changes: [{ ...change, before: { slug: 'a' }, after: { slug: 'b' } }],
      }),
    /field/,
  )
  assert.throws(
    () => validatePlan({ ...plan, changes: [{ ...change, collection: 'users' }] }),
    /Invalid/,
  )
  assert.throws(() => validatePlan({ ...plan, changes: [{ ...change, before: {} }] }), /field/)
})
