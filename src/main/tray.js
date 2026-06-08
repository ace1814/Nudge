import { Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'

let trayInstance = null

export function setupTray(mainWindow) {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty()
  } else {
    icon = icon.resize({ width: 18, height: 18 })
  }
  // Do NOT set as template image — colored bunny icon needs to render as-is

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
