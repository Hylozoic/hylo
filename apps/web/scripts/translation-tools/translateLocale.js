const fs = require('fs')
const path = require('path')

function translateLocale () {
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const ptPath = path.join(localesDir, 'pt.json')
  const missingPath = path.join(process.cwd(), 'pt-missing-translations.json')

  // Read and parse files
  const ptContent = JSON.parse(fs.readFileSync(ptPath, 'utf8'))
  const missingContent = JSON.parse(fs.readFileSync(missingPath, 'utf8'))

  // Create new translations object with existing translations
  const newTranslations = { ...ptContent }

  // Add translated content from missing translations file
  Object.keys(missingContent).forEach(key => {
    if (!newTranslations[key]) {
      newTranslations[key] = missingContent[key]
    }
  })

  // Sort keys alphabetically
  const sortedTranslations = Object.keys(newTranslations)
    .sort()
    .reduce((acc, key) => {
      acc[key] = newTranslations[key]
      return acc
    }, {})

  // Create backup of current pt.json
  const backupPath = path.join(localesDir, `pt.json.backup-${Date.now()}`)
  fs.writeFileSync(backupPath, JSON.stringify(ptContent, null, 2), 'utf8')
  console.log(`Created backup at ${backupPath}`)

  // Write new translations
  fs.writeFileSync(ptPath, JSON.stringify(sortedTranslations, null, 2), 'utf8')
  console.log('Successfully updated Portuguese translations!')

  // Count translations
  console.log(`Total translations: ${Object.keys(sortedTranslations).length}`)
  console.log(`New translations added: ${Object.keys(sortedTranslations).length - Object.keys(ptContent).length}`)
}

translateLocale() 