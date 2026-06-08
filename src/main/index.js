import { app, BrowserWindow, ipcMain, systemPreferences, globalShortcut } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { setupTray, showWindow } from './tray'
import { startScheduler } from './scheduler'
import { setupIpcHandlers } from './ipc'
import { resetSupabase } from './supabase'

let mainWindow = null
let tray = null
let isRecording = false  // prevent window hide while user is recording

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
    if (permission === 'media' || permission === 'microphone') callback(true)
    else callback(false)
  })

  // Hide on blur — but not while recording (recording = mic permission dialog might appear)
  mainWindow.on('blur', () => {
    if (!isRecording && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  // Track recording state from renderer
  ipcMain.on('set-recording', (_, val) => {
    isRecording = !!val
    // If recording stops and window is still visible, keep it visible
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Don't show in dock — menu bar app
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  resetSupabase()
  createWindow()
  tray = setupTray(mainWindow)
  setupIpcHandlers(mainWindow)
  startScheduler(mainWindow)

  // Request mic permission on macOS (triggers the system dialog once)
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone')
  }

  // Global shortcut: ⌘⇧Space → show window + open voice recording
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    showWindow(mainWindow, tray)
    // Small delay so the window is visible before the recording sheet opens
    setTimeout(() => {
      mainWindow.webContents.send('open-voice-dump')
    }, 120)
  })

  // Show window on first launch
  mainWindow.webContents.once('did-finish-load', () => {
    showWindow(mainWindow, tray)
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (e) => {
  // Prevent quit — keep alive in tray
  e.preventDefault()
})

app.on('before-quit', () => {
  if (tray) tray.destroy()
})

export { mainWindow }
