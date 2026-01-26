#!/usr/bin/env node

/**
 * Converts a JSON locale object to .po file format (gettext)
 * @param {Object} jsonLocale - JSON locale object with nested keys
 * @param {Object} potEntries - Map of msgid strings from .pot file
 * @param {string} localeCode - Locale code (e.g., 'en-US', 'es-ES')
 * @returns {string} .po file content
 */
function jsonToPo (jsonLocale, potEntries, localeCode) {
  const lines = []

  // Header
  lines.push('# Translation file for SendWithUs templates')
  lines.push(`# Language: ${localeCode}`)
  lines.push('# Generated automatically')
  lines.push('')
  lines.push('msgid ""')
  lines.push('msgstr ""')
  lines.push('"Content-Type: text/plain; charset=UTF-8\\n"')
  lines.push('"Language: ' + localeCode + '\\n"')
  lines.push('')

  // Convert each pot entry
  for (const [msgid, context] of Object.entries(potEntries)) {
    // Find matching translation in JSON
    const msgstr = findTranslationInJson(jsonLocale, msgid, context) || msgid

    // Escape special characters for .po format
    const escapedMsgid = escapePoString(msgid)
    const escapedMsgstr = escapePoString(msgstr)

    if (context) {
      lines.push(`msgctxt "${escapePoString(context)}"`)
    }
    lines.push(`msgid "${escapedMsgid}"`)
    lines.push(`msgstr "${escapedMsgstr}"`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Finds a translation in the JSON locale object
 * @param {Object} jsonLocale - JSON locale object
 * @param {string} msgid - Message ID to find
 * @param {string} [context] - Optional context
 * @returns {string|undefined} Translation or undefined if not found
 */
function findTranslationInJson (jsonLocale, msgid, context) {
  // Try to find exact match first
  // This is a simplified version - in practice, you'd need to map
  // the .pot msgid strings to your JSON locale keys
  // For now, we'll do a simple search

  // Remove trans block markers if present
  const cleanMsgid = msgid.replace(/{%\s*trans\s*%}/g, '').replace(/{%\s*endtrans\s*%}/g, '').trim()

  // Search through JSON values
  const searchValue = (obj, target) => {
    for (const [, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Try exact match
        if (value === target || value === cleanMsgid) {
          return value
        }
        // Try with variable placeholders normalized
        const normalizedValue = normalizePlaceholders(value)
        const normalizedTarget = normalizePlaceholders(target)
        if (normalizedValue === normalizedTarget) {
          return value
        }
      } else if (typeof value === 'object' && value !== null) {
        const found = searchValue(value, target)
        if (found) return found
      }
    }
    return undefined
  }

  return searchValue(jsonLocale, cleanMsgid)
}

/**
 * Normalizes placeholders for comparison
 * @param {string} str - String with placeholders
 * @returns {string} Normalized string
 */
function normalizePlaceholders (str) {
  return str
    .replace(/\{\{\s*(\w+)\s*\}\}/g, '{{$1}}')
    .replace(/%\{(\w+)\}/g, '%{$1}')
    .replace(/%s/g, '%s')
}

/**
 * Escapes special characters for .po format
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapePoString (str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Parses a .pot file and extracts msgid entries
 * @param {string} potContent - .pot file content
 * @returns {Object} Map of msgid -> context (or empty string)
 */
function parsePotFile (potContent) {
  const entries = {}
  const lines = potContent.split('\n')

  let currentMsgid = ''
  let currentMsgctxt = ''
  let inMsgid = false
  let msgidBuffer = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('msgctxt ')) {
      // Start of context
      currentMsgctxt = unescapePoString(line.slice(8).replace(/^"/, '').replace(/"$/, ''))
    } else if (line.startsWith('msgid ')) {
      // Start of msgid
      inMsgid = true
      msgidBuffer = []
      const msgidStart = line.slice(6).replace(/^"/, '').replace(/"$/, '')
      if (msgidStart) {
        msgidBuffer.push(msgidStart)
      }
    } else if (line.startsWith('msgstr ')) {
      // End of msgid, start of msgstr
      if (inMsgid && msgidBuffer.length > 0) {
        currentMsgid = msgidBuffer.join('')
        entries[currentMsgid] = currentMsgctxt || ''
        currentMsgctxt = ''
      }
      inMsgid = false
    } else if (inMsgid && line.startsWith('"') && line.endsWith('"')) {
      // Continuation of msgid
      msgidBuffer.push(line.slice(1, -1))
    }
  }

  // Handle last entry if file doesn't end with msgstr
  if (inMsgid && msgidBuffer.length > 0) {
    currentMsgid = msgidBuffer.join('')
    entries[currentMsgid] = currentMsgctxt || ''
  }

  return entries
}

/**
 * Unescapes .po format strings
 * @param {string} str - Escaped string
 * @returns {string} Unescaped string
 */
function unescapePoString (str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/**
 * Creates a ZIP file containing multiple .po files
 * @param {Object} poFiles - Map of locale code -> .po file content
 * @param {string} outputPath - Path to save ZIP file
 * @returns {Promise<string>} Path to created ZIP file
 */
async function createPoZip (poFiles, outputPath) {
  // Note: This requires a zip library. For now, we'll use a simple approach
  // In production, you'd want to use a library like 'archiver' or 'yazl'
  // For now, we'll create a function that can be implemented with a zip library

  throw new Error('createPoZip requires a zip library. Install "archiver" or "yazl" and implement this function.')
}

module.exports = {
  jsonToPo,
  parsePotFile,
  findTranslationInJson,
  escapePoString,
  unescapePoString,
  createPoZip
}
