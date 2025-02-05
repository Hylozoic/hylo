import React from 'react'
import { createRoot } from 'react-dom/client'
import { rootDomId } from './client/util'
import Root from 'router/Root'
import './client/websockets.js'
import './css/global/index.scss'
import './i18n.mjs'

const container = document.getElementById(rootDomId)
const root = createRoot(container)

root.render(<Root />)
