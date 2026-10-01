import React from 'react'
import { createRoot } from 'react-dom/client'
import 'client/errorReporter'
import { rootDomId } from './client/util'
import Root from 'router/Root'
import './client/websockets.js'
import './css/global/index.scss'
import './i18n.mjs'
import { isSandboxMode } from 'sandbox/isSandbox'
import { listenForStaleChunks } from 'client/chunkReload'

// The boot loading screen's second milestone: the module graph has loaded
window.HyloBootLoader?.milestone?.('modules')

listenForStaleChunks()

async function boot () {
  // Install before React mounts so escape-hatch fetches never hit the real API.
  if (isSandboxMode()) {
    const { installSandboxFetchGuard } = await import('sandbox/guard')
    installSandboxFetchGuard()
  }

  const container = document.getElementById(rootDomId)
  const root = createRoot(container)
  root.render(<Root />)
}

boot()
