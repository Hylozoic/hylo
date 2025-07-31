const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

/**
 * Copies built shared packages to the desktop app for Electron builds
 * This ensures the packages are available as regular npm packages during the build process
 */
function copySharedPackages () {
  const desktopDir = __dirname
  const rootDir = path.resolve(desktopDir, '../../../')
  const packagesDir = path.resolve(desktopDir, '../../../packages')
  const sharedPackagesDir = path.resolve(desktopDir, '../shared-packages')

  console.log('🔨 Building shared packages...')
  try {
    // Run the build-packages command from the root
    execSync('yarn build-packages', {
      cwd: rootDir,
      stdio: 'inherit'
    })
    console.log('✓ Shared packages built successfully')
  } catch (error) {
    console.error('❌ Failed to build shared packages:', error.message)
    process.exit(1)
  }

  // Create shared-packages directory if it doesn't exist
  if (!fs.existsSync(sharedPackagesDir)) {
    fs.mkdirSync(sharedPackagesDir, { recursive: true })
  }

  // Packages to copy
  const packagesToCopy = ['navigation', 'presenters']

  packagesToCopy.forEach(packageName => {
    const sourceDir = path.join(packagesDir, packageName)
    const targetDir = path.join(sharedPackagesDir, packageName)

    if (!fs.existsSync(sourceDir)) {
      console.error(`Package ${packageName} not found at ${sourceDir}`)
      return
    }

    // Remove existing target directory
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    // Copy the package
    fs.cpSync(sourceDir, targetDir, { recursive: true })

    // Remove node_modules and other unnecessary files
    const nodeModulesPath = path.join(targetDir, 'node_modules')
    if (fs.existsSync(nodeModulesPath)) {
      fs.rmSync(nodeModulesPath, { recursive: true, force: true })
    }

    console.log(`✓ Copied ${packageName} to ${targetDir}`)
  })

  // Fix workspace references in package.json files
  console.log('🔧 Fixing workspace references...')
  const presentersPackageJson = path.join(sharedPackagesDir, 'presenters', 'package.json')
  if (fs.existsSync(presentersPackageJson)) {
    const packageJson = JSON.parse(fs.readFileSync(presentersPackageJson, 'utf8'))

    // Replace workspace references with file references
    if (packageJson.dependencies && packageJson.dependencies['@hylo/navigation'] === 'workspace:*') {
      packageJson.dependencies['@hylo/navigation'] = 'file:../navigation'
      fs.writeFileSync(presentersPackageJson, JSON.stringify(packageJson, null, 2))
      console.log('✓ Fixed @hylo/navigation reference in presenters package.json')
    }
  }

  // Update desktop app's package.json to use file references for the build
  const desktopPackageJson = path.join(desktopDir, '../package.json')
  if (fs.existsSync(desktopPackageJson)) {
    const packageJson = JSON.parse(fs.readFileSync(desktopPackageJson, 'utf8'))

    // Replace workspace references with file references for the build
    if (packageJson.dependencies) {
      if (packageJson.dependencies['@hylo/navigation'] === 'workspace:*') {
        packageJson.dependencies['@hylo/navigation'] = 'file:./shared-packages/navigation'
      }
      if (packageJson.dependencies['@hylo/presenters'] === 'workspace:*') {
        packageJson.dependencies['@hylo/presenters'] = 'file:./shared-packages/presenters'
      }
    }

    fs.writeFileSync(desktopPackageJson, JSON.stringify(packageJson, null, 2))
    console.log('✓ Updated desktop package.json to use file references', packageJson.dependencies)
  }

  console.log('✓ Shared packages copied successfully')
}

copySharedPackages()
