const fs = require('fs')
const path = require('path')

// Check if language code is provided
const lang = process.argv[2]
if (!lang) {
  console.error('Please provide a language code (e.g., es, fr, hi)')
  process.exit(1)
}

// Read missing keys file
const missingKeysFile = path.join(process.cwd(), `missing-${lang}-keys.json`)
try {
  const missingKeys = JSON.parse(fs.readFileSync(missingKeysFile, 'utf8'))
  
  // Create template with [TRANSLATE: ...] placeholders
  const template = {}
  for (const [key, value] of Object.entries(missingKeys)) {
    template[key] = `[TRANSLATE: ${value}]`
  }

  // Write template file
  const templateFile = path.join(process.cwd(), `${lang}-template.json`)
  fs.writeFileSync(templateFile, JSON.stringify(template, null, 2))
  console.log(`Created template file: ${templateFile}`)
  console.log('Please translate the placeholders marked with [TRANSLATE: ...]')

} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`Missing keys file not found: ${missingKeysFile}`)
    console.error('Run findMissingTranslations.js first')
  } else {
    console.error('Error processing missing keys:', error)
  }
  process.exit(1)
} 