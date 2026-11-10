// A small Excel (.xlsx) writer: enough for tidy report sheets, with no
// dependencies. Text is written as inline strings, so a cell starting with
// "=" stays text and can't run as a formula.
//
// sheet: { name, intro?: string[], columns: [{ header, width?, format? }], rows: any[][] }
// format: 'text' (default) | 'int' | 'dec1' | 'dec2' | 'pct' | 'date' (ISO yyyy-mm-dd in, real Excel date out)

const STYLE = { text: 0, header: 1, int: 2, dec1: 3, pct: 4, date: 5, title: 6, dec2: 7 }

const esc = (s) => String(s)
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function colName(i) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** ISO date to an Excel serial day number (1900 date system). */
export function excelDate(iso) {
  const t = Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(t) ? Math.round(t / 864e5) + 25569 : null
}

/** Sheet names: at most 31 characters, none of \ / ? * [ ] :, and unique. */
export function sheetNames(names) {
  const used = new Set()
  return names.map((raw, i) => {
    let base = String(raw ?? '').replace(/[\\/?*[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || `Sheet${i + 1}`
    let name = base
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const tail = ` (${n})`
      name = base.slice(0, 31 - tail.length) + tail
    }
    used.add(name.toLowerCase())
    return name
  })
}

function cell(ref, value, format) {
  if (value == null || value === '') return ''
  if (format === 'date') {
    const n = excelDate(value)
    if (n != null) return `<c r="${ref}" s="${STYLE.date}"><v>${n}</v></c>`
  } else if (format && format !== 'text' && typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${STYLE[format] ?? 0}"><v>${value}</v></c>`
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`
}

function sheetXml(sheet) {
  const intro = sheet.intro ?? []
  const out = []
  let r = 0
  intro.forEach((line, i) => {
    r++
    out.push(`<row r="${r}"><c r="A${r}" t="inlineStr"${i === 0 ? ` s="${STYLE.title}"` : ''}><is><t xml:space="preserve">${esc(line)}</t></is></c></row>`)
  })
  if (intro.length) r++
  const headerRow = ++r
  out.push(`<row r="${r}">${sheet.columns.map((c, i) => `<c r="${colName(i)}${r}" t="inlineStr" s="${STYLE.header}"><is><t xml:space="preserve">${esc(c.header)}</t></is></c>`).join('')}</row>`)
  for (const row of sheet.rows) {
    r++
    out.push(`<row r="${r}">${sheet.columns.map((c, i) => cell(`${colName(i)}${r}`, row[i], c.format)).join('')}</row>`)
  }
  const cols = sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? Math.max(10, Math.min(40, c.header.length + 4))}" customWidth="1"/>`).join('')
  const last = `${colName(sheet.columns.length - 1)}${Math.max(headerRow, r)}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${out.join('')}</sheetData>${sheet.rows.length ? `<autoFilter ref="A${headerRow}:${last}"/>` : ''}</worksheet>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.0"/><numFmt numFmtId="165" formatCode="d mmm yyyy"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF9A9A95"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

let crcTable = null
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A zip archive with stored (uncompressed) entries. */
function zip(files) {
  const enc = new TextEncoder()
  const entries = files.map(([name, text]) => {
    const data = enc.encode(text)
    return { name: enc.encode(name), data, crc: crc32(data) }
  })
  const size = entries.reduce((t, e) => t + 30 + e.name.length + e.data.length + 46 + e.name.length, 22)
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  let o = 0
  const central = []
  for (const e of entries) {
    const at = o
    view.setUint32(o, 0x04034b50, true); view.setUint16(o + 4, 20, true); view.setUint16(o + 6, 0x0800, true); view.setUint16(o + 8, 0, true)
    view.setUint16(o + 10, 0, true); view.setUint16(o + 12, 0x21, true)
    view.setUint32(o + 14, e.crc, true); view.setUint32(o + 18, e.data.length, true); view.setUint32(o + 22, e.data.length, true)
    view.setUint16(o + 26, e.name.length, true); view.setUint16(o + 28, 0, true)
    out.set(e.name, o + 30); out.set(e.data, o + 30 + e.name.length)
    o += 30 + e.name.length + e.data.length
    central.push({ e, at })
  }
  const cdStart = o
  for (const { e, at } of central) {
    view.setUint32(o, 0x02014b50, true); view.setUint16(o + 4, 20, true); view.setUint16(o + 6, 20, true); view.setUint16(o + 8, 0x0800, true); view.setUint16(o + 10, 0, true)
    view.setUint16(o + 12, 0, true); view.setUint16(o + 14, 0x21, true)
    view.setUint32(o + 16, e.crc, true); view.setUint32(o + 20, e.data.length, true); view.setUint32(o + 24, e.data.length, true)
    view.setUint16(o + 28, e.name.length, true)
    view.setUint32(o + 42, at, true)
    out.set(e.name, o + 46)
    o += 46 + e.name.length
  }
  view.setUint32(o, 0x06054b50, true); view.setUint16(o + 8, entries.length, true); view.setUint16(o + 10, entries.length, true)
  view.setUint32(o + 12, o - cdStart, true); view.setUint32(o + 16, cdStart, true)
  return out
}

/** Build a workbook. Returns the file as a Uint8Array. */
export function buildWorkbook(sheets) {
  const names = sheetNames(sheets.map((s) => s.name))
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  return zip([
    ['[Content_Types].xml', `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ])
}
