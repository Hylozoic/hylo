import React from 'react'
import { createRoot } from 'react-dom/client'
import 'client/errorReporter'
import { rootDomId } from './client/util'
import Root from 'router/Root'
import './client/websockets.js'
import './css/global/index.scss'
import './i18n.mjs'

// The boot loading screen's second milestone: the module graph has loaded
window.HyloBootLoader?.milestone?.('modules')

// Reload once when Vite fails to fetch a dynamic import (stale chunks after deploy)
window.addEventListener('vite:preloadError', () => {
  if (!window.sessionStorage.getItem('vite-reload-attempted')) {
    window.sessionStorage.setItem('vite-reload-attempted', '1')
    window.location.reload()
  }
})

const container = document.getElementById(rootDomId)
const root = createRoot(container)

root.render(<Root />)
// Clear the reload flag after a successful render so future deploys work
window.sessionStorage.removeItem('vite-reload-attempted')
