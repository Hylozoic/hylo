const fs = require('fs')
const path = require('path')

function applyChunk(targetLang, chunkId) {
  const planPath = `translation-plan-${targetLang}.json`
  const templatePath = `chunk-${chunkId}-${targetLang}-template.json`
  
  // Validate files exist
  if (!fs.existsSync(planPath)) {
    console.log(`Error: Translation plan not found: ${planPath}`)
    process.exit(1)
  }
  
  if (!fs.existsSync(templatePath)) {
    console.log(`Error: Template file not found: ${templatePath}`)
    console.log(`Run: node scripts/processChunk.js ${targetLang} ${chunkId} first`)
    process.exit(1)
  }
  
  const workPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  const chunk = workPlan.chunks.find(c => c.id === parseInt(chunkId))
  const translations = JSON.parse(fs.readFileSync(templatePath, 'utf8'))
  
  if (!chunk) {
    console.log(`Error: Chunk ${chunkId} not found in plan`)
    process.exit(1)
  }
  
  console.log(`\n=== APPLYING CHUNK ${chunkId} TRANSLATIONS ===`)
  
  // Validate translations are complete
  const untranslated = []
  Object.entries(translations).forEach(([key, value]) => {
    if (value.startsWith('[TRANSLATE:')) {
      untranslated.push(key)
    }
  })
  
  if (untranslated.length > 0) {
    console.log(`❌ ERROR: ${untranslated.length} keys still need translation:`)
    untranslated.slice(0, 5).forEach(key => {
      console.log(`• "${key}"`)
    })
    if (untranslated.length > 5) {
      console.log(`• ... and ${untranslated.length - 5} more`)
    }
    console.log(`\nPlease complete all translations in ${templatePath}`)
    process.exit(1)
  }
  
  // Read existing target file
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const targetPath = path.join(localesDir, `${targetLang}.json`)
  
  let targetContent = {}
  if (fs.existsSync(targetPath)) {
    targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
  }
  
  // Apply translations
  const newTranslations = Object.keys(translations).length
  Object.assign(targetContent, translations)
  
  // Write updated file
  fs.writeFileSync(targetPath, JSON.stringify(targetContent, null, 2))
  
  // Mark chunk as completed
  chunk.completed = true
  chunk.completedAt = new Date().toISOString()
  fs.writeFileSync(planPath, JSON.stringify(workPlan, null, 2))
  
  // Clean up template file
  fs.unlinkSync(templatePath)
  
  const completedChunks = workPlan.chunks.filter(c => c.completed).length
  const totalChunks = workPlan.chunks.length
  
  console.log(`✅ Chunk ${chunkId} applied successfully!`)
  console.log(`📊 Progress: ${completedChunks}/${totalChunks} chunks completed`)
  console.log(`📝 Added ${newTranslations} translations`)
  console.log(`📄 Total keys in ${targetLang}.json: ${Object.keys(targetContent).length}`)
  
  if (completedChunks === totalChunks) {
    console.log(`\n🎉 ALL CHUNKS COMPLETED!`)
    console.log(`Run: node scripts/finalizeTranslation.js ${targetLang}`)
  } else {
    const nextChunk = workPlan.chunks.find(c => !c.completed)
    if (nextChunk) {
      console.log(`\n➡️  Next: node scripts/processChunk.js ${targetLang} ${nextChunk.id}`)
    }
  }
}

// Main execution
const targetLang = process.argv[2]
const chunkId = process.argv[3]

if (!targetLang || !chunkId) {
  console.log('Usage: node scripts/applyChunk.js <language_code> <chunk_number>')
  console.log('Example: node scripts/applyChunk.js hi 1')
  process.exit(1)
}

applyChunk(targetLang, chunkId) 