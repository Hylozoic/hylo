const fs = require('fs')
const path = require('path')

function findExtraKeys() {
  const localesDir = path.join(process.cwd(), 'public', 'locales')
  const enPath = path.join(localesDir, 'en.json')
  const frPath = path.join(localesDir, 'fr.json')
  
  // Read and parse files
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  const frContent = JSON.parse(fs.readFileSync(frPath, 'utf8'))
  
  // Get keys from both files
  const enKeys = Object.keys(enContent)
  const frKeys = Object.keys(frContent)
  
  // Find keys in French that are not in English
  const extraInFr = frKeys.filter(key => !enKeys.includes(key))
  
  console.log(`English file has ${enKeys.length} keys`)
  console.log(`French file has ${frKeys.length} keys`)
  console.log(`Extra keys in French: ${extraInFr.length}`)
  
  if (extraInFr.length > 0) {
    console.log('\nKeys in French that are not in English:')
    extraInFr.forEach((key, index) => {
      console.log(`${index + 1}. "${key}": "${frContent[key]}"`)
    })
    
    // Create cleaned French file with only keys that exist in English
    const cleanedFrContent = {}
    enKeys.forEach(key => {
      if (frContent[key] !== undefined) {
        cleanedFrContent[key] = frContent[key]
      }
    })
    
    // Write cleaned version
    fs.writeFileSync(
      frPath,
      JSON.stringify(cleanedFrContent, null, 2),
      'utf8'
    )
    
    console.log(`\nCleaned French file. Removed ${extraInFr.length} extra keys.`)
    console.log(`French file now has ${Object.keys(cleanedFrContent).length} keys.`)
  } else {
    console.log('\nNo extra keys found in French file!')
  }
}

findExtraKeys() 