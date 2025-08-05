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
  const nodeModulesDir = path.resolve(desktopDir, '../node_modules')

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

  // Create node_modules/@hylo directory if it doesn't exist
  const hyloNodeModulesDir = path.join(nodeModulesDir, '@hylo')
  if (!fs.existsSync(hyloNodeModulesDir)) {
    fs.mkdirSync(hyloNodeModulesDir, { recursive: true })
  }

  // Packages to copy
  const packagesToCopy = ['navigation', 'presenters']

  packagesToCopy.forEach(packageName => {
    const sourceDir = path.join(packagesDir, packageName)
    const nodeModulesTargetDir = path.join(hyloNodeModulesDir, packageName)

    if (!fs.existsSync(sourceDir)) {
      console.error(`Package ${packageName} not found at ${sourceDir}`)
      return
    }

    // Remove existing target directory
    if (fs.existsSync(nodeModulesTargetDir)) {
      fs.rmSync(nodeModulesTargetDir, { recursive: true, force: true })
    }

    // Copy the package to node_modules/@hylo
    fs.cpSync(sourceDir, nodeModulesTargetDir, { recursive: true, force: true })

    // Remove node_modules and other unnecessary files
    const nodeModulesNodeModulesPath = path.join(nodeModulesTargetDir, 'node_modules')
    if (fs.existsSync(nodeModulesNodeModulesPath)) {
      fs.rmSync(nodeModulesNodeModulesPath, { recursive: true, force: true })
    }

    // Remove any symlinks that might point outside the package
    removeExternalSymlinks(nodeModulesTargetDir, nodeModulesTargetDir)

    console.log(`✓ Copied ${packageName} to node_modules/@hylo`)
  })

  // Fix workspace references in package.json files
  console.log('🔧 Fixing workspace references...')
  const presentersNodeModulesJson = path.join(hyloNodeModulesDir, 'presenters', 'package.json')

  if (fs.existsSync(presentersNodeModulesJson)) {
    const packageJson = JSON.parse(fs.readFileSync(presentersNodeModulesJson, 'utf8'))

    // Replace workspace references with file references
    if (packageJson.dependencies && packageJson.dependencies['@hylo/navigation'] === 'workspace:*') {
      packageJson.dependencies['@hylo/navigation'] = 'file:../navigation'
      fs.writeFileSync(presentersNodeModulesJson, JSON.stringify(packageJson, null, 2))
      console.log('✓ Fixed @hylo/navigation reference in presenters package.json')
    }
  }

  console.log('✓ Shared packages copied successfully')
}

/**
 * Recursively removes symlinks that point outside the given directory
 */
function removeExternalSymlinks (dir, baseDir) {
  if (!fs.existsSync(dir)) return

  const items = fs.readdirSync(dir)
  for (const item of items) {
    const itemPath = path.join(dir, item)
    const stat = fs.lstatSync(itemPath)

    if (stat.isSymbolicLink()) {
      const target = fs.realpathSync(itemPath)
      const relativeTarget = path.relative(baseDir, target)

      // If the symlink points outside the base directory, remove it
      if (relativeTarget.startsWith('..')) {
        fs.unlinkSync(itemPath)
        console.log(`⚠️  Removed external symlink: ${itemPath} -> ${target}`)
      }
    } else if (stat.isDirectory()) {
      removeExternalSymlinks(itemPath, baseDir)
    }
  }
}

copySharedPackages()
