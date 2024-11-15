import dotenv from 'dotenv'
import { build } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'
const __dirname = dirname(fileURLToPath(import.meta.url))

async function buildApp () {
  // Load environment variables
  dotenv.config()

  try {
    // Build client
    await build({
      configFile: resolve(__dirname, '../vite.config.js')
    })

    console.log('Building server...')

    // Build server
    // Copy server files to dist/server
    const serverDir = resolve(__dirname, '../src/server')
    const distServerDir = resolve(__dirname, '../dist/server')

    await fs.promises.mkdir(distServerDir, { recursive: true })
    await fs.promises.cp(serverDir, distServerDir, { recursive: true })

    console.log('✨ Build complete!')
    process.exit(0)
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

buildApp()
