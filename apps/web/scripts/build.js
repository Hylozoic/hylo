// Set production environment
process.env.NODE_ENV = 'production'

// Convert to ES6 imports
import dotenv from 'dotenv'
import chalk from 'chalk'
import fs from 'fs-extra'
import { build as viteBuild } from 'vite'
import paths from '../config/paths.js'

dotenv.config({ path: '.env' })

// Check required files
if (!fs.existsSync(paths.appHtml) || !fs.existsSync(paths.appIndexJs)) {
  console.log(chalk.red('Required files are missing.'))
  process.exit(1)
}

const build = async () => {
  console.log('Creating a production build...')

  try {
    await viteBuild()
    console.log(chalk.green('Compiled successfully.'))
    console.log()

    copyPublicFolder()
    printDeployInstructions()
  } catch (err) {
    console.log(chalk.red('Failed to compile.\n'))
    console.log(err.message || err)
    process.exit(1)
  }
}

const copyPublicFolder = () => {
  fs.copySync(paths.appPublic, 'dist', {
    dereference: true,
    filter: file => file !== paths.appHtml
  })
}

const printDeployInstructions = () => {
  const appPackage = JSON.parse(fs.readFileSync(paths.appPackageJson, 'utf8'))
  const homepagePath = appPackage.homepage

  if (homepagePath && homepagePath.indexOf('.github.io/') !== -1) {
    console.log('The project was built assuming it is hosted at ' + chalk.green(homepagePath) + '.')
    console.log('The ' + chalk.cyan('dist') + ' folder is ready to be deployed.')
    console.log('To publish it at ' + chalk.green(homepagePath) + ', run:')
    console.log()
    console.log('  ' + chalk.cyan('npm') + ' run deploy')
    console.log()
  } else {
    console.log('The project was built assuming it is hosted at the server root.')
    console.log('The ' + chalk.cyan('dist') + ' folder is ready to be deployed.')
    console.log('You may serve it locally with:')
    console.log()
    console.log('  ' + chalk.cyan('npm') + ' run preview')
    console.log()
  }
}

// Execute build
build()
