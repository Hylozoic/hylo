const fs = require('fs')
const path = require('path')

class TranslationProcessor {
  constructor (config) {
    this.config = {
      localesDir: path.join(process.cwd(), 'public', 'locales'),
      backupDir: path.join(process.cwd(), 'translation_backups'),
      ...config
    }
    this.stats = {
      processed: 0,
      errors: [],
      warnings: []
    }
  }

  // Create backup of existing translations
  backup (langCode) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(
      this.config.backupDir,
      `${langCode}_${timestamp}.json`
    )

    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true })
    }

    const sourcePath = path.join(this.config.localesDir, `${langCode}.json`)
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, backupPath)
      console.log(`Backup created: ${backupPath}`)
    }
  }

  // Validate placeholders in translation
  validatePlaceholders (original, translation) {
    const placeholderRegex = /{{[^}]+}}/g
    const originalPlaceholders = original.match(placeholderRegex) || []
    const translationPlaceholders = translation.match(placeholderRegex) || []

    const missing = originalPlaceholders.filter(
      p => !translationPlaceholders.includes(p)
    )

    if (missing.length > 0) {
      this.stats.warnings.push(
        `Missing placeholders in translation: ${missing.join(', ')}`
      )
      return false
    }
    return true
  }

  // Process translations for a language
  async processLanguage (langCode, templatePath) {
    console.log(`Processing translations for ${langCode}...`)

    try {
      // Create backup
      this.backup(langCode)

      // Read files
      const targetPath = path.join(this.config.localesDir, `${langCode}.json`)
      const existingContent = fs.existsSync(targetPath)
        ? JSON.parse(fs.readFileSync(targetPath, 'utf8'))
        : {}
      const templateContent = JSON.parse(fs.readFileSync(templatePath, 'utf8'))

      // Process and validate translations
      const updatedTranslations = { ...existingContent }
      for (const [key, translation] of Object.entries(templateContent)) {
        if (this.validatePlaceholders(key, translation)) {
          updatedTranslations[key] = translation
          this.stats.processed++
        }
      }

      // Write updated translations
      fs.writeFileSync(
        targetPath,
        JSON.stringify(updatedTranslations, null, 2) + '\n',
        'utf8'
      )
      console.log(`Processing complete for ${langCode}:
- Processed keys: ${this.stats.processed}
- Warnings: ${this.stats.warnings.length}
- Errors: ${this.stats.errors.length}`)
    } catch (error) {
      this.stats.errors.push(`Error processing ${langCode}: ${error.message}`)
      console.error(`Failed to process ${langCode}:`, error)
    }
  }
}

// Example usage
async function processTranslations () {
  const processor = new TranslationProcessor({
    // Add any custom config here
  })

  const languages = ['pt'] // Portuguese translation
  const templatePath = path.join(process.cwd(), 'pt-template-2.json')

  for (const lang of languages) {
    await processor.processLanguage(lang, templatePath)
  }

  // Output final statistics
  console.log('\nTranslation Processing Complete')
  console.log('===============================')
  console.log(`Total languages processed: ${languages.length}`)
  console.log(`Total keys processed: ${processor.stats.processed}`)
  console.log(`Total warnings: ${processor.stats.warnings.length}`)
  console.log(`Total errors: ${processor.stats.errors.length}`)
}

processTranslations() 