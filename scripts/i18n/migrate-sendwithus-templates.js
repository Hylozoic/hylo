#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const {
  getTemplates,
  getTemplateVersions,
  getTemplateVersion,
  createTemplate,
  updateTemplate,
  createClient
} = require('./sendwithus-client')
const { processTemplate } = require('./template-parser')
const { readJson } = require('./lib')

const I18N_TAG = 'i18n'
const I18N_SUFFIX = '_i18n'
const MAPPING_FILE = path.resolve(__dirname, 'template-id-mapping.json')
const INVENTORY_FILE = path.resolve(__dirname, 'sendwithus-inventory.json')

function usage () {
  console.error('Usage: node scripts/i18n/migrate-sendwithus-templates.js [--dry-run] [--template-id <id>] [--tag <tag>] [--all]')
  console.error('  --dry-run: Preview changes without making them')
  console.error('  --template-id: Migrate only a specific template (for testing)')
  console.error('  --tag: Use a different tag (default: i18n)')
  console.error('  --all: Migrate all English templates (not just those in \'used\' folder)')
  process.exit(1)
}

function parseArgs () {
  const args = process.argv.slice(2)
  const result = { flags: new Set() }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--dry-run' || arg === '--all') {
      result.flags.add(arg.slice(2))
      continue
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[++i]
      if (!value || value.startsWith('--')) {
        console.error(`Missing value for --${key}`)
        usage()
      }
      result[key] = value
    } else {
      console.error(`Unexpected argument: ${arg}`)
      usage()
    }
  }
  return result
}

/**
 * Loads existing template ID mapping
 * @returns {Object} Mapping of old template ID -> new template ID
 */
function loadMapping () {
  if (fs.existsSync(MAPPING_FILE)) {
    try {
      return readJson(MAPPING_FILE)
    } catch (err) {
      console.warn(`Warning: Could not read mapping file: ${err.message}`)
      return {}
    }
  }
  return {}
}

/**
 * Saves template ID mapping
 * @param {Object} mapping - Mapping object
 */
function saveMapping (mapping) {
  const sorted = Object.keys(mapping).sort().reduce((acc, key) => {
    acc[key] = mapping[key]
    return acc
  }, {})
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`✓ Saved template mapping to ${MAPPING_FILE}`)
}

/**
 * Checks if a template with the given name already exists
 * @param {Array} templates - List of all templates
 * @param {string} name - Template name to check
 * @returns {Object|undefined} Existing template or undefined
 */
function findTemplateByName (templates, name) {
  return templates.find(t => t.name === name)
}

/**
 * Gets the published version of a template
 * @param {string} templateId - Template ID
 * @param {Object} client - SendWithUs client
 * @returns {Promise<Object|undefined>} Published version or undefined
 */
async function getPublishedVersion (templateId, client) {
  const versions = await getTemplateVersions(templateId, null, client)
  return versions.find(v => v.published) || versions[0] // Fallback to first version if none published
}

/**
 * Creates a new template with i18n trans blocks
 * @param {Object} originalTemplate - Original template object
 * @param {Object} originalVersion - Original version object
 * @param {string} tag - Tag to apply
 * @param {boolean} dryRun - Whether this is a dry run
 * @param {Object} client - SendWithUs client
 * @returns {Promise<Object>} New template object
 */
async function createI18nTemplate (originalTemplate, originalVersion, tag, dryRun, client) {
  const newName = originalTemplate.name + I18N_SUFFIX

  console.log(`\n📧 Creating i18n template: ${newName}`)

  // Process template content to add trans blocks using OpenAI
  console.log('  Processing template content with OpenAI...')
  const processedVersion = await processTemplate({
    html: originalVersion.html,
    text: originalVersion.text,
    subject: originalVersion.subject,
    preheader: originalVersion.preheader
  })

  if (dryRun) {
    console.log(`  [DRY RUN] Would create template: ${newName}`)
    console.log(`  [DRY RUN] Subject: ${processedVersion.subject}`)
    console.log(`  [DRY RUN] HTML length: ${processedVersion.html?.length || 0} chars`)
    console.log(`  [DRY RUN] Text length: ${processedVersion.text?.length || 0} chars`)
    return { id: `dry-run-${originalTemplate.id}`, name: newName, locale: originalTemplate.locale }
  }

  // Create new template
  // Note: SendWithUs API doesn't support folders directly - folders are UI-only
  // We'll tag it with 'i18n ready' so it can be filtered/organized, but folders
  // may need to be set manually in the dashboard, or may be based on tags
  const newTemplate = await createTemplate({
    name: newName,
    subject: processedVersion.subject,
    html: processedVersion.html,
    text: processedVersion.text,
    preheader: processedVersion.preheader,
    locale: originalTemplate.locale || 'en-US',
    template_data: originalVersion.template_data,
    tags: [tag, 'i18n ready'] // Tag with both i18n tag and folder name
  }, client)

  console.log(`  ✓ Created template: ${newTemplate.id}`)

  // Tag the new template (in case tags weren't set during creation)
  await updateTemplate(newTemplate.id, { tags: [tag, 'i18n ready'] }, null, client)
  console.log(`  ✓ Tagged template with: ${tag} and 'i18n ready'`)
  console.log('  ⚠️  Note: SendWithUs folders are UI-only. You may need to manually move this template to the \'i18n ready\' folder in the dashboard.')

  return newTemplate
}

/**
 * Main migration function
 */
async function main () {
  const args = parseArgs()
  const dryRun = args.flags.has('dry-run')
  const migrateAll = args.flags.has('all')
  const tag = args.tag || I18N_TAG
  const specificTemplateId = args['template-id']

  console.log('🚀 SendWithUs i18n Migration Script')
  console.log(`   Tag: ${tag}`)
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (specificTemplateId) {
    console.log(`   Template ID: ${specificTemplateId}`)
  }
  if (migrateAll) {
    console.log('   Filter: All English templates (not just \'used\' folder)')
  } else {
    console.log('   Filter: Only templates in \'used\' folder/tag')
  }

  const client = createClient()
  const mapping = loadMapping()

  try {
    // Get all templates
    console.log('\n📋 Fetching templates...')
    const allTemplates = await getTemplates(client)
    console.log(`   Found ${allTemplates.length} total template(s)`)

    // Filter to templates in 'used' folder/tag and English locale
    const templates = allTemplates.filter(t => {
      if (specificTemplateId) {
        return t.id === specificTemplateId
      }
      // Only process en-US templates (or templates without locale specified)
      const isEnglish = !t.locale || t.locale === 'en-US'
      if (!isEnglish) return false

      // If --all flag, skip the 'used' filter
      if (migrateAll) return true

      // Check if template is in 'used' folder (check tags or folder property)
      // SendWithUs uses tags for organization, so check if 'used' is in tags
      const inUsedFolder = (t.tags && Array.isArray(t.tags) && t.tags.includes('used')) || t.folder === 'used'
      return inUsedFolder
    })

    if (templates.length === 0) {
      console.log('\n❌ No templates found to migrate.')
      if (specificTemplateId) {
        console.log(`   Template ${specificTemplateId} not found or not in en-US locale.`)
      } else if (!migrateAll) {
        console.log('   No English templates found with \'used\' tag.')
        console.log('   Use --all to migrate all English templates, or add \'used\' tag to templates.')
        console.log('\n   Available English templates:')
        const englishTemplates = allTemplates.filter(t => !t.locale || t.locale === 'en-US')
        englishTemplates.slice(0, 10).forEach(t => {
          const tags = t.tags && Array.isArray(t.tags) ? t.tags.join(', ') : 'none'
          console.log(`     - ${t.name} (${t.id}) - tags: [${tags}]`)
        })
        if (englishTemplates.length > 10) {
          console.log(`     ... and ${englishTemplates.length - 10} more`)
        }
      }
      process.exit(0)
    }

    console.log(`Found ${templates.length} template(s) to process`)

    // Save inventory
    if (!dryRun) {
      fs.writeFileSync(INVENTORY_FILE, JSON.stringify(allTemplates, null, 2) + '\n')
      console.log(`✓ Saved inventory to ${INVENTORY_FILE}`)
    }

    // Process each template
    for (const template of templates) {
      // Check if already migrated
      const newName = template.name + I18N_SUFFIX
      const existingI18n = findTemplateByName(allTemplates, newName)
      if (existingI18n) {
        console.log(`\n⏭️  Skipping ${template.name} - i18n version already exists: ${existingI18n.id}`)
        if (!mapping[template.id]) {
          mapping[template.id] = existingI18n.id
        }
        continue
      }

      // Check mapping file
      if (mapping[template.id]) {
        console.log(`\n⏭️  Skipping ${template.name} - already in mapping file`)
        continue
      }

      // Get published version
      const version = await getPublishedVersion(template.id, client)
      if (!version) {
        console.log(`\n⚠️  Skipping ${template.name} - no versions found`)
        continue
      }

      // Get full version details
      const fullVersion = await getTemplateVersion(template.id, version.id, null, client)

      // Create i18n template
      const newTemplate = await createI18nTemplate(template, fullVersion, tag, dryRun, client)

      // Save mapping
      if (!dryRun) {
        mapping[template.id] = newTemplate.id
        saveMapping(mapping)
      } else {
        console.log(`  [DRY RUN] Would map ${template.id} -> ${newTemplate.id}`)
      }
    }

    console.log('\n✅ Migration complete!')
    console.log(`   Processed: ${templates.length} template(s)`)
    if (!dryRun) {
      console.log(`   Mapping saved to: ${MAPPING_FILE}`)
      console.log('\n📝 Next steps:')
      console.log(`   1. Download .pot file: GET /i18n/pot/${tag}`)
      console.log('   2. Generate .po files from your JSON locales')
      console.log(`   3. Upload .po files: POST /i18n/po/${tag}`)
    } else {
      console.log('\n💡 Run without --dry-run to perform actual migration')
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    if (err.statusCode) {
      console.error(`   Status: ${err.statusCode}`)
      if (err.response) {
        console.error('   Response:', JSON.stringify(err.response, null, 2))
      }
    }
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}

module.exports = { main }
