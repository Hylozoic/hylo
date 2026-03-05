#!/usr/bin/env node

/**
 * Creates a new template in SendWithUs and uploads the first version
 * 
 * Usage:
 *   node scripts/i18n/upload-new-template.js --template=Group_Created_i18n
 */

const fs = require('fs')
const path = require('path')
const { createTemplate, createTemplateVersion, createClient } = require('./sendwithus-client')

const TEMPLATES_DIR = path.resolve(__dirname, 'i18n-templates')

/**
 * Reads a template file
 */
function readTemplateFile (templateDir, filename) {
  const filePath = path.join(templateDir, filename)
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8')
  }
  return null
}

/**
 * Creates and uploads a new template
 */
async function uploadNewTemplate (templateDir, dryRun, client) {
  const metadataPath = path.join(templateDir, 'metadata.json')
  if (!fs.existsSync(metadataPath)) {
    console.error(`  ❌ No metadata.json found`)
    return { success: false, error: 'No metadata.json' }
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  const templateName = path.basename(templateDir)
  
  console.log(`\n📤 Creating new template: ${templateName}`)
  
  try {
    // Read template files
    const subject = readTemplateFile(templateDir, 'subject.liquid')
    const html = readTemplateFile(templateDir, 'html.liquid')
    const text = readTemplateFile(templateDir, 'text.liquid')
    
    if (!html) {
      console.error(`  ❌ No html.liquid found`)
      return { success: false, error: 'No html.liquid' }
    }
    
    // Build template data for creation
    const templateData = {
      name: metadata.templateName || templateName,
      subject: subject || '',
      html: html,
      text: text || ''
    }
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create template:`)
      console.log(`    Name: ${templateData.name}`)
      console.log(`    Subject: ${subject ? `${subject.length} chars` : 'empty'}`)
      console.log(`    HTML: ${html ? `${html.length} chars` : 'empty'}`)
      console.log(`    Text: ${text ? `${text.length} chars` : 'empty'}`)
      return { success: true, dryRun: true }
    }
    
    // Create the template
    console.log(`  💾 Creating template in SendWithUs...`)
    const newTemplate = await createTemplate(templateData, client)
    
    const templateId = newTemplate.id || newTemplate.template_id
    console.log(`  ✓ Created template: ${templateId}`)
    
    // Create initial version (if needed - sometimes the template creation includes a version)
    let versionId = newTemplate.version_id || newTemplate.version?.id
    
    if (!versionId && newTemplate.versions && newTemplate.versions.length > 0) {
      versionId = newTemplate.versions[0].id
    }
    
    // If we still don't have a version, create one
    if (!versionId) {
      console.log(`  💾 Creating initial version...`)
      const versionData = {
        name: metadata.versionName || 'Initial Version',
        subject: subject || '',
        html: html,
        text: text || ''
      }
      
      const newVersion = await createTemplateVersion(templateId, versionData, null, client)
      versionId = newVersion.id || newVersion.version_id
      console.log(`  ✓ Created version: ${versionId}`)
    } else {
      console.log(`  ✓ Using version: ${versionId}`)
    }
    
    // Update metadata with template and version info
    metadata.templateId = templateId
    metadata.versionId = versionId
    metadata.uploadedAt = new Date().toISOString()
    
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf8'
    )
    
    console.log(`\n  ✅ Template created successfully!`)
    console.log(`     Template ID: ${templateId}`)
    console.log(`     Version ID: ${versionId}`)
    console.log(`\n  📝 Next steps:`)
    console.log(`     1. Go to SendWithUs dashboard`)
    console.log(`     2. Tag the template with "i18n"`)
    console.log(`     3. Publish the version`)
    console.log(`     4. Update the template ID in apps/backend/api/services/Email.js`)
    
    return {
      success: true,
      templateId,
      versionId
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`)
    if (error.response) {
      console.error(`  Response: ${JSON.stringify(error.response, null, 2)}`)
    }
    return { success: false, error: error.message }
  }
}

/**
 * Main function
 */
async function main () {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const specificTemplate = args.find(arg => arg.startsWith('--template='))?.split('=')[1]
  
  if (!specificTemplate) {
    console.error('❌ Please specify a template: --template=Template_Name_i18n')
    process.exit(1)
  }
  
  console.log('📤 Creating New Template in SendWithUs\n')
  console.log(`   Template: ${specificTemplate}`)
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  
  const templateDir = path.join(TEMPLATES_DIR, specificTemplate)
  
  if (!fs.existsSync(templateDir)) {
    console.error(`❌ Template directory not found: ${templateDir}`)
    process.exit(1)
  }
  
  const client = createClient()
  
  try {
    const result = await uploadNewTemplate(templateDir, dryRun, client)
    
    if (!result.success) {
      console.error(`\n❌ Failed to create template: ${result.error}`)
      process.exit(1)
    }
    
    if (dryRun) {
      console.log('\n💡 This was a dry run. Run without --dry-run to create the template.')
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { uploadNewTemplate }

