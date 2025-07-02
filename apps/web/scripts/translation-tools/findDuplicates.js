const fs = require('fs')
const path = require('path')

function findDuplicateKeys() {
  const frPath = path.join(process.cwd(), 'public', 'locales', 'fr.json')
  
  // Read the file as text first to check for duplicates
  const fileContent = fs.readFileSync(frPath, 'utf8')
  
  // Parse JSON
  const jsonContent = JSON.parse(fileContent)
  
  // Get all keys
  const keys = Object.keys(jsonContent)
  const keyCount = {}
  const duplicates = []
  
  // Count occurrences of each key
  keys.forEach(key => {
    if (keyCount[key]) {
      keyCount[key]++
      if (keyCount[key] === 2) {
        duplicates.push(key)
      }
    } else {
      keyCount[key] = 1
    }
  })
  
  console.log(`Total keys in French file: ${keys.length}`)
  console.log(`Unique keys: ${Object.keys(keyCount).length}`)
  console.log(`Duplicate keys found: ${duplicates.length}`)
  
  if (duplicates.length > 0) {
    console.log('\nDuplicate keys:')
    duplicates.forEach((key, index) => {
      console.log(`${index + 1}. "${key}": "${jsonContent[key]}"`)
    })
    
    // Create a cleaned version
    const cleanedJson = {}
    const processedKeys = new Set()
    
    Object.entries(jsonContent).forEach(([key, value]) => {
      if (!processedKeys.has(key)) {
        cleanedJson[key] = value
        processedKeys.add(key)
      }
    })
    
    // Write cleaned version
    fs.writeFileSync(
      frPath,
      JSON.stringify(cleanedJson, null, 2),
      'utf8'
    )
    
    console.log(`\nCleaned file written. Removed ${keys.length - Object.keys(cleanedJson).length} duplicate entries.`)
    console.log(`New file has ${Object.keys(cleanedJson).length} unique keys.`)
  } else {
    console.log('\nNo duplicate keys found!')
  }
}

findDuplicateKeys() 