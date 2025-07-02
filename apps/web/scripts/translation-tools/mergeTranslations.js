const fs = require('fs')
const path = require('path')

function mergeTranslations () {
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const batch1Path = path.join(process.cwd(), 'pt-translations-batch-1.json')
  const batch2Path = path.join(process.cwd(), 'pt-translations-batch-2.json')
  const ptPath = path.join(localesDir, 'pt.json')

  // Read and parse files
  const batch1Content = JSON.parse(fs.readFileSync(batch1Path, 'utf8'))
  const batch2Content = JSON.parse(fs.readFileSync(batch2Path, 'utf8'))
  const ptContent = JSON.parse(fs.readFileSync(ptPath, 'utf8'))

  // Merge translations
  const mergedTranslations = {
    ...ptContent,
    ...batch1Content,
    ...batch2Content
  }

  // Sort keys alphabetically
  const sortedTranslations = Object.keys(mergedTranslations)
    .sort()
    .reduce((acc, key) => {
      acc[key] = mergedTranslations[key]
      return acc
    }, {})

  // Create backup of current pt.json
  const backupPath = path.join(localesDir, `pt.json.backup-${Date.now()}`)
  fs.writeFileSync(backupPath, JSON.stringify(ptContent, null, 2), 'utf8')
  console.log(`Created backup at ${backupPath}`)

  // Write merged translations
  fs.writeFileSync(ptPath, JSON.stringify(sortedTranslations, null, 2), 'utf8')
  console.log('Successfully merged translations!')

  // Count translations
  console.log(`Total translations: ${Object.keys(sortedTranslations).length}`)
  console.log(`New translations added: ${Object.keys(sortedTranslations).length - Object.keys(ptContent).length}`)
}

mergeTranslations() 