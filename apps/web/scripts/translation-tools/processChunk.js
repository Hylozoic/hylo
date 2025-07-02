const fs = require('fs')
const path = require('path')

function processChunk(targetLang, chunkId) {
  const planPath = `translation-plan-${targetLang}.json`
  
  if (!fs.existsSync(planPath)) {
    console.log(`Error: Translation plan not found: ${planPath}`)
    console.log(`Run: node scripts/translateToLanguage.js ${targetLang} first`)
    process.exit(1)
  }
  
  const workPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  const chunk = workPlan.chunks.find(c => c.id === parseInt(chunkId))
  
  if (!chunk) {
    console.log(`Error: Chunk ${chunkId} not found`)
    console.log(`Available chunks: 1-${workPlan.chunks.length}`)
    process.exit(1)
  }
  
  if (chunk.completed) {
    console.log(`✓ Chunk ${chunkId} already completed`)
    return
  }
  
  console.log(`\n=== PROCESSING CHUNK ${chunkId}/${workPlan.chunks.length} ===`)
  console.log(`Language: ${workPlan.languageName}`)
  console.log(`Keys in this chunk: ${chunk.keyCount}`)
  console.log(`Range: "${chunk.startKey}" to "${chunk.endKey}"`)
  
  // Read English content for reference
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const enPath = path.join(localesDir, 'en.json')
  const targetPath = path.join(localesDir, `${targetLang}.json`)
  
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  
  // Read existing target content or create empty
  let targetContent = {}
  if (fs.existsSync(targetPath)) {
    targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
  }
  
  console.log(`\nKEYS TO TRANSLATE:`)
  chunk.keys.forEach((key, index) => {
    const value = enContent[key]
    console.log(`${index + 1}. "${key}": "${value}"`)
  })
  
  console.log(`\n📝 TRANSLATION INSTRUCTIONS:`)
  console.log(`• Preserve all variables like {{name}}, {{count}}, etc.`)
  console.log(`• Keep HTML tags intact: <strong>, <em>, etc.`)
  console.log(`• Maintain URL structures and technical terms`)
  console.log(`• Use professional, platform-appropriate language`)
  console.log(`• For Hindi: Use Devanagari script`)
  
  // Create template file for manual translation
  const templatePath = `chunk-${chunkId}-${targetLang}-template.json`
  const template = {}
  
  chunk.keys.forEach(key => {
    template[key] = `[TRANSLATE: ${enContent[key]}]`
  })
  
  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2))
  
  console.log(`\n📄 Template created: ${templatePath}`)
  console.log(`\nNEXT STEPS:`)
  console.log(`1. Open ${templatePath}`)
  console.log(`2. Replace [TRANSLATE: ...] with actual translations`)
  console.log(`3. Save the file`)
  console.log(`4. Run: node scripts/applyChunk.js ${targetLang} ${chunkId}`)
  
  return { templatePath, chunk }
}

// Main execution
const targetLang = process.argv[2]
const chunkId = process.argv[3]

if (!targetLang || !chunkId) {
  console.log('Usage: node scripts/processChunk.js <language_code> <chunk_number>')
  console.log('Example: node scripts/processChunk.js hi 1')
  process.exit(1)
}

processChunk(targetLang, chunkId) 