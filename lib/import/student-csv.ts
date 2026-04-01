export type SheetRowStudent = {
  rowIndex: number
  refNo: string
  fullName: string
  email: string
}

function norm(s: string) {
  return s.replace(/\u200b/g, '').trim().toLowerCase()
}

export function detectColumns(header: string[]): { ref: number; name: number; email: number } | null {
  const h = header.map((c) => norm(String(c ?? '')))
  let ref = -1
  let name = -1
  let email = -1
  for (let i = 0; i < h.length; i++) {
    const c = h[i]
    if (email < 0 && c.includes('email')) email = i
    else if (ref < 0 && (c.includes('ref') || /^ref\s*no/.test(c))) ref = i
    else if (name < 0 && c === 'name') name = i
  }
  if (name < 0) name = h.findIndex((c) => c.includes('name') && !c.includes('email'))
  if (ref < 0 || name < 0 || email < 0) return null
  return { ref, name, email }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.length > 0) || rows.length === 0) rows.push(row)
  return rows
}

export function parseStudentsFromCsv(csvText: string): {
  header: string[]
  rows: SheetRowStudent[]
  warnings: string[]
} {
  const values = parseCsv(csvText)
  if (values.length === 0) return { header: [], rows: [], warnings: ['CSV is empty'] }

  const header = values[0].map((c) => String(c ?? ''))
  const cols = detectColumns(header)
  if (!cols) {
    throw new Error(`Could not find ref / name / email columns in CSV header: ${header.join(' | ')}`)
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const warnings: string[] = []
  const deduped = new Map<string, SheetRowStudent>()
  const seenEmail = new Map<string, number>()

  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? []
    const rowIndex = i + 1
    const refNo = String(row[cols.ref] ?? '').trim()
    const fullName = String(row[cols.name] ?? '').replace(/\u200b/g, '').trim()
    const email = String(row[cols.email] ?? '').trim().toLowerCase()

    if (!email && !refNo && !fullName) continue
    if (!email || !emailRe.test(email)) {
      warnings.push(`Row ${rowIndex}: skipped (invalid or missing email)`)
      continue
    }
    if (!refNo) {
      warnings.push(`Row ${rowIndex} (${email}): skipped (missing ref no. / password)`)
      continue
    }
    if (!fullName) {
      warnings.push(`Row ${rowIndex} (${email}): skipped (missing name)`)
      continue
    }
    const prev = seenEmail.get(email)
    if (prev !== undefined) {
      warnings.push(`Duplicate email ${email}: row ${prev} and row ${rowIndex} — using row ${rowIndex}`)
    }
    seenEmail.set(email, rowIndex)
    deduped.set(email, { rowIndex, refNo, fullName, email })
  }

  return { header, rows: Array.from(deduped.values()), warnings }
}
