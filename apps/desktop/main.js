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
  console.log('Showing notification:', { event, notification })
  try {
    // Strip HTML tags since electron notifications don't support HTML
    const stripHtml = str => str.replace(/<[^>]*>/g, '')

    console.log('Translating notification:', { notification })

    // Translate the notification
    const translatedTitle = titleForNotification(notification, i18next.t)
    const translatedBody = bodyForNotification(notification, i18next.t)
    const url = urlForNotification(notification)

    console.log('Translated notification:', { translatedTitle, translatedBody, url })

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
    backgroundColor: 'white',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.loadURL(HOST)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    mainWindow = null
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
  createMainWindow()

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) {
      createMainWindow()
    }
  })

  ipcMain.on('set-badge-count', (event, count) => app.setBadgeCount(count))
  ipcMain.on('set-title', handleSetTitle)
  ipcMain.on('show-notification', handleShowNotification)
})

app.on('open-url', (event, url) => {
  // Make sure URL opened from a notification is opened in the main window
  console.log('Opening URL:', url)
  const finalURL = (app.isPackaged ? 'https://hylo.com' : 'http://localhost:3000') + url
  console.log('Final URL:', finalURL)
  shell.openExternal(finalURL)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
