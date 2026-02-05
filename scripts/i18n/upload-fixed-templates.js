#!/usr/bin/env node

/**
 * Uploads manually fixed templates back to SendWithUs
 * 
 * This script:
 * 1. Reads fixed template files from the failed-templates directory
 * 2. Creates new versions in SendWithUs with the fixed content
 * 3. Optionally publishes the new versions
 */

const fs = require('fs')
const path = require('path')
const { createTemplateVersion, createClient } = require('./sendwithus-client')

const TEMPLATES_DIR = path.resolve(__dirname, 'failed-templates')

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
 * Uploads a fixed template
 */
async function uploadFixedTemplate (templateDir, dryRun, client) {
  const metadataPath = path.join(templateDir, 'metadata.json')
  if (!fs.existsSync(metadataPath)) {
    console.warn(`  ⚠️  No metadata.json found, skipping`)
    return { success: false, error: 'No metadata.json' }
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  const templateName = path.basename(templateDir)
  
  console.log(`\n📤 Uploading: ${templateName} (${metadata.templateId})`)
  
  try {
    // Read fixed template files
    const subject = readTemplateFile(templateDir, 'subject.liquid')
    const preheader = readTemplateFile(templateDir, 'preheader.liquid')
    const html = readTemplateFile(templateDir, 'html.liquid')
    const text = readTemplateFile(templateDir, 'text.liquid')
    const templateData = readTemplateFile(templateDir, 'template_data.json')
    
    // Build version data
    const versionData = {
      name: `Fixed manually - ${new Date().toISOString().split('T')[0]}`,
      subject: subject || '',
      html: html || '',
      text: text || ''
    }
    
    if (preheader) {
      versionData.preheader = preheader
    }
    
    if (templateData) {
      try {
        versionData.template_data = JSON.parse(templateData)
      } catch (e) {
        console.warn(`  ⚠️  Could not parse template_data.json: ${e.message}`)
      }
    }
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create new version:`)
      console.log(`    Name: ${versionData.name}`)
      console.log(`    Subject: ${subject ? `${subject.length} chars` : 'empty'}`)
      console.log(`    HTML: ${html ? `${html.length} chars` : 'empty'}`)
      console.log(`    Text: ${text ? `${text.length} chars` : 'empty'}`)
      return { success: true, dryRun: true }
    }
    
    // Create new version
    console.log(`  💾 Creating new version...`)
    const newVersion = await createTemplateVersion(metadata.templateId, versionData, null, client)
    
    console.log(`  ✓ Created version: ${newVersion.id || newVersion.version_id || 'unknown'}`)
    
    // Update metadata with new version info
    metadata.uploadedAt = new Date().toISOString()
    metadata.newVersionId = newVersion.id || newVersion.version_id
    metadata.newVersionName = versionData.name
    
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf8'
    )
    
    return {
      success: true,
      templateId: metadata.templateId,
      versionId: newVersion.id || newVersion.version_id
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`)
    if (error.response) {
      console.error(`  Response: ${JSON.stringify(error.response, null, 2)}`)
    }
    return { success: false, error: error.message, templateId: metadata.templateId }
  }
}

/**
 * Main function
 */
async function main () {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const specificTemplate = args.find(arg => arg.startsWith('--template='))?.split('=')[1]
  
  console.log('📤 Uploading Fixed Templates to SendWithUs\n')
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error(`❌ Templates directory not found: ${TEMPLATES_DIR}`)
    console.error(`   Run download-failing-templates.js first`)
    process.exit(1)
  }
  
  const client = createClient()
  
  try {
    // Find all template directories
    const entries = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    const templateDirs = entries
      .filter(entry => entry.isDirectory() && entry.name !== 'node_modules')
      .map(entry => path.join(TEMPLATES_DIR, entry.name))
    
    if (templateDirs.length === 0) {
      console.log(`\n⚠️  No template directories found in ${TEMPLATES_DIR}`)
      process.exit(0)
    }
    
    // Filter to specific template if specified
    let templatesToUpload = templateDirs
    if (specificTemplate) {
      templatesToUpload = templateDirs.filter(dir => 
        path.basename(dir) === specificTemplate || 
        path.basename(dir).includes(specificTemplate)
      )
      if (templatesToUpload.length === 0) {
        console.error(`❌ Template "${specificTemplate}" not found`)
        process.exit(1)
      }
    }
    
    console.log(`\n📋 Found ${templatesToUpload.length} template(s) to upload\n`)
    
    // Upload each template
    const results = []
    for (const templateDir of templatesToUpload) {
      const result = await uploadFixedTemplate(templateDir, dryRun, client)
      results.push(result)
    }
    
    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Summary:')
    console.log(`   Processed: ${templatesToUpload.length} template(s)`)
    console.log(`   Successful: ${results.filter(r => r.success).length}`)
    console.log(`   Failed: ${results.filter(r => !r.success).length}`)
    
    if (dryRun) {
      console.log('\n💡 This was a dry run. Run without --dry-run to upload.')
    } else {
      console.log('\n✅ Upload complete!')
      console.log('   New versions have been created in SendWithUs.')
      console.log('   You can now publish them in the SendWithUs dashboard.')
    }
    
    if (results.some(r => !r.success)) {
      console.log(`\n⚠️  Some templates failed to upload:`)
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.templateId}: ${r.error}`)
      })
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

module.exports = { uploadFixedTemplate }

