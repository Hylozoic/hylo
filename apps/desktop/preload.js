// ==============
// Preload script
// ==============
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  desktop: true,

  // Expose methods to the renderer process
  setBadgeCount: (count) => ipcRenderer.send('set-badge-count', count),
  showNotification: (notification) => ipcRenderer.send('show-notification', notification),
  setTitle: (title) => ipcRenderer.send('set-title', title),
  getLocale: () => ipcRenderer.invoke('get-locale'),
  requestNotificationPermission: () => ipcRenderer.invoke('request-notification-permission'),
  onNavigateTo: (callback) => ipcRenderer.on('navigate-to', (event, url) => callback(url)),

  // Navigation controls
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  onNavigationState: (callback) => ipcRenderer.on('navigation-state', (event, state) => callback(state))
})

// Inject a minimal titlebar UI with back/forward buttons into the page
window.addEventListener('DOMContentLoaded', () => {
  try {
    const overlayHeight = 36

    const titlebar = document.createElement('div')
    titlebar.id = 'hylo-titlebar'
    titlebar.style.position = 'fixed'
    titlebar.style.top = '0'
    titlebar.style.left = '0'
    titlebar.style.right = '0'
    titlebar.style.height = overlayHeight + 'px'
    titlebar.style.display = 'flex'
    titlebar.style.alignItems = 'center'
    titlebar.style.justifyContent = 'center'
    titlebar.style.padding = '0 12px'
    titlebar.style.webkitAppRegion = 'drag'
    titlebar.style.background = 'transparent'
    titlebar.style.zIndex = '2147483647'

    const center = document.createElement('div')
    center.style.display = 'flex'
    center.style.alignItems = 'center'
    center.style.gap = '8px'
    center.style.webkitAppRegion = 'no-drag'
    center.style.pointerEvents = 'auto'

    const makeButton = (label, onClick) => {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.style.webkitAppRegion = 'no-drag'
      btn.style.height = '28px'
      btn.style.minWidth = '28px'
      btn.style.padding = '0 4px'
      btn.style.border = 'none'
      btn.style.background = 'transparent'
      btn.style.cursor = 'pointer'
      btn.style.fontSize = '18px'
      btn.style.fontWeight = '600'
      btn.addEventListener('click', onClick)
      return btn
    }

    const backBtn = makeButton('<', () => ipcRenderer.send('go-back'))
    const forwardBtn = makeButton('>', () => ipcRenderer.send('go-forward'))

    const titleText = document.createElement('div')
    titleText.style.fontSize = '12px'
    titleText.style.fontWeight = '600'
    titleText.style.color = '#000'
    titleText.style.whiteSpace = 'nowrap'

    const updateTitle = () => {
      const t = document.title || 'Hylo'
      titleText.textContent = t
      ipcRenderer.send('set-title', t)
    }
    updateTitle()
    const titleEl = document.querySelector('title') || document.head.appendChild(document.createElement('title'))
    const TitleObserver = window.MutationObserver || window.WebKitMutationObserver
    if (TitleObserver) {
      const mo = new TitleObserver(updateTitle)
      mo.observe(titleEl, { childList: true })
    } else {
      // Fallback: update on visibility/state changes
      document.addEventListener('readystatechange', updateTitle)
      document.addEventListener('visibilitychange', updateTitle)
    }

    center.appendChild(backBtn)
    center.appendChild(forwardBtn)
    center.appendChild(titleText)
    titlebar.appendChild(center)
    document.body.appendChild(titlebar)

    // Push content down to avoid overlap
    const currentPaddingTop = window.getComputedStyle(document.body).paddingTop
    const currentPaddingTopPx = parseFloat(currentPaddingTop || '0') || 0
    document.body.style.paddingTop = (currentPaddingTopPx + overlayHeight) + 'px'

    // Enable/disable buttons based on navigation state
    const applyState = (state) => {
      const disabledOpacity = '0.5'
      backBtn.disabled = !state.canGoBack
      forwardBtn.disabled = !state.canGoForward
      backBtn.style.opacity = backBtn.disabled ? disabledOpacity : '1'
      forwardBtn.style.opacity = forwardBtn.disabled ? disabledOpacity : '1'
      backBtn.style.cursor = backBtn.disabled ? 'default' : 'pointer'
      forwardBtn.style.cursor = forwardBtn.disabled ? 'default' : 'pointer'
    }

    ipcRenderer.on('navigation-state', (event, state) => applyState(state))
  } catch (e) {
    console.warn('Failed to inject titlebar overlay', e)
  }
})
