#!/usr/bin/env node

/**
 * Downloads the POT file from SendWithUs
 * 
 * This script:
 * 1. Downloads the .pot file for the specified tag
 * 2. Saves it to scripts/i18n/sendwithus-locales/template.pot
 */

const fs = require('fs')
const path = require('path')
const { downloadPotFile, createClient } = require('./sendwithus-client')

const DEFAULT_TAG = 'i18n'
const OUTPUT_DIR = path.resolve(__dirname, 'sendwithus-locales')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'template.pot')

function usage () {
  console.error('Usage: node scripts/i18n/download-pot-file.js [--tag <tag>] [--output <path>]')
  console.error('  --tag: SendWithUs tag for templates (default: i18n)')
  console.error('  --output: Output file path (default: scripts/i18n/sendwithus-locales/template.pot)')
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
  const outputFile = args.output || OUTPUT_FILE

  console.log('📥 Download POT file from SendWithUs')
  console.log(`   Tag: ${tag}`)
  console.log(`   Output: ${outputFile}`)

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
    console.log(`✓ Created directory: ${outputDir}`)
  }

  // Download POT file
  console.log('\n📥 Downloading POT file...')
  try {
    const client = createClient()
    const potContent = await downloadPotFile(tag, client)
    
    // Save to file
    fs.writeFileSync(outputFile, potContent, 'utf8')
    const stats = fs.statSync(outputFile)
    console.log(`✓ Successfully downloaded POT file!`)
    console.log(`   File: ${outputFile}`)
    console.log(`   Size: ${stats.size} bytes`)
    
    // Count entries
    const entryCount = (potContent.match(/^msgid "/gm) || []).length
    console.log(`   Entries: ${entryCount} translatable strings`)
  } catch (err) {
    console.error('\n❌ Download failed!')
    console.error(`   Status: ${err.statusCode || 'unknown'}`)
    if (err.response) {
      console.error(`   Response: ${typeof err.response === 'string' ? err.response.substring(0, 500) : JSON.stringify(err.response).substring(0, 500)}`)
    }
    console.error(`   Error: ${err.message}`)
    console.error('\n💡 Troubleshooting tips:')
    console.error('   1. Verify the tag exists in SendWithUs (check dashboard)')
    console.error('   2. Verify templates are tagged with this tag')
    console.error('   3. Verify your API key has the correct permissions')
    throw err
  }

  console.log('\n✅ Download complete!')
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}

module.exports = { main }

