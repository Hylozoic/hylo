import React from 'react'
import { createRoot } from 'react-dom/client'
import { rootDomId } from './client/util'
import Root from 'router/Root'
// WebSocket initialization deferred to after app mounts - see router/index.js
import './css/global/index.scss'
import './i18n.mjs'

const container = document.getElementById(rootDomId)
const root = createRoot(container)

root.render(<Root />)
