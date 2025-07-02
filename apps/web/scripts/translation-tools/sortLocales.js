const fs = require('fs');
const path = require('path');

function sortJsonFile(filePath) {
  // Read the file
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // Parse JSON
  const jsonContent = JSON.parse(fileContent);
  
  // Sort keys alphabetically
  const sortedJson = Object.keys(jsonContent)
    .sort()
    .reduce((acc, key) => {
      acc[key] = jsonContent[key];
      return acc;
    }, {});
  
  // Write back to file with proper formatting
  fs.writeFileSync(
    filePath,
    JSON.stringify(sortedJson, null, 2),
    'utf8'
  );
  
  console.log(`✓ Sorted ${path.basename(filePath)}`);
}

// Sort both locale files
const localesDir = path.join(process.cwd(), 'public', 'locales');
const files = ['en.json', 'es.json', 'fr.json'];

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  if (fs.existsSync(filePath)) {
    sortJsonFile(filePath);
  } else {
    console.error(`× File not found: ${file}`);
  }
});

console.log('\nDone! Locale files have been sorted alphabetically.'); 