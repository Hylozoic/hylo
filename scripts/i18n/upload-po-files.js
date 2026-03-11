#!/usr/bin/env node

/**
 * Uploads existing .po files to SendWithUs
 * 
 * This script:
 * 1. Finds all .po files in sendwithus-locales directory
 * 2. Creates a .zip file with all .po files
 * 3. Uploads to SendWithUs
 */

const fs = require('fs')
const path = require('path')
const { uploadPoFiles, createClient } = require('./sendwithus-client')

const DEFAULT_TAG = 'i18n'
const OUTPUT_DIR = path.resolve(__dirname, 'sendwithus-locales')

function usage () {
  console.error('Usage: node scripts/i18n/upload-po-files.js [--tag <tag>] [--locale <locale>] [--dry-run]')
  console.error('  --tag: SendWithUs tag for templates (default: i18n)')
  console.error('  --locale: Upload only specific locale (e.g., es-ES, de-DE). If not specified, uploads all .po files')
  console.error('  --dry-run: Preview changes without uploading')
  process.exit(1)
}

function parseArgs () {
  const args = process.argv.slice(2)
  const result = { flags: new Set() }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--dry-run') {
      result.flags.add('dry-run')
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
 * Creates a zip file from .po files
 */
async function createZipFile (poFiles, outputPath) {
  // Try to require archiver
  let archiver
  try {
    archiver = require('archiver')
  } catch (err) {
    throw new Error('archiver package not found. Install it with: yarn add archiver')
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(`✓ Created ZIP file: ${outputPath} (${archive.pointer()} bytes)`)
      resolve(outputPath)
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)

    // Add each .po file to the zip
    for (const poFile of poFiles) {
      const fileName = path.basename(poFile)
      archive.file(poFile, { name: fileName })
    }

    archive.finalize()
  })
}

/**
 * Main function
 */
async function main () {
  const args = parseArgs()
  const tag = args.tag || DEFAULT_TAG
  const dryRun = args.flags.has('dry-run')

  console.log('📤 Upload .po files to SendWithUs')
  console.log(`   Tag: ${tag}`)
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

  // Find all .po files
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error(`❌ Directory not found: ${OUTPUT_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(OUTPUT_DIR)
  let poFiles = files
    .filter(file => file.endsWith('.po'))
    .map(file => path.join(OUTPUT_DIR, file))
    .sort()

  // Filter by locale if specified
  if (args.locale) {
    const localeFile = path.join(OUTPUT_DIR, `${args.locale}.po`)
    if (!fs.existsSync(localeFile)) {
      console.error(`❌ .po file not found for locale: ${args.locale}`)
      console.error(`   Expected file: ${localeFile}`)
      process.exit(1)
    }
    poFiles = [localeFile]
    console.log(`\n📋 Uploading single locale: ${args.locale}`)
  } else {
    console.log(`\n📋 Found ${poFiles.length} .po file(s):`)
  }

  poFiles.forEach(file => {
    const fileName = path.basename(file)
    const stats = fs.statSync(file)
    console.log(`   - ${fileName} (${stats.size} bytes)`)
  })

  // Create .zip file
  console.log('\n📦 Creating .zip file...')
  const zipPath = path.join(OUTPUT_DIR, 'translations.zip')
  await createZipFile(poFiles, zipPath)

  // Upload to SendWithUs
  if (dryRun) {
    console.log('\n💡 [DRY RUN] Would upload .zip file to SendWithUs')
    console.log(`   ZIP file: ${zipPath}`)
    console.log(`   Tag: ${tag}`)
    console.log(`   .po files: ${poFiles.map(f => path.basename(f)).join(', ')}`)
  } else {
    console.log('\n📤 Uploading .po files to SendWithUs...')
    const client = createClient()
    const zipBuffer = fs.readFileSync(zipPath)
    try {
      await uploadPoFiles(tag, zipBuffer, client)
      console.log('✓ Successfully uploaded .po files!')
      console.log('  SendWithUs will now generate translated template variants.')
    } catch (err) {
      console.error('\n❌ Upload failed!')
      console.error(`   Status: ${err.statusCode || 'unknown'}`)
      if (err.response) {
        console.error(`   Response: ${typeof err.response === 'string' ? err.response.substring(0, 500) : JSON.stringify(err.response).substring(0, 500)}`)
      }
      console.error(`   Error: ${err.message}`)
      console.error('\n💡 Troubleshooting tips:')
      console.error('   1. Verify the tag exists in SendWithUs (check dashboard)')
      console.error('   2. Verify templates are tagged with this tag')
      console.error('   3. Check that the .po files are correctly formatted')
      console.error('   4. Verify your API key has the correct permissions')
      throw err
    }
  }

  console.log('\n✅ Upload complete!')
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}

module.exports = { main }
