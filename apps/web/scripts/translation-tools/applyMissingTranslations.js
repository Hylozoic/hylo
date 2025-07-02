const fs = require('fs')
const path = require('path')

// Check if language code is provided
const lang = process.argv[2]
if (!lang) {
  console.error('Please provide a language code (e.g., es, fr, hi)')
  process.exit(1)
}

// File paths
const templateFile = path.join(process.cwd(), `${lang}-template.json`)
const localeFile = path.join(process.cwd(), 'public', 'locales', `${lang}.json`)

try {
  // Read template and locale files
  const template = JSON.parse(fs.readFileSync(templateFile, 'utf8'))
  const locale = JSON.parse(fs.readFileSync(localeFile, 'utf8'))

  // Validate translations
  const untranslatedKeys = Object.entries(template)
    .filter(([key, value]) => value.startsWith('[TRANSLATE:'))
    .map(([key]) => key)

  if (untranslatedKeys.length > 0) {
    console.error('Error: The following keys still need translation:')
    console.error(untranslatedKeys.join('\n'))
    process.exit(1)
  }

  // Apply translations
  const updatedLocale = { ...locale, ...template }

  // Sort keys alphabetically
  const sortedLocale = {}
  Object.keys(updatedLocale)
    .sort()
    .forEach(key => {
      sortedLocale[key] = updatedLocale[key]
    })

  // Write back to locale file
  fs.writeFileSync(localeFile, JSON.stringify(sortedLocale, null, 2))
  console.log(`Successfully applied translations to ${localeFile}`)

  // Clean up template file
  fs.unlinkSync(templateFile)
  console.log(`Removed template file: ${templateFile}`)
} catch (error) {
  if (error.code === 'ENOENT') {
    if (!fs.existsSync(templateFile)) {
      console.error(`Template file not found: ${templateFile}`)
      console.error('Run processMissingKeys.js first')
    } else {
      console.error(`Locale file not found: ${localeFile}`)
    }
  } else {
    console.error('Error applying translations:', error)
  }
  process.exit(1)
} 