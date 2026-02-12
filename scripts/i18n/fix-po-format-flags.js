#!/usr/bin/env node

/**
 * Adds missing #, python-format flags to .po files
 */

const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.resolve(__dirname, 'sendwithus-locales')

function fixPoFile (filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const fixed = []
  let fixedCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prevLine = i > 0 ? lines[i - 1] : ''
    const prevPrevLine = i > 1 ? lines[i - 2] : ''

    // Check if current line is a msgid with variables
    if (line.startsWith('msgid ') && line.includes('%(')) {
      // Check if previous line is NOT a python-format flag
      if (!prevLine.startsWith('#, python-format')) {
        // Insert the flag immediately before this msgid
        // If there was a blank line, we want to keep it, but add flag before msgid
        // So: blank line, flag, msgid (no blank between flag and msgid)
        if (prevLine.trim() === '' && fixed.length > 0 && fixed[fixed.length - 1] === '') {
          // There's already a blank line, just add the flag
          fixed.push('#, python-format')
        } else {
          // No blank line, add flag directly
          fixed.push('#, python-format')
        }
        fixedCount++
      }
    }

    fixed.push(line)
  }

  if (fixedCount > 0) {
    fs.writeFileSync(filePath, fixed.join('\n'), 'utf8')
    return fixedCount
  }

  return 0
}

function main () {
  const args = process.argv.slice(2)
  const specificFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1]

  console.log('🔧 Fixing missing #, python-format flags in .po files...\n')

  const files = fs.readdirSync(OUTPUT_DIR)
  const poFiles = specificFile
    ? [path.join(OUTPUT_DIR, specificFile)]
    : files
        .filter(file => file.endsWith('.po') && file !== 'template.pot')
        .map(file => path.join(OUTPUT_DIR, file))
        .sort()

  let totalFixed = 0

  for (const poFile of poFiles) {
    if (!fs.existsSync(poFile)) {
      console.warn(`⚠️  File not found: ${poFile}`)
      continue
    }

    const fileName = path.basename(poFile)
    const fixed = fixPoFile(poFile)
    
    if (fixed > 0) {
      console.log(`✓ ${fileName}: Added ${fixed} #, python-format flag(s)`)
      totalFixed += fixed
    } else {
      console.log(`✓ ${fileName}: No fixes needed`)
    }
  }

  console.log('\n' + '='.repeat(60))
  if (totalFixed > 0) {
    console.log(`✅ Fixed ${totalFixed} missing flag(s)`)
  } else {
    console.log('✅ All files already have correct flags')
  }
}

if (require.main === module) {
  main()
}

module.exports = { fixPoFile }

