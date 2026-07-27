import dotenv from 'dotenv'
import { build } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'
const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, '..')

async function buildApp () {
  // Load apps/web/.env without overriding Heroku / shell env (e.g. VITE_SENTRY_DSN)
  dotenv.config({ path: resolve(webRoot, '.env'), override: false })

  const sentryDsnSet = Boolean(process.env.VITE_SENTRY_DSN)
  console.log(
    sentryDsnSet
      ? 'Sentry: VITE_SENTRY_DSN is set — client bundle will initialize @sentry/react'
      : 'Sentry: VITE_SENTRY_DSN is not set — client error reporting will be disabled'
  )

  try {
    // Build client (envDir must be apps/web so Vite inlines VITE_* from process.env)
    await build({
      configFile: resolve(webRoot, 'vite.config.js'),
      root: webRoot,
      envDir: webRoot
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
