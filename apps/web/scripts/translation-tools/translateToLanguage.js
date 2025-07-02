const fs = require('fs')
const path = require('path')

// Configuration
const CHUNK_SIZE = 100 // Process 100 keys at a time
const LANGUAGES = {
  hi: 'Hindi',
  fr: 'French',
  es: 'Spanish'
}

function createTranslationPlan(targetLang) {
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const enPath = path.join(localesDir, 'en.json')
  const targetPath = path.join(localesDir, `${targetLang}.json`)
  
  console.log(`\n=== TRANSLATION PLAN FOR ${LANGUAGES[targetLang]} (${targetLang}) ===`)
  
  // Read English file
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  const enKeys = Object.keys(enContent)
  
  // Check if target file exists
  let targetContent = {}
  let existingKeys = []
  
  if (fs.existsSync(targetPath)) {
    targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
    existingKeys = Object.keys(targetContent)
    console.log(`✓ Existing ${targetLang}.json found with ${existingKeys.length} translations`)
  } else {
    console.log(`○ No existing ${targetLang}.json file found - will create new`)
  }
  
  // Find missing keys
  const missingKeys = enKeys.filter(key => !existingKeys.includes(key))
  
  console.log(`\nTRANSLATION SUMMARY:`)
  console.log(`• English source: ${enKeys.length} keys`)
  console.log(`• Existing translations: ${existingKeys.length} keys`)
  console.log(`• Missing translations: ${missingKeys.length} keys`)
  
  if (missingKeys.length === 0) {
    console.log(`\n✅ All keys already translated for ${LANGUAGES[targetLang]}!`)
    return { complete: true }
  }
  
  // Calculate chunks
  const chunks = []
  for (let i = 0; i < missingKeys.length; i += CHUNK_SIZE) {
    chunks.push(missingKeys.slice(i, i + CHUNK_SIZE))
  }
  
  console.log(`\nWORK PLAN:`)
  console.log(`• Split into ${chunks.length} chunks of ${CHUNK_SIZE} keys each`)
  console.log(`• Each chunk will be saved incrementally`)
  console.log(`• Progress will be tracked and resumable`)
  
  // Save work plan
  const workPlan = {
    targetLang,
    languageName: LANGUAGES[targetLang],
    totalKeys: enKeys.length,
    existingKeys: existingKeys.length,
    missingKeys: missingKeys.length,
    chunks: chunks.map((chunk, index) => ({
      id: index + 1,
      startKey: chunk[0],
      endKey: chunk[chunk.length - 1],
      keyCount: chunk.length,
      keys: chunk,
      completed: false
    })),
    created: new Date().toISOString()
  }
  
  const planPath = `translation-plan-${targetLang}.json`
  fs.writeFileSync(planPath, JSON.stringify(workPlan, null, 2))
  
  console.log(`\n📋 Work plan saved to: ${planPath}`)
  console.log(`\nNEXT STEPS:`)
  console.log(`1. Run: node scripts/processChunk.js ${targetLang} 1`)
  console.log(`2. Continue with chunks 2, 3, etc.`)
  console.log(`3. Run: node scripts/finalizeTranslation.js ${targetLang}`)
  
  return { complete: false, planPath, chunks: workPlan.chunks }
}

// Main execution
const targetLang = process.argv[2]

if (!targetLang) {
  console.log('Usage: node scripts/translateToLanguage.js <language_code>')
  console.log('Available languages: hi (Hindi), fr (French), es (Spanish)')
  process.exit(1)
}

if (!LANGUAGES[targetLang]) {
  console.log(`Error: Unsupported language code '${targetLang}'`)
  console.log('Available languages: hi (Hindi), fr (French), es (Spanish)')
  process.exit(1)
}

createTranslationPlan(targetLang) 