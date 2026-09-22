import { materializeTimestamps } from './helpers'

const loaders = {
  en: () => import('./en/index.js')
}

/**
 * Load sandbox seed for a locale, materialize relative timestamps, fall back to en.
 */
export async function loadSandboxSeed (locale = 'en') {
  const load = loaders[locale] || loaders.en
  const mod = await load()
  const raw = mod.buildEnSeed()
  return materializeTimestamps(raw)
}

/**
 * Synchronous load when caller already has the locale module (tests).
 */
export function loadSandboxSeedSync (buildFn) {
  return materializeTimestamps(buildFn())
}

export { materializeTimestamps } from './helpers'
export * from './constants'
