import { app, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'

let trayInstance = null

export function setupTray(mainWindow) {
  // In packaged app, resources land in process.resourcesPath; in dev they're at project root/resources
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.png')
    : join(__dirname, '../../resources/tray-icon.png')

  const icon = nativeImage.createFromPath(iconPath)
  icon.setTemplateImage(true) // black-on-transparent; macOS inverts to white automatically

  trayInstance = new Tray(icon)
  trayInstance.setToolTip('Nudge')

  trayInstance.on('click', () => {
    toggleWindow(mainWindow, trayInstance)
  })

  trayInstance.on('right-click', () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Nudge', click: () => showWindow(mainWindow, trayInstance) },
      { type: 'separator' },
      { label: 'Quit Nudge', role: 'quit' }
    ])
    trayInstance.popUpContextMenu(contextMenu)
  })

  return trayInstance
}

function toggleWindow(mainWindow, tray) {
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    showWindow(mainWindow, tray)
  }
}

export function showWindow(mainWindow, tray) {
  const trayBounds = tray ? tray.getBounds() : { x: 0, y: 0, width: 0 }
  const windowBounds = mainWindow.getBounds()
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea

  // Position window below tray icon (macOS menu bar is at top)
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
  const y = trayBounds.y + trayBounds.height + 4

  // Keep within screen bounds
  const clampedX = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - windowBounds.width))

  mainWindow.setPosition(clampedX, y, false)
  mainWindow.show()
  mainWindow.focus()
}
