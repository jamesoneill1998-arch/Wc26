import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeNext, signInHref } from '../src/state/signin.js'

test('after sign-in, only pages inside the planner are allowed', () => {
  assert.equal(safeNext('/app/data'), '/app/data')
  assert.equal(safeNext('/app'), '/app')
  for (const bad of ['//evil.example', 'https://evil.example', '/app/../x', '/app/data?x=1', '/signin', 'javascript:alert(1)', '', null, undefined, 42]) {
    assert.equal(safeNext(bad), '/app/overview', String(bad))
  }
})

test('sign-in links carry the return page and the chosen plan', () => {
  assert.equal(signInHref(), '#/signin')
  assert.equal(signInHref('/app/data'), '#/signin?next=%2Fapp%2Fdata')
  assert.equal(signInHref(null, 'team'), '#/signin?plan=team')
  assert.equal(signInHref('https://evil.example', 'pro'), '#/signin?next=%2Fapp%2Foverview&plan=pro')
})
