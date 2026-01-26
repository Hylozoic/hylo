#!/usr/bin/env node

/**
 * Verifies that .po files were uploaded to SendWithUs
 * 
 * This script:
 * 1. Downloads the .pot file to verify the tag exists
 * 2. Attempts to check if translations are available (by checking template locales)
 */

const { downloadPotFile, getTemplates, createClient } = require('./sendwithus-client')
const { parsePotFile } = require('./po-utils')

const DEFAULT_TAG = 'i18n'

function usage () {
  console.error('Usage: node scripts/i18n/verify-po-upload.js [--tag <tag>]')
  console.error('  --tag: SendWithUs tag for templates (default: i18n)')
  process.exit(1)
}

function parseArgs () {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
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
 * Main function
 */
async function main () {
  const args = parseArgs()
  const tag = args.tag || DEFAULT_TAG

  console.log('🔍 Verifying .po file upload to SendWithUs')
  console.log(`   Tag: ${tag}`)

  const client = createClient()

  try {
    // Step 1: Try to download .pot file (verifies tag exists)
    console.log('\n📥 Downloading .pot file to verify tag exists...')
    try {
      const potContent = await downloadPotFile(tag, client)
      const potEntries = parsePotFile(potContent)
      const stringCount = Object.keys(potEntries).length
      console.log(`✓ Tag "${tag}" exists and contains ${stringCount} translatable strings`)
    } catch (err) {
      console.error(`❌ Failed to download .pot file: ${err.message}`)
      console.error('   This might mean the tag does not exist or templates are not tagged')
      process.exit(1)
    }

    // Step 2: Get templates with the tag to check their locales
    console.log('\n📋 Checking templates with this tag...')
    try {
      const templates = await getTemplates(client)
      const taggedTemplates = templates.filter(t => 
        t.tags && (Array.isArray(t.tags) ? t.tags.includes(tag) : t.tags === tag)
      )

      if (taggedTemplates.length === 0) {
        console.warn(`⚠️  No templates found with tag "${tag}"`)
        console.warn('   Make sure templates are tagged in SendWithUs dashboard')
      } else {
        console.log(`✓ Found ${taggedTemplates.length} template(s) with tag "${tag}"`)
        
        // Check a few templates for available locales by trying to get locale-specific versions
        console.log('\n🌍 Checking available locales for templates...')
        const expectedLocales = ['en-US', 'es-ES', 'de-DE', 'fr-FR', 'hi-IN', 'pt-BR']
        
        for (let i = 0; i < Math.min(3, taggedTemplates.length); i++) {
          const template = taggedTemplates[i]
          console.log(`   Template "${template.name}" (${template.id}):`)
          
          const availableLocales = []
          for (const locale of expectedLocales) {
            try {
              // Try to get versions for this locale - if it exists, the locale is available
              const { getTemplateVersions } = require('./sendwithus-client')
              await getTemplateVersions(template.id, locale, client)
              availableLocales.push(locale)
            } catch (err) {
              // Locale not available or error checking
              if (err.statusCode === 404) {
                // Locale doesn't exist for this template
              } else {
                // Other error - might mean locale exists but we can't access it
                // Try without error to see if it's just a permissions issue
              }
            }
          }
          
          if (availableLocales.length > 0) {
            console.log(`     ✓ Available locales: ${availableLocales.join(', ')}`)
          } else {
            console.log(`     ⚠️  No locales found yet (SendWithUs may still be processing)`)
            console.log(`        This is normal - processing can take a few minutes`)
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️  Could not check templates: ${err.message}`)
    }

    console.log('\n✅ Verification complete!')
    console.log('\n💡 Note: SendWithUs may take a few minutes to process uploaded .po files')
    console.log('   If locales are not showing yet, wait a bit and check again')
    console.log('   You can also check the SendWithUs dashboard for template locale variants')

  } catch (err) {
    console.error('\n❌ Error:', err.message)
    if (err.statusCode) {
      console.error(`   Status: ${err.statusCode}`)
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
