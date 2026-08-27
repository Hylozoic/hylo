import React from 'react'
import { createRoot } from 'react-dom/client'
import 'client/errorReporter'
import { rootDomId } from './client/util'
import Root from 'router/Root'
import './client/websockets.js'
import './css/global/index.scss'
import './i18n.mjs'
import { isSandboxMode } from 'sandbox/isSandbox'

// Reload once when Vite fails to fetch a dynamic import (stale chunks after deploy)
window.addEventListener('vite:preloadError', () => {
  if (!window.sessionStorage.getItem('vite-reload-attempted')) {
    window.sessionStorage.setItem('vite-reload-attempted', '1')
    window.location.reload()
  }
})

async function boot () {
  // Install before React mounts so escape-hatch fetches never hit the real API.
  if (isSandboxMode()) {
    const { installSandboxFetchGuard } = await import('sandbox/guard')
    installSandboxFetchGuard()
  }

  const container = document.getElementById(rootDomId)
  const root = createRoot(container)
  root.render(<Root />)
  // Clear the reload flag after a successful render so future deploys work
  window.sessionStorage.removeItem('vite-reload-attempted')
}

boot()
