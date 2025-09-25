const fs = require('fs')
const path = require('path')

function findRawDuplicateKeys() {
  const frPath = path.join(process.cwd(), 'public', 'locales', 'fr.json')
  
  // Read the file as raw text
  const fileContent = fs.readFileSync(frPath, 'utf8')
  
  // Extract all key-value pairs using regex
  const keyPattern = /"([^"]+)":\s*"[^"]*"/g
  const keyMatches = []
  let match
  
  while ((match = keyPattern.exec(fileContent)) !== null) {
    keyMatches.push({
      key: match[1],
      line: fileContent.substring(0, match.index).split('\n').length
    })
  }
  
  // Count occurrences
  const keyCount = {}
  const duplicates = []
  
  keyMatches.forEach(({ key, line }) => {
    if (!keyCount[key]) {
      keyCount[key] = []
    }
    keyCount[key].push(line)
  })
  
  Object.entries(keyCount).forEach(([key, lines]) => {
    if (lines.length > 1) {
      duplicates.push({ key, lines })
    }
  })
  
  console.log(`Total key entries in file: ${keyMatches.length}`)
  console.log(`Unique keys: ${Object.keys(keyCount).length}`)
  console.log(`Keys with duplicates: ${duplicates.length}`)
  
  if (duplicates.length > 0) {
    console.log('\nDuplicate keys found in raw file:')
    duplicates.forEach(({ key, lines }, index) => {
      console.log(`${index + 1}. "${key}" appears on lines: ${lines.join(', ')}`)
    })
    
    // Now parse JSON and create cleaned version
    const jsonContent = JSON.parse(fileContent)
    
    // Write cleaned version (this will automatically remove duplicates)
    fs.writeFileSync(
      frPath,
      JSON.stringify(jsonContent, null, 2),
      'utf8'
    )
    
    console.log(`\nFile cleaned. JSON parsing automatically kept the last occurrence of each duplicate key.`)
    console.log(`File now has ${Object.keys(jsonContent).length} unique keys.`)
  } else {
    console.log('\nNo duplicate keys found in raw file!')
  }
}

findRawDuplicateKeys() 