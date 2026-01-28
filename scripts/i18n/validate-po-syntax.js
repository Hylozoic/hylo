#!/usr/bin/env node

/**
 * Comprehensive validation of .po file syntax for SendWithUs
 * Checks for:
 * - Correct %(variable)s syntax
 * - Variables not split across lines incorrectly
 * - Missing % or s in variable syntax
 * - Variables that don't match between msgid and msgstr
 */

const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.resolve(__dirname, 'sendwithus-locales')

/**
 * Extracts all variables from a string
 */
function extractVariables (str) {
  const variables = []
  // Match %(variable)s pattern - must have %(, variable name, ), and s
  const regex = /%\(([^)]+)\)s/g
  let match
  while ((match = regex.exec(str)) !== null) {
    variables.push(match[0]) // Full match including %(variable)s
  }
  return variables
}

/**
 * Finds incomplete or malformed variables
 */
function findMalformedVariables (str) {
  const issues = []
  
  // Check for %( without closing )s
  const incomplete1 = /%\([^)]*$/g
  let match
  while ((match = incomplete1.exec(str)) !== null) {
    issues.push({
      type: 'incomplete',
      found: match[0],
      position: match.index,
      issue: 'Variable starts with %( but is not closed with )s'
    })
  }
  
  // Check for %(variable) without s
  const incomplete2 = /%\([^)]+\)[^s\s]/g
  while ((match = incomplete2.exec(str)) !== null) {
    issues.push({
      type: 'missing_s',
      found: match[0],
      position: match.index,
      issue: 'Variable missing trailing "s"'
    })
  }
  
  // Check for (variable)s without leading %
  const missingPercent = /\([^)]+\)s/g
  while ((match = missingPercent.exec(str)) !== null) {
    // Only flag if it looks like it should be a variable (not part of text)
    if (match[0].length < 20) { // Reasonable variable name length
      issues.push({
        type: 'missing_percent',
        found: match[0],
        position: match.index,
        issue: 'Variable missing leading "%"'
      })
    }
  }
  
  return issues
}

/**
 * Validates a .po file
 */
function validatePoFile (filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const errors = []
  const warnings = []

  // Parse the file properly handling multi-line strings
  const lines = content.split('\n')
  let currentMsgid = ''
  let currentMsgstr = ''
  let inMsgid = false
  let inMsgstr = false
  let msgidBuffer = []
  let msgstrBuffer = []
  let msgidLineNum = 0
  let currentLineNum = 0
  let isPythonFormat = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    currentLineNum = i + 1

    if (line.startsWith('#, python-format')) {
      isPythonFormat = true
    } else if (line.startsWith('msgid ')) {
      inMsgid = true
      inMsgstr = false
      msgidBuffer = []
      msgstrBuffer = []
      isPythonFormat = false
      const msgidStart = line.slice(6).replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"').replace(/\\n/g, '\n')
      if (msgidStart) msgidBuffer.push(msgidStart)
      msgidLineNum = currentLineNum
    } else if (line.startsWith('msgstr ')) {
      inMsgid = false
      inMsgstr = true
      const msgstrStart = line.slice(7).replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"').replace(/\\n/g, '\n')
      if (msgstrStart) msgstrBuffer.push(msgstrStart)
    } else if (inMsgid && line.startsWith('"') && line.endsWith('"')) {
      msgidBuffer.push(line.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n'))
    } else if (inMsgstr && line.startsWith('"') && line.endsWith('"')) {
      msgstrBuffer.push(line.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n'))
    } else if (line.trim() === '' && (inMsgid || inMsgstr)) {
      // End of entry
      if (inMsgid) {
        currentMsgid = msgidBuffer.join('')
        inMsgid = false
      }
      if (inMsgstr) {
        currentMsgstr = msgstrBuffer.join('')
        inMsgstr = false
        
        // Validate this entry
        if (currentMsgid && currentMsgstr) {
          // Check for malformed variables in msgstr
          const malformed = findMalformedVariables(currentMsgstr)
          for (const issue of malformed) {
            errors.push({
              file: path.basename(filePath),
              line: currentLineNum,
              msgidLine: msgidLineNum,
              msgid: currentMsgid.substring(0, 80),
              msgstr: currentMsgstr.substring(0, 80),
              issue: issue.issue,
              found: issue.found,
              context: currentMsgstr.substring(Math.max(0, issue.position - 30), issue.position + 50)
            })
          }
          
          // Extract variables from both
          const msgidVars = extractVariables(currentMsgid)
          const msgstrVars = extractVariables(currentMsgstr)
          
          // Check if all msgid variables are in msgstr (for python-format entries)
          if (isPythonFormat || msgidVars.length > 0) {
            for (const msgidVar of msgidVars) {
              if (!msgstrVars.includes(msgidVar)) {
                warnings.push({
                  file: path.basename(filePath),
                  line: currentLineNum,
                  msgidLine: msgidLineNum,
                  msgid: currentMsgid.substring(0, 80),
                  msgstr: currentMsgstr.substring(0, 80),
                  issue: `Variable from msgid missing in msgstr: ${msgidVar}`
                })
              }
            }
          }
        }
        
        // Reset for next entry
        currentMsgid = ''
        currentMsgstr = ''
        msgidBuffer = []
        msgstrBuffer = []
        isPythonFormat = false
      }
    }
  }

  // Handle last entry if file doesn't end properly
  if (inMsgstr && msgstrBuffer.length > 0) {
    currentMsgstr = msgstrBuffer.join('')
    if (currentMsgid && currentMsgstr) {
      const malformed = findMalformedVariables(currentMsgstr)
      for (const issue of malformed) {
        errors.push({
          file: path.basename(filePath),
          line: currentLineNum,
          msgidLine: msgidLineNum,
          msgid: currentMsgid.substring(0, 80),
          msgstr: currentMsgstr.substring(0, 80),
          issue: issue.issue,
          found: issue.found
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
  console.log('🔍 Comprehensive .po file syntax validation for SendWithUs\n')

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
        console.log(`     Found: "${error.found}"`)
        if (error.context) {
          console.log(`     Context: ...${error.context}...`)
        }
        console.log(`     From msgid (line ${error.msgidLine}): "${error.msgid}..."`)
        console.log(`     In msgstr: "${error.msgstr}..."`)
        console.log('')
      }
      totalErrors += errors.length
    }

    if (warnings.length > 0) {
      console.log(`  ⚠️  Found ${warnings.length} warning(s):`)
      for (const warning of warnings.slice(0, 10)) {
        console.log(`     Line ${warning.line}: ${warning.issue}`)
      }
      if (warnings.length > 10) {
        console.log(`     ... and ${warnings.length - 10} more warnings`)
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
    console.log('\n💡 CRITICAL: These errors must be fixed!')
    console.log('   Variables must use exact syntax: %(variable)s')
    console.log('   Missing % or s will cause SendWithUs to fail parsing')
    process.exit(1)
  } else if (totalWarnings > 0) {
    console.log(`⚠️  Total warnings: ${totalWarnings}`)
    console.log('\n💡 Warnings indicate variables that might not match between msgid and msgstr')
    console.log('✅ No syntax errors found - all variables use correct %(variable)s format')
  } else {
    console.log('✅ All .po files validated successfully!')
    console.log('   All variables use the correct %(variable)s syntax')
    console.log('   No malformed variables detected')
  }
}

if (require.main === module) {
  main()
}

module.exports = { validatePoFile, extractVariables, findMalformedVariables }

