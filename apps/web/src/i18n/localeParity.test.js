import fs from 'fs'
import path from 'path'

// English is the source of truth: every key it has must be translated in every
// other locale, and a translation must keep the {{placeholders}} i18next fills
// in (a renamed or translated placeholder renders as raw braces)
const LOCALES_DIR = path.resolve(__dirname, '../../public/locales')
const PLACEHOLDER = /{{\s*([^}]+?)\s*}}/g

const readLocale = locale => JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8'))
const placeholdersIn = text => new Set([...text.matchAll(PLACEHOLDER)].map(match => match[1].replace(/\s+/g, ' ')))
const sameSet = (a, b) => a.size === b.size && [...a].every(item => b.has(item))

const en = readLocale('en')
const locales = fs.readdirSync(LOCALES_DIR)
  .filter(name => name.endsWith('.json') && name !== 'en.json')
  .map(name => name.replace(/\.json$/, ''))

it('checks every supported language', () => {
  expect(locales).toEqual(expect.arrayContaining(['de', 'es', 'fr', 'hi', 'pt']))
})

describe.each(locales)('%s.json', locale => {
  const translations = readLocale(locale)

  it('translates every English key', () => {
    const missing = Object.keys(en).filter(key => typeof translations[key] !== 'string')
    expect(missing).toEqual([])
  })

  it('keeps the English placeholders', () => {
    const mismatched = Object.keys(en)
      .filter(key => typeof translations[key] === 'string')
      .filter(key => !sameSet(placeholdersIn(en[key]), placeholdersIn(translations[key])))
      .map(key => `${key} => ${translations[key]}`)
    expect(mismatched).toEqual([])
  })
})
