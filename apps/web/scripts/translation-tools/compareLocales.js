const fs = require('fs')
const path = require('path')

function compareLocaleFiles () {
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const enPath = path.join(localesDir, 'en.json')
  const languages = ['es', 'fr', 'hi', 'pt']

  // Read English content
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  const enKeys = Object.keys(enContent)
  console.log(`English file has ${enKeys.length} keys\n`)

  // Compare each language
  languages.forEach(lang => {
    const langPath = path.join(localesDir, `${lang}.json`)
    try {
      const langContent = JSON.parse(fs.readFileSync(langPath, 'utf8'))
      const langKeys = Object.keys(langContent)

      console.log(`=== ${lang.toUpperCase()} ===`)
      console.log(`Total keys: ${langKeys.length}`)

      // Find missing keys
      const missingKeys = enKeys.filter(key => !langKeys.includes(key))
      console.log(`Missing keys: ${missingKeys.length}`)
      
      // Find extra keys
      const extraKeys = langKeys.filter(key => !enKeys.includes(key))
      console.log(`Extra keys: ${extraKeys.length}`)

      if (extraKeys.length > 0) {
        console.log('\nExtra keys:')
        extraKeys.forEach(key => {
          console.log(`  "${key}": "${langContent[key]}"`)
        })
      }

      if (missingKeys.length > 0) {
        // Create a template object with missing translations
        const template = {}
        missingKeys.sort().forEach(key => {
          template[key] = enContent[key]
        })

        // Write to a template file
        const templatePath = path.join(process.cwd(), `${lang}-missing-translations.json`)
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2), 'utf8')
        console.log(`\nCreated template file with missing translations at: ${templatePath}`)
      }

      console.log('\n')
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`Warning: ${lang}.json does not exist`)
      } else {
        console.error(`Error processing ${lang}:`, error)
      }
    }
  })
}

compareLocaleFiles()
