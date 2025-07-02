const fs = require('fs')
const path = require('path')

function finalizeTranslation(targetLang) {
  const planPath = `translation-plan-${targetLang}.json`
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const enPath = path.join(localesDir, 'en.json')
  const targetPath = path.join(localesDir, `${targetLang}.json`)

  if (!fs.existsSync(planPath)) {
    console.log(`Error: Translation plan not found: ${planPath}`)
    process.exit(1)
  }

  const workPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'))

  console.log(`\n=== FINALIZING ${workPlan.languageName} TRANSLATION ===`)

  // Check all chunks completed
  const completedChunks = workPlan.chunks.filter(c => c.completed).length
  const totalChunks = workPlan.chunks.length

  if (completedChunks !== totalChunks) {
    console.log(`❌ ERROR: Not all chunks completed`)
    console.log(`Progress: ${completedChunks}/${totalChunks}`)
    
    const pendingChunks = workPlan.chunks.filter(c => !c.completed)
    console.log(`\nPending chunks:`)
    pendingChunks.forEach(chunk => {
      console.log(`• Chunk ${chunk.id}: ${chunk.keyCount} keys`)
    })
    process.exit(1)
  }

  // Read both files
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  const targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'))

  const enKeys = Object.keys(enContent)
  const targetKeys = Object.keys(targetContent)

  console.log(`\n📊 FINAL STATISTICS:`)
  console.log(`• English keys: ${enKeys.length}`)
  console.log(`• ${workPlan.languageName} keys: ${targetKeys.length}`)

  // Check for missing keys
  const missingKeys = enKeys.filter(key => !targetKeys.includes(key))
  const extraKeys = targetKeys.filter(key => !enKeys.includes(key))

  if (missingKeys.length > 0) {
    console.log(`❌ Missing ${missingKeys.length} keys in ${targetLang}.json`)
    missingKeys.slice(0, 5).forEach(key => console.log(`• ${key}`))
    if (missingKeys.length > 5) {
      console.log(`• ... and ${missingKeys.length - 5} more`)
    }
  }

  if (extraKeys.length > 0) {
    console.log(`⚠️  Extra ${extraKeys.length} keys in ${targetLang}.json`)
    extraKeys.slice(0, 5).forEach(key => console.log(`• ${key}`))
    if (extraKeys.length > 5) {
      console.log(`• ... and ${extraKeys.length - 5} more`)
    }
  }

  if (missingKeys.length === 0 && extraKeys.length === 0) {
    console.log(`✅ Perfect key match!`)
  }

  // Quality checks
  console.log(`\n🔍 QUALITY CHECKS:`)
  
  let issues = 0
  Object.entries(targetContent).forEach(([key, value]) => {
    const enValue = enContent[key]
    if (!enValue) return

    // Check for untranslated content
    if (value.includes('[TRANSLATE:')) {
      console.log(`❌ Untranslated: "${key}"`)
      issues++
    }

    // Check variable preservation
    const enVars = (enValue.match(/\{\{[^}]+\}\}/g) || [])
    const targetVars = (value.match(/\{\{[^}]+\}\}/g) || [])
    
    if (enVars.length !== targetVars.length) {
      console.log(`⚠️  Variable mismatch in "${key}": EN(${enVars.length}) vs ${targetLang.toUpperCase()}(${targetVars.length})`)
      issues++
    }
  })

  if (issues === 0) {
    console.log(`✅ No quality issues found`)
  } else {
    console.log(`❌ Found ${issues} quality issues`)
  }

  // Sort the file
  console.log(`\n📋 Sorting ${targetLang}.json alphabetically...`)
  const sortedContent = {}
  Object.keys(targetContent).sort().forEach(key => {
    sortedContent[key] = targetContent[key]
  })

  fs.writeFileSync(targetPath, JSON.stringify(sortedContent, null, 2))

  // Create completion report
  const report = {
    language: workPlan.languageName,
    code: targetLang,
    completedAt: new Date().toISOString(),
    statistics: {
      totalKeys: enKeys.length,
      translatedKeys: targetKeys.length,
      missingKeys: missingKeys.length,
      extraKeys: extraKeys.length,
      qualityIssues: issues
    },
    chunks: {
      total: totalChunks,
      completed: completedChunks
    }
  }

  const reportPath = `translation-report-${targetLang}.json`
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  // Clean up plan file
  fs.unlinkSync(planPath)

  console.log(`\n🎉 TRANSLATION COMPLETED!`)
  console.log(`📄 File: public/locales/${targetLang}.json`)
  console.log(`📊 Report: ${reportPath}`)
  
  if (issues === 0 && missingKeys.length === 0 && extraKeys.length === 0) {
    console.log(`✅ Ready for production!`)
  } else {
    console.log(`⚠️  Please review and fix issues before production`)
  }
}

// Main execution
const targetLang = process.argv[2]

if (!targetLang) {
  console.log('Usage: node scripts/finalizeTranslation.js <language_code>')
  console.log('Example: node scripts/finalizeTranslation.js hi')
  process.exit(1)
}

finalizeTranslation(targetLang) 