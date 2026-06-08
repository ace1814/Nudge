import { app, BrowserWindow, ipcMain, systemPreferences } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { setupTray, showWindow } from './tray'
import { startScheduler } from './scheduler'
import { setupIpcHandlers } from './ipc'
import { resetSupabase } from './supabase'

let mainWindow = null
let tray = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 640,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: false,
    transparent: false,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Allow mic access from the renderer
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone') {
      callback(true)
    } else {
      callback(false)
    }
  })

  mainWindow.on('blur', () => {
    if (!mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Don't show in dock — we're a menu bar app
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  resetSupabase() // clear any stale cached instance from previous run
  createWindow()
  tray = setupTray(mainWindow)
  setupIpcHandlers(mainWindow)
  startScheduler(mainWindow)

  // Request mic permission on macOS (triggers the system dialog once)
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone')
  }

  // Show window on first launch so the user can find it
  mainWindow.webContents.once('did-finish-load', () => {
    showWindow(mainWindow, tray)
  })
})

app.on('window-all-closed', (e) => {
  // Prevent quit when all windows are closed — keep alive in tray
  e.preventDefault()
})

app.on('before-quit', () => {
  if (tray) tray.destroy()
})

export { mainWindow }
