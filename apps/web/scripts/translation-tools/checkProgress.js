const fs = require('fs')
const path = require('path')

function checkProgress(targetLang) {
  const planPath = `translation-plan-${targetLang}.json`
  
  if (!fs.existsSync(planPath)) {
    console.log(`No active translation plan found for ${targetLang}`)
    console.log(`Run: node scripts/translateToLanguage.js ${targetLang}`)
    return
  }
  
  const workPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  const completedChunks = workPlan.chunks.filter(c => c.completed)
  const pendingChunks = workPlan.chunks.filter(c => !c.completed)
  
  console.log(`\n=== TRANSLATION PROGRESS: ${workPlan.languageName} ===`)
  console.log(`📅 Started: ${new Date(workPlan.created).toLocaleString()}`)
  console.log(`📊 Overall: ${completedChunks.length}/${workPlan.chunks.length} chunks completed`)
  console.log(`📝 Keys: ${workPlan.totalKeys - workPlan.missingKeys}/${workPlan.totalKeys} translated`)
  
  const progressPercent = Math.round((completedChunks.length / workPlan.chunks.length) * 100)
  const progressBar = '█'.repeat(Math.floor(progressPercent / 5)) + '░'.repeat(20 - Math.floor(progressPercent / 5))
  console.log(`📈 Progress: [${progressBar}] ${progressPercent}%`)
  
  if (completedChunks.length > 0) {
    console.log(`\n✅ COMPLETED CHUNKS:`)
    completedChunks.forEach(chunk => {
      const completedAt = chunk.completedAt ? new Date(chunk.completedAt).toLocaleString() : 'Unknown'
      console.log(`• Chunk ${chunk.id}: ${chunk.keyCount} keys (${completedAt})`)
    })
  }
  
  if (pendingChunks.length > 0) {
    console.log(`\n⏳ PENDING CHUNKS:`)
    pendingChunks.forEach(chunk => {
      console.log(`• Chunk ${chunk.id}: ${chunk.keyCount} keys ("${chunk.startKey}" to "${chunk.endKey}")`)
    })
    
    const nextChunk = pendingChunks[0]
    console.log(`\n➡️  NEXT STEP:`)
    console.log(`node scripts/processChunk.js ${targetLang} ${nextChunk.id}`)
  } else {
    console.log(`\n🎉 ALL CHUNKS COMPLETED!`)
    console.log(`➡️  NEXT STEP:`)
    console.log(`node scripts/finalizeTranslation.js ${targetLang}`)
  }
}

function listAllProgress() {
  const files = fs.readdirSync('.')
  const planFiles = files.filter(f => f.startsWith('translation-plan-') && f.endsWith('.json'))
  
  if (planFiles.length === 0) {
    console.log('No active translation projects found')
    return
  }
  
  console.log(`\n=== ALL TRANSLATION PROJECTS ===`)
  planFiles.forEach(file => {
    const langCode = file.replace('translation-plan-', '').replace('.json', '')
    const plan = JSON.parse(fs.readFileSync(file, 'utf8'))
    const completed = plan.chunks.filter(c => c.completed).length
    const total = plan.chunks.length
    const percent = Math.round((completed / total) * 100)
    
    console.log(`${plan.languageName} (${langCode}): ${completed}/${total} chunks (${percent}%)`)
  })
  
  console.log(`\nUse: node scripts/checkProgress.js <language_code> for details`)
}

// Main execution
const targetLang = process.argv[2]

if (!targetLang) {
  listAllProgress()
} else {
  checkProgress(targetLang)
} 