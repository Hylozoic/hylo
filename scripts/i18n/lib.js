const fs = require('fs')

function isPlainObject (value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readJson (filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (err) {
    err.message = `Invalid JSON in ${filePath}: ${err.message}`
    throw err
  }
}

function sortLocaleDeep (value) {
  if (Array.isArray(value)) return value.map(sortLocaleDeep)
  if (!isPlainObject(value)) return value

  const sorted = {}
  for (const key of Object.keys(value).sort((a, b) => {
    const lowerA = a.toLowerCase()
    const lowerB = b.toLowerCase()
    if (lowerA !== lowerB) {
      return lowerA.localeCompare(lowerB)
    }
    // If case-insensitive equal, uppercase comes before lowercase
    return a.localeCompare(b, undefined, { sensitivity: 'case' })
  })) {
    sorted[key] = sortLocaleDeep(value[key])
  }
  return sorted
}

function escapeSegment (segment) {
  const simple = /^[A-Za-z0-9_]+$/
  if (simple.test(segment)) return segment
  return `"${segment.replace(/"/g, '\\"')}"`
}

function pathToString (segments) {
  if (segments.length === 0) return '<root>'
  return segments
    .map((segment, index) => {
      const escaped = escapeSegment(segment)
      if (escaped === segment && index === 0) return escaped
      if (escaped === segment) return `.${escaped}`
      return index === 0 ? `[${escaped}]` : `.[${escaped}]`
    })
    .join('')
    .replace(/^\./, '')
}

function walkLocaleEntries (value, callback, path = []) {
  if (typeof value === 'string') {
    callback({ type: 'string', path, value })
    return
  }
  if (Array.isArray(value)) {
    callback({ type: 'array', path, value })
    value.forEach((item, index) => {
      walkLocaleEntries(item, callback, path.concat(String(index)))
    })
    return
  }
  if (isPlainObject(value)) {
    callback({ type: 'object', path, value })
    for (const key of Object.keys(value)) {
      walkLocaleEntries(value[key], callback, path.concat(key))
    }
    return
  }
  callback({ type: typeof value, path, value })
}

function ensureContainer (root, path) {
  let cursor = root
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]
    if (!isPlainObject(cursor[segment])) cursor[segment] = {}
    cursor = cursor[segment]
  }
  return { container: cursor, key: path[path.length - 1] }
}

function getAtPath (root, path) {
  let cursor = root
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) return undefined
    cursor = cursor[segment]
  }
  return cursor
}

function setAtPath (root, path, value) {
  if (path.length === 0) throw new Error('Cannot set value at root without key')
  const { container, key } = ensureContainer(root, path)
  container[key] = value
}

const PLACEHOLDER_PATTERNS = [
  /{{\s*[^}]+\s*}}/g,
  /%\{[^}]+\}/g,
  /%\d?\$?s/g
]

function normalizePlaceholder (placeholder) {
  if (placeholder.startsWith('{{')) {
    const inner = placeholder.slice(2, -2).trim().replace(/\s+/g, ' ')
    return `{{${inner}}}`
  }
  if (placeholder.startsWith('%{')) {
    return `%{${placeholder.slice(2, -1).trim()}}`
  }
  return placeholder
}

function extractPlaceholders (text) {
  const placeholders = new Set()
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(pattern)
    if (!matches) continue
    for (const match of matches) placeholders.add(normalizePlaceholder(match))
  }
  return placeholders
}

module.exports = {
  isPlainObject,
  readJson,
  sortLocaleDeep,
  pathToString,
  walkLocaleEntries,
  getAtPath,
  setAtPath,
  extractPlaceholders
}
