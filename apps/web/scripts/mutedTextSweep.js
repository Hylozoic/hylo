#!/usr/bin/env node
/**
 * Muted-text sweep (D75). Rewrites the faded secondary-text classes text-foreground/50
 * and text-foreground/60 to text-foreground-muted, the colour tuned to at least 4.5:1
 * in every theme (src/themes/index.js, checked by src/themes/contrast.test.js).
 *
 *   node scripts/mutedTextSweep.js           rewrite files under src
 *   node scripts/mutedTextSweep.js --check   list what would change, change nothing
 *
 * Safe to run again: it only touches classes still written the old way, so it can be
 * re-run after other branches merge.
 *
 * Left alone:
 *   - classes behind a variant (hover:, placeholder:, group-hover:, disabled:, data-[…]:
 *     and so on): states and placeholders keep their own look
 *   - icons: the element the class sits on is a lucide-react icon imported in that
 *     file, Icon, InfoButton (its class styles the icon), a component whose name ends
 *     in Icon, or an `.icon` element. Icons need 3:1, which faded foreground already
 *     meets, and they are not body or meta text.
 *   - colours read from a class at runtime (getComputedColor), such as map strokes
 *   - comments, test files and snapshots
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const SCRIPT = fileURLToPath(import.meta.url)
const SRC = path.resolve(path.dirname(SCRIPT), '..', 'src')
const OLD_CLASS = /(^|[\s'"`{(,])(!?)text-foreground\/(50|60)(?![\w/.[-])/g
const NEW_CLASS = 'text-foreground-muted'
const LOOKBACK_LINES = 8

function sourceFiles (dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__snapshots__' ? [] : sourceFiles(full)
    if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) return []
    return [full]
  })
}

// Local names of the lucide-react icons a file imports
export function lucideNames (text) {
  const names = new Set()
  const imports = text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)
  for (const match of imports) {
    match[1].split(',').map(part => part.trim()).filter(Boolean).forEach(part => {
      const [, local] = part.split(/\s+as\s+/)
      names.add((local || part).trim())
    })
  }
  return names
}

const ICON_COMPONENTS = new Set(['Icon', 'InfoButton'])

const isIconTag = (tag, icons) => icons.has(tag) || ICON_COMPONENTS.has(tag) || /Icon$/.test(tag) || /\.icon$/.test(tag)

// The line the match is on
function lineAt (text, index) {
  const start = text.lastIndexOf('\n', index - 1) + 1
  const end = text.indexOf('\n', index)
  return text.slice(start, end === -1 ? text.length : end)
}

const isComment = line => /^\s*(\/\/|\*|\/\*)/.test(line)

// The JSX tag whose attributes contain this position: the nearest `<Tag` before it,
// looking back a few lines, as long as that tag hasn't been closed in between
export function enclosingTag (text, index) {
  let start = index
  for (let i = 0; i < LOOKBACK_LINES && start > 0; i++) start = text.lastIndexOf('\n', start - 1)
  const before = text.slice(Math.max(start, 0), index)
  const tags = [...before.matchAll(/<([A-Za-z][\w.]*)/g)]
  if (tags.length === 0) return null
  const last = tags[tags.length - 1]
  const between = before.slice(last.index)
  // A '>' that isn't part of '=>' closes the opening tag before the class
  if (/(^|[^=])>/.test(between)) return null
  return last[1]
}

export function sweep (text) {
  const icons = lucideNames(text)
  let changed = 0
  let skipped = 0
  const out = text.replace(OLD_CLASS, (match, lead, bang, _shade, offset) => {
    const line = lineAt(text, offset)
    if (isComment(line) || line.includes('getComputedColor(')) return match
    const tag = enclosingTag(text, offset)
    if (tag && isIconTag(tag, icons)) {
      skipped += 1
      return match
    }
    changed += 1
    return `${lead}${bang}${NEW_CLASS}`
  })
  return { out, changed, skipped }
}

function main () {
  const check = process.argv.includes('--check')
  let files = 0
  let total = 0
  let icons = 0
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8')
    const { out, changed, skipped } = sweep(text)
    icons += skipped
    if (changed === 0) continue
    files += 1
    total += changed
    if (check) {
      console.log(`${path.relative(SRC, file)}: ${changed}`)
    } else {
      fs.writeFileSync(file, out)
    }
  }
  console.log(`${check ? 'Would rewrite' : 'Rewrote'} ${total} classes in ${files} files; left ${icons} on icons`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) main()
