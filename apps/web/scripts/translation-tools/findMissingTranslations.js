const fs = require('fs')
const path = require('path')

const LOCALES_DIR = path.join(process.cwd(), 'public', 'locales')
const SUPPORTED_LANGUAGES = ['es', 'fr', 'hi', 'pt']

// Read the English source file
const enContent = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'))
const enKeys = new Set(Object.keys(enContent))

// Process each supported language
SUPPORTED_LANGUAGES.forEach(lang => {
  try {
    const langFile = path.join(LOCALES_DIR, `${lang}.json`)
    const langContent = JSON.parse(fs.readFileSync(langFile, 'utf8'))
    const langKeys = new Set(Object.keys(langContent))

    // Find keys in English that are missing in this language
    const missingKeys = {}
    for (const key of enKeys) {
      if (!langKeys.has(key)) {
        missingKeys[key] = enContent[key]
      }
    }

    // Write missing keys to a file
    if (Object.keys(missingKeys).length > 0) {
      const outputFile = path.join(process.cwd(), `missing-${lang}-keys.json`)
      fs.writeFileSync(outputFile, JSON.stringify(missingKeys, null, 2))
      console.log(`Found ${Object.keys(missingKeys).length} missing keys in ${lang}. See ${outputFile}`)
    } else {
      console.log(`No missing keys found in ${lang}`)
    }

    // Find extra keys in this language that don't exist in English
    const extraKeys = Array.from(langKeys).filter(key => !enKeys.has(key))
    if (extraKeys.length > 0) {
      console.log(`\nWarning: Found ${extraKeys.length} extra keys in ${lang} that don't exist in English:`)
      console.log(extraKeys.join('\n'))
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Warning: ${lang}.json does not exist`)
    } else {
      console.error(`Error processing ${lang}:`, error)
    }
  }
}) 