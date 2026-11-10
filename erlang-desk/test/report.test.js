import { test } from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import { buildWorkbook, colName, excelDate, sheetNames, crc32 } from '../src/engine/xlsx.js'
import { buildReport } from '../src/state/report.js'
import { buildSampleWorkspace } from '../src/state/sample.js'
import { computeWorkspace } from '../src/engine/compute.js'

/** Read a stored-entry zip back into { name: text }. */
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const dec = new TextDecoder()
  const out = {}
  const eocd = bytes.length - 22
  assert.equal(view.getUint32(eocd, true), 0x06054b50)
  const count = view.getUint16(eocd + 10, true)
  let o = view.getUint32(eocd + 16, true)
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(o, true), 0x02014b50)
    const size = view.getUint32(o + 24, true), nameLen = view.getUint16(o + 28, true), at = view.getUint32(o + 42, true)
    const name = dec.decode(bytes.subarray(o + 46, o + 46 + nameLen))
    assert.equal(view.getUint32(at, true), 0x04034b50)
    const data = bytes.subarray(at + 30 + nameLen, at + 30 + nameLen + size)
    assert.equal(view.getUint32(o + 16, true), zlib.crc32(data), `crc of ${name}`)
    out[name] = dec.decode(data)
    o += 46 + nameLen
  }
  return out
}

test('xlsx helpers: column letters, dates, sheet names, crc', () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(colName), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
  assert.equal(excelDate('1900-03-01'), 61)
  assert.equal(excelDate('2026-11-09'), 46335)
  assert.equal(excelDate('not a date'), null)
  assert.deepEqual(sheetNames(['Plan: a/b', 'Plan: a/b', '', 'x'.repeat(40)]), ['Plan  a b', 'Plan  a b (2)', 'Sheet3', 'x'.repeat(31)])
  const bytes = new TextEncoder().encode('Erlang Desk')
  assert.equal(crc32(bytes), zlib.crc32(bytes))
})

test('xlsx workbook: valid zip, text stays text, numbers and dates are typed', () => {
  const files = unzip(buildWorkbook([{
    name: 'Plan', intro: ['Title', 'A & B <c>'],
    columns: [{ header: 'Week', format: 'date' }, { header: 'Name' }, { header: 'FTE', format: 'dec1' }],
    rows: [['2026-11-09', '=HYPERLINK("http://x")', 12.5], ['2026-11-16', 'ok\u0001', null]],
  }]))
  assert.deepEqual(Object.keys(files).sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'])
  const sheet = files['xl/worksheets/sheet1.xml']
  assert.ok(sheet.includes('<c r="A5" s="5"><v>46335</v></c>'))
  assert.ok(sheet.includes('<c r="B5" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;)</t></is></c>'))
  assert.ok(sheet.includes('<c r="C5" s="3"><v>12.5</v></c>'))
  assert.ok(sheet.includes('A &amp; B &lt;c&gt;'))
  assert.ok(!sheet.includes('\u0001') && !sheet.includes('<f>'))
  assert.ok(sheet.includes('ySplit="4"') && sheet.includes('<autoFilter ref="A4:C6"/>'))
})

test('Excel report: sheets match the plan on screen', () => {
  const ws = buildSampleWorkspace()
  const model = computeWorkspace(ws)
  const sheets = buildReport(ws, model, { today: '2026-11-10' })
  assert.deepEqual(sheets.map((s) => s.name), ['Summary', 'Services', 'Capacity by week', 'Scenarios', 'Hiring', 'Forecast by day', 'Changes', 'Areas by month', 'Sites'])
  const by = Object.fromEntries(sheets.map((s) => [s.name, s]))
  for (const s of sheets) for (const row of s.rows) assert.equal(row.length, s.columns.length, s.name)
  assert.equal(by.Summary.rows.length, model.total.length)
  assert.equal(by.Summary.rows[0][1], model.total[0].requiredFte)
  assert.equal(by.Services.rows.length, ws.services.length)
  assert.equal(by['Capacity by week'].rows.length, ws.services.reduce((t, s) => t + model.services[s.id].sim.length, 0))
  assert.equal(by.Scenarios.rows.length, ws.services.length * 5)
  assert.equal(by.Changes.rows.length, ws.changes.length)
  assert.equal(by.Sites.rows.length, ws.sites.length)
  assert.ok(Math.abs(by.Sites.rows[0][2] - 0.35) < 1e-9)
  const files = unzip(buildWorkbook(sheets))
  assert.equal(Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).length, 9)
})

test('Excel report: an empty workspace still gives a workbook', () => {
  const ws = { name: 'New', sites: [], services: [], areas: [], changes: [] }
  const sheets = buildReport(ws, { services: {}, total: [] })
  assert.ok(sheets.length >= 6)
  assert.ok(buildWorkbook(sheets).length > 1000)
})
