#!/usr/bin/env node

/**
 * Checks that all .po file entries with variables have the #, python-format flag
 */

const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.resolve(__dirname, 'sendwithus-locales')

function checkPoFile (filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const issues = []

  let hasPythonFormat = false
  let currentMsgid = ''
  let msgidLineNum = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    if (line.startsWith('#, python-format')) {
      hasPythonFormat = true
    } else if (line.startsWith('msgid ')) {
      const msgidStart = line.slice(6).replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"')
      currentMsgid = msgidStart
      msgidLineNum = lineNum
      
      // Check if this msgid has variables
      if (currentMsgid.includes('%(') && !hasPythonFormat) {
        issues.push({
          line: lineNum,
          msgid: currentMsgid.substring(0, 80),
          issue: 'Entry with variables missing #, python-format flag'
        })
      }
      hasPythonFormat = false // Reset for next entry
    } else if (line.startsWith('msgstr ')) {
      // End of msgid, reset
      hasPythonFormat = false
      currentMsgid = ''
    } else if (line.trim() === '') {
      hasPythonFormat = false
      currentMsgid = ''
    } else if (line.startsWith('"') && currentMsgid) {
      // Continuation of msgid
      const continuation = line.slice(1, -1).replace(/\\"/g, '"')
      currentMsgid += continuation
    }
  }

  return issues
}

function main () {
  console.log('🔍 Checking #, python-format flags in .po files...\n')

  const files = fs.readdirSync(OUTPUT_DIR)
  const poFiles = files
    .filter(file => file.endsWith('.po') && file !== 'template.pot')
    .map(file => path.join(OUTPUT_DIR, file))
    .sort()

  let totalIssues = 0

  for (const poFile of poFiles) {
    const fileName = path.basename(poFile)
    const issues = checkPoFile(poFile)
    
    if (issues.length > 0) {
      console.log(`❌ ${fileName}: Found ${issues.length} issue(s)`)
      for (const issue of issues.slice(0, 10)) {
        console.log(`   Line ${issue.line}: ${issue.issue}`)
        console.log(`   msgid: "${issue.msgid}..."`)
      }
      if (issues.length > 10) {
        console.log(`   ... and ${issues.length - 10} more`)
      }
      totalIssues += issues.length
    } else {
      console.log(`✓ ${fileName}: All entries with variables have #, python-format flag`)
    }
  }

  console.log('\n' + '='.repeat(60))
  if (totalIssues > 0) {
    console.log(`❌ Total issues: ${totalIssues}`)
    console.log('\n💡 Entries with %(variable)s must have #, python-format flag on line before msgid')
    process.exit(1)
  } else {
    console.log('✅ All .po files have correct #, python-format flags!')
  }
}

if (require.main === module) {
  main()
}

module.exports = { checkPoFile }

