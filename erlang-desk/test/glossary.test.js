import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TERMS, termFor } from '../src/glossary.js'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

test('in-app explanations use the published glossary wording', () => {
  const page = readFileSync(new URL('../public/glossary.html', import.meta.url), 'utf8')
  for (const [key, t] of Object.entries(TERMS)) {
    assert.ok(page.includes(`<dt id="${key}">${esc(t.term)}</dt>\n<dd>${esc(t.text)}</dd>`), `glossary.html is out of step for "${key}"`)
  }
  assert.equal((page.match(/<dt /g) ?? []).length, Object.keys(TERMS).length)
})

test('labels are matched to their terms', () => {
  assert.equal(termFor('Shrinkage applied'), 'shrinkage')
  assert.equal(termFor('Maximum occupancy'), 'occupancy')
  assert.equal(termFor('Monthly attrition, UK'), 'attrition')
  assert.equal(termFor('Hiring lead time'), 'ramp-up')
  assert.equal(termFor('Backtest accuracy'), 'forecast-accuracy')
  assert.equal(termFor('Bias'), 'bias')
  assert.equal(termFor('Erlang A'), 'erlang-a')
  assert.equal(termFor('AHT change'), 'aht')
  for (const plain of ['Name', 'Owner', 'Hires', 'Volume change', 'Class starts', null, undefined, 42]) assert.equal(termFor(plain), null, String(plain))
})
