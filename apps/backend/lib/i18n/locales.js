const { en } = require('./en')
const { es } = require('./es')
const { fr } = require('./fr')
const { de } = require('./de')
const { hi } = require('./hi')
const { pt } = require('./pt')

const locales = { en, es, fr, de, hi, pt }

function getLocaleStrings (locale) {
  return locales[locale] || en
}

module.exports = { locales, getLocaleStrings }
