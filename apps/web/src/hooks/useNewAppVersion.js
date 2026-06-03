import { useState, useEffect, useRef } from 'react'
import { isDev } from 'config/index'

const POLL_INTERVAL = 10 * 60 * 1000 // 10 minutes

/**
 * Extracts the hash segment from a Vite main bundle script src,
 * e.g. "/assets/index-BfkNvL5j.js" → "BfkNvL5j"
 */
const extractBundleHash = (html) => {
  const match = html.match(/\/assets\/index-([^"'.]+)\.js/)
  return match ? match[1] : null
}

/**
 * Returns the current main JS bundle hash from the live DOM.
 */
const getCurrentBundleHash = () => {
  for (const script of document.querySelectorAll('script[src]')) {
    const hash = extractBundleHash(script.src)
    if (hash) return hash
  }
  return null
}

/**
 * Polls the app root HTML every 10 minutes to detect when a new Vite
 * build has been deployed. Returns true once a new version is found.
 */
export default function useNewAppVersion () {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false)
  const initialHashRef = useRef(null)

  useEffect(() => {
    if (isDev) return

    initialHashRef.current = getCurrentBundleHash()
    if (!initialHashRef.current) return

    const checkForNewVersion = async () => {
      try {
        const response = await fetch(`/?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
        const html = await response.text()
        const latestHash = extractBundleHash(html)
        if (latestHash && latestHash !== initialHashRef.current) {
          setNewVersionAvailable(true)
        }
      } catch {
        // Silently ignore network errors
      }
    }

    const interval = setInterval(checkForNewVersion, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return newVersionAvailable
}
