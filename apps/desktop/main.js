const { app, BrowserWindow, screen: electronScreen, ipcMain, Notification, shell } = require('electron')
const path = require('path')
const { initI18n, i18next } = require('./i18n.js')
const { bodyForNotification, titleForNotification, urlForNotification } = require('@hylo/presenters/NotificationPresenter')

let mainWindow

const HOST = app.isPackaged ? 'https://hylo.com' : 'http://localhost:3000'

function handleSetTitle (event, title) {
  const webContents = event.sender
  const win = BrowserWindow.fromWebContents(webContents)
  win.setTitle(title)
}

function handleShowNotification (event, notification) {
  try {
    // Strip HTML tags since electron notifications don't support HTML
    const stripHtml = str => str.replace(/<[^>]*>/g, '')

    // Translate the notification
    const translatedTitle = titleForNotification(notification, i18next.t)
    const translatedBody = bodyForNotification(notification, i18next.t)
    const url = urlForNotification(notification)

    const notif = new Notification({
      title: stripHtml(translatedTitle),
      body: stripHtml(translatedBody)
    })
    if (url) {
      notif.on('click', () => {
        if (!mainWindow) return
        if (mainWindow.isMinimized()) mainWindow.restore()
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate-to', url)
      })
    }
    notif.show()
  } catch (error) {
    console.error('Error showing notification:', error)
    // Fallback to untranslated notification
    new Notification({ title: notification.title, body: notification.body }).show()
  }
}

const createMainWindow = () => {
  let iconPath
  if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, 'assets', 'icon.icns')
  } else if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'assets', 'icon.ico')
  } else if (process.platform === 'linux') {
    iconPath = path.join(__dirname, 'assets', 'icon.png')
  }

  mainWindow = new BrowserWindow({
    width: electronScreen.getPrimaryDisplay().workArea.width,
    height: electronScreen.getPrimaryDisplay().workArea.height,
    show: false,
    title: 'Hylo',
    backgroundColor: 'white',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    }
  })

  mainWindow.loadURL(HOST)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle external links - open them in the system default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Check if the URL is external (not our app's domain)
    const isExternal = !url.startsWith(HOST) && !url.startsWith('hylo://')

    if (isExternal) {
      shell.openExternal(url)
      return { action: 'deny' }
    }

    // Allow internal links to open normally
    return { action: 'allow' }
  })

  // Handle new window requests (like target="_blank")
  mainWindow.webContents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()

    // Check if the URL is external
    const isExternal = !navigationUrl.startsWith(HOST) && !navigationUrl.startsWith('hylo://')

    if (isExternal) {
      shell.openExternal(navigationUrl)
    } else {
      // For internal links, navigate in the same window
      mainWindow.loadURL(navigationUrl)
    }
  })

  // Handle will-navigate events (for regular link clicks)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // Check if the URL is external
    const isExternal = !navigationUrl.startsWith(HOST) && !navigationUrl.startsWith('hylo://')

    if (isExternal) {
      event.preventDefault()
      shell.openExternal(navigationUrl)
    }
  })
}

// Needed for notifications to open the app using a hylo:// link
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('hylo', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('hylo')
}

// Register IPC handlers before app is ready
ipcMain.on('set-badge-count', (event, count) => app.setBadgeCount(count))
ipcMain.on('set-title', (event, title) => handleSetTitle(event, title))
ipcMain.on('show-notification', (event, notification) => handleShowNotification(event, notification))
ipcMain.handle('get-locale', () => app.getLocale())
ipcMain.handle('request-notification-permission', async () => {
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron')
    try {
      // Try to create a test notification to check permissions
      const testNotification = new Notification({
        title: 'Permission Test',
        body: 'Testing notification permissions'
      })

      // If we can create the notification, permissions are likely working
      console.log('Notification permissions appear to be working')
      return true
    } catch (error) {
      console.warn('Notification permissions may be restricted:', error.message)

      // Try requesting microphone access as a fallback to trigger permission dialogs
      try {
        const granted = await systemPreferences.askForMediaAccess('microphone')
        console.log('Microphone permission request result:', granted)
        return granted
      } catch (micError) {
        console.error('Error requesting microphone permission:', micError)
        return false
      }
    }
  }
  return true
})

app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  // Needed for notifications to open the app
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  await initI18n()

  // Request notification permissions on macOS
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron')
    // Request notification permissions explicitly
    if (systemPreferences.isTrustedAccessibilityClient(false)) {
      systemPreferences.registerDefaults({
        'NSUserNotificationAlertStyle': 'alert'
      })
    }

    // Log notification permission status
    try {
      // Check if we can create notifications (this will fail if permissions are denied)
      const testNotification = new Notification({ title: 'Test', body: 'Testing notifications' })
      console.log('Notification permissions appear to be working')
    } catch (error) {
      console.warn('Notification permissions may be restricted:', error.message)
    }
  }

  createMainWindow()

  // Set the dock icon on macOS
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'assets', 'icon.icns')
    app.dock.setIcon(iconPath)
    app.setName('Hylo')
  }

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
