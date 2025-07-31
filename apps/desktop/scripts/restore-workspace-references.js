const fs = require('fs')
const path = require('path')

/**
 * Restores workspace references in package.json after Electron builds
 * This ensures the package.json stays clean for git commits
 */
function restoreWorkspaceReferences () {
  const desktopDir = __dirname
  const desktopPackageJson = path.join(desktopDir, '../package.json')

  if (fs.existsSync(desktopPackageJson)) {
    const packageJson = JSON.parse(fs.readFileSync(desktopPackageJson, 'utf8'))

    // Restore workspace references
    if (packageJson.dependencies) {
      if (packageJson.dependencies['@hylo/navigation'] === 'file:./shared-packages/navigation') {
        packageJson.dependencies['@hylo/navigation'] = 'workspace:*'
      }
      if (packageJson.dependencies['@hylo/presenters'] === 'file:./shared-packages/presenters') {
        packageJson.dependencies['@hylo/presenters'] = 'workspace:*'
      }
    }

    fs.writeFileSync(desktopPackageJson, JSON.stringify(packageJson, null, 2))
    console.log('✓ Restored workspace references in package.json')
  }
}

restoreWorkspaceReferences()
