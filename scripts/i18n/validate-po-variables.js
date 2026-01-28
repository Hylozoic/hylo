#!/usr/bin/env node

/**
 * Validates that all variables in .po files use the correct %(variable)s syntax
 * as required by SendWithUs
 */

const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.resolve(__dirname, 'sendwithus-locales')

/**
 * Finds all variables in a string
 */
function findVariables (str) {
  const variables = []
  // Match %(variable)s pattern
  const regex = /%\(([^)]+)\)([^s]|$)/g
  let match
  while ((match = regex.exec(str)) !== null) {
    variables.push({
      full: match[0],
      variable: match[1],
      after: match[2],
      position: match.index
    })
  }
  return variables
}

/**
 * Validates a .po file
 */
function validatePoFile (filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const errors = []
  const warnings = []

  let inMsgstr = false
  let msgstrBuffer = []
  let currentLineNum = 0
  let msgidLineNum = 0
  let currentMsgid = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    currentLineNum = i + 1

    if (line.startsWith('msgid ')) {
      inMsgstr = false
      msgstrBuffer = []
      const msgidStart = line.slice(6).replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"')
      currentMsgid = msgidStart
      msgidLineNum = currentLineNum
    } else if (line.startsWith('msgstr ')) {
      inMsgstr = true
      msgstrBuffer = []
      const msgstrStart = line.slice(7).replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"')
      if (msgstrStart) msgstrBuffer.push(msgstrStart)
    } else if (inMsgstr && line.startsWith('"') && line.endsWith('"')) {
      msgstrBuffer.push(line.slice(1, -1).replace(/\\"/g, '"'))
    } else if (line.trim() === '' && inMsgstr && msgstrBuffer.length > 0) {
      // End of msgstr, validate it
      const msgstr = msgstrBuffer.join('')
      if (msgstr && currentMsgid) {
        // Extract all %(variable)s from msgid
        const msgidVars = currentMsgid.match(/%\(([^)]+)\)s/g) || []
        const msgstrVars = msgstr.match(/%\(([^)]+)\)s/g) || []

        // Check for variables missing 's'
        const incompleteVars = findVariables(msgstr)
        for (const incomplete of incompleteVars) {
          errors.push({
            file: path.basename(filePath),
            line: currentLineNum,
            msgidLine: msgidLineNum,
            msgid: currentMsgid.substring(0, 60),
            issue: `Variable missing 's': ${incomplete.full}`,
            context: msgstr.substring(Math.max(0, incomplete.position - 20), incomplete.position + 40)
          })
        }

        // Check for variables in msgid that are missing in msgstr
        for (const msgidVar of msgidVars) {
          if (!msgstr.includes(msgidVar)) {
            warnings.push({
              file: path.basename(filePath),
              line: currentLineNum,
              msgidLine: msgidLineNum,
              msgid: currentMsgid.substring(0, 60),
              issue: `Variable from msgid missing in msgstr: ${msgidVar}`,
              context: msgstr.substring(0, 80)
            })
          }
        }

        // Check for variables in msgstr that aren't in msgid (might be translation error)
        for (const msgstrVar of msgstrVars) {
          if (!currentMsgid.includes(msgstrVar)) {
            warnings.push({
              file: path.basename(filePath),
              line: currentLineNum,
              msgidLine: msgidLineNum,
              msgid: currentMsgid.substring(0, 60),
              issue: `Variable in msgstr not in msgid: ${msgstrVar}`,
              context: msgstr.substring(0, 80)
            })
          }
        }
      }
      inMsgstr = false
      msgstrBuffer = []
    }
  }

  // Handle last entry if file doesn't end with blank line
  if (inMsgstr && msgstrBuffer.length > 0) {
    const msgstr = msgstrBuffer.join('')
    if (msgstr && currentMsgid) {
      const incompleteVars = findVariables(msgstr)
      for (const incomplete of incompleteVars) {
        errors.push({
          file: path.basename(filePath),
          line: currentLineNum,
          msgidLine: msgidLineNum,
          msgid: currentMsgid.substring(0, 60),
          issue: `Variable missing 's': ${incomplete.full}`,
          context: msgstr.substring(Math.max(0, incomplete.position - 20), incomplete.position + 40)
        })
      }
    }
  }

  return { errors, warnings }
}

/**
 * Main function
 */
function main () {
  console.log('🔍 Validating variable syntax in .po files...\n')

  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error(`❌ Directory not found: ${OUTPUT_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(OUTPUT_DIR)
  const poFiles = files
    .filter(file => file.endsWith('.po') && file !== 'template.pot')
    .map(file => path.join(OUTPUT_DIR, file))
    .sort()

  if (poFiles.length === 0) {
    console.error(`❌ No .po files found in ${OUTPUT_DIR}`)
    process.exit(1)
  }

  let totalErrors = 0
  let totalWarnings = 0

  for (const poFile of poFiles) {
    const fileName = path.basename(poFile)
    console.log(`Checking ${fileName}...`)
    const { errors, warnings } = validatePoFile(poFile)

    if (errors.length > 0) {
      console.log(`  ❌ Found ${errors.length} error(s):`)
      for (const error of errors) {
        console.log(`     Line ${error.line}: ${error.issue}`)
        console.log(`     Context: ...${error.context}...`)
        console.log(`     From msgid (line ${error.msgidLine}): "${error.msgid}..."`)
      }
      totalErrors += errors.length
    }

    if (warnings.length > 0) {
      console.log(`  ⚠️  Found ${warnings.length} warning(s):`)
      for (const warning of warnings.slice(0, 5)) { // Show first 5 warnings
        console.log(`     Line ${warning.line}: ${warning.issue}`)
      }
      if (warnings.length > 5) {
        console.log(`     ... and ${warnings.length - 5} more warnings`)
      }
      totalWarnings += warnings.length
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  ✓ No issues found`)
    }
    console.log('')
  }

  console.log('='.repeat(60))
  if (totalErrors > 0) {
    console.log(`❌ Total errors: ${totalErrors}`)
    console.log('\n💡 Errors must be fixed - variables must use %(variable)s syntax')
    process.exit(1)
  } else if (totalWarnings > 0) {
    console.log(`⚠️  Total warnings: ${totalWarnings}`)
    console.log('\n💡 Warnings are informational - check if variables match between msgid and msgstr')
    console.log('✅ No syntax errors found - all variables use correct %(variable)s format')
  } else {
    console.log('✅ All .po files validated successfully!')
    console.log('   All variables use the correct %(variable)s syntax')
  }
}

if (require.main === module) {
  main()
}

module.exports = { validatePoFile, findVariables }

